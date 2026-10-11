import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { GradePublicationCoordinator } from '../../application/grade-publication.coordinator.js';
import { GradeEventPublishError } from '../../application/grade-event-publish-error.js';
import { GradePublicationRepository } from '../../application/ports/grade-publication-repository.js';
import { setPendingGradeEvents } from '../telemetry/messaging-telemetry.js';

/** Định kỳ publish lại các grade còn `pending` (retry không giới hạn, cùng `event_id`). */
@Injectable()
export class PendingGradeEventWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(PendingGradeEventWorker.name);
  private readonly intervalMs: number;
  private readonly batchSize: number;
  private timer: NodeJS.Timeout | undefined;
  private running: Promise<void> | undefined;
  private stopped = true;

  constructor(
    private readonly repository: GradePublicationRepository,
    private readonly coordinator: GradePublicationCoordinator,
    config: ConfigService,
  ) {
    this.intervalMs = config.getOrThrow<number>('GRADING_EVENT_RETRY_INTERVAL_MS');
    this.batchSize = config.getOrThrow<number>('GRADING_EVENT_RETRY_BATCH_SIZE');
  }

  onApplicationBootstrap(): void {
    this.start();
  }

  async onModuleDestroy(): Promise<void> {
    await this.stop();
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.schedule();
  }

  /** Dừng timer rồi chờ vòng đang chạy (nếu có) kết thúc. */
  async stop(): Promise<void> {
    this.stopped = true;
    clearTimeout(this.timer);
    this.timer = undefined;
    await this.running;
  }

  /** Một vòng: mỗi row `pending` thử đúng một lần, tuần tự. Công khai để test gọi trực tiếp. */
  async runCycle(): Promise<void> {
    try {
      const pending = await this.repository.findPending(this.batchSize);
      for (const snapshot of pending) {
        try {
          await this.coordinator.publish(snapshot);
        } catch (error) {
          // Broker lỗi thì các row còn lại cũng sẽ lỗi: dừng vòng này, vòng sau thử lại.
          // Event hỏng (EVENT_INVALID) không được chặn các event khác.
          if (!(error instanceof GradeEventPublishError) || error.kind !== 'invalid') break;
        }
      }
      setPendingGradeEvents(await this.repository.countPending());
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? String(error.code) : 'unknown';
      this.logger.warn(`Vòng publish lại event pending lỗi (code=${code})`);
    }
  }

  private schedule(): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      // Không bắt đầu vòng mới khi vòng trước chưa xong: vòng kế tiếp chỉ được lên lịch sau khi xong.
      this.running = this.runCycle().finally(() => {
        this.running = undefined;
        this.schedule();
      });
    }, this.intervalMs);
    this.timer.unref();
  }
}

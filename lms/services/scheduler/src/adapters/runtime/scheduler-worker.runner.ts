import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ExecuteNextRunUseCase } from '../../application/use-cases/worker/execute-next-run.use-case.js';
import { TickCronJobsUseCase } from '../../application/use-cases/worker/tick-cron-jobs.use-case.js';
import { PollingLoop } from './polling-loop.js';

/**
 * Tiến trình nền của `scheduler-worker`: một vòng tính lịch CRON (tạo run đến hạn) và
 * `SCHEDULER_WORKER_CONCURRENCY` vòng nhận/thực thi run bằng lease. Nhiều instance cùng chạy
 * an toàn nhờ `SKIP LOCKED` và khóa lũy đẳng của run.
 */
@Injectable()
export class SchedulerWorkerRunner implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(SchedulerWorkerRunner.name);
  private readonly loops: PollingLoop[];
  private started = false;

  constructor(
    @Inject(ConfigService) config: ConfigService,
    @Inject(TickCronJobsUseCase) tick: TickCronJobsUseCase,
    @Inject(ExecuteNextRunUseCase) execute: ExecuteNextRunUseCase,
  ) {
    const onError = (error: unknown): void =>
      this.logger.error(`Vòng nền lỗi: ${error instanceof Error ? error.name : 'không rõ'}`);
    const cron = new PollingLoop(async () => (await tick.execute()) > 0, {
      pollMs: config.getOrThrow<number>('SCHEDULER_CRON_TICK_MS'),
      onError,
    });
    const runners = Array.from(
      { length: config.getOrThrow<number>('SCHEDULER_WORKER_CONCURRENCY') },
      () =>
        new PollingLoop(() => execute.execute(), {
          pollMs: config.getOrThrow<number>('SCHEDULER_WORKER_POLL_MS'),
          onError,
        }),
    );
    this.loops = [cron, ...runners];
  }

  onApplicationBootstrap(): void {
    for (const loop of this.loops) loop.start();
    this.started = true;
  }

  /** Dùng cho `/ready`: các vòng nền đã được khởi động. */
  isReady(): boolean {
    return this.started;
  }

  async onApplicationShutdown(): Promise<void> {
    this.started = false;
    await Promise.all(this.loops.map((loop) => loop.stop()));
  }
}

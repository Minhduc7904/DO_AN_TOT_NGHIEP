import {
  type CommandEnvelope,
  RabbitMqCommandConsumer,
  type RabbitMqCommandPublisher,
  type RabbitMqSession,
} from '@aiops-lms/common/messaging';
import {
  batchDispatchPayloadSchema,
  batchSnapshotPayloadSchema,
  NOTIFICATION_COMMANDS,
  singleDispatchPayloadSchema,
} from '@aiops-lms/contracts/commands';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';

import type { DispatchBatchUseCase } from '../../application/use-cases/worker/dispatch-batch.use-case.js';
import type { DispatchSingleNotificationUseCase } from '../../application/use-cases/worker/dispatch-single.use-case.js';
import type { FailBatchUseCase } from '../../application/use-cases/worker/fail-batch.use-case.js';
import type { SnapshotBatchUseCase } from '../../application/use-cases/worker/snapshot-batch.use-case.js';

export interface WorkerSettings {
  prefetch: number;
  maxAttempts: number;
  retryDelayMs: number;
}

interface Route {
  queue: string;
  handle(envelope: CommandEnvelope): Promise<void>;
  onFault(envelope: CommandEnvelope, error: unknown): Promise<void>;
}

const reasonOf = (error: unknown): string => (error instanceof Error ? error.message : 'unknown');

/** Đăng ký một consumer cho mỗi command của `notification-worker` (queue canonical trong contracts). */
@Injectable()
export class NotificationWorkerRunner implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(NotificationWorkerRunner.name);
  private readonly consumers: RabbitMqCommandConsumer[] = [];
  private started = false;

  constructor(
    private readonly session: RabbitMqSession,
    private readonly publisher: RabbitMqCommandPublisher,
    private readonly settings: WorkerSettings,
    private readonly snapshot: SnapshotBatchUseCase,
    private readonly dispatch: DispatchBatchUseCase,
    private readonly single: DispatchSingleNotificationUseCase,
    private readonly failBatch: FailBatchUseCase,
  ) {}

  /** Đã đăng ký đủ consumer; dùng cho `/ready`. */
  isReady(): boolean {
    return this.started;
  }

  async onApplicationBootstrap(): Promise<void> {
    for (const route of this.routes()) {
      const consumer = new RabbitMqCommandConsumer(this.session, this.publisher, {
        queue: route.queue,
        prefetch: this.settings.prefetch,
        maxAttempts: this.settings.maxAttempts,
        retryDelayMs: this.settings.retryDelayMs,
        handler: (envelope) => route.handle(envelope),
        onFault: (envelope, error) => route.onFault(envelope, error),
        onWarning: (message) => this.logger.warn(message),
      });
      await consumer.start();
      this.consumers.push(consumer);
    }
    this.started = true;
    this.logger.log(`Đã đăng ký ${this.consumers.length} consumer`);
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all(this.consumers.map((consumer) => consumer.stop()));
    await this.session.close();
  }

  private routes(): Route[] {
    const c = NOTIFICATION_COMMANDS;
    const failBatchOf = async (envelope: CommandEnvelope, error: unknown): Promise<void> => {
      const payload = batchSnapshotPayloadSchema.safeParse(envelope.payload);
      if (payload.success) await this.failBatch.execute(payload.data.batch_id, reasonOf(error));
    };
    return [
      {
        queue: c.batchSnapshot.queue,
        handle: (envelope) =>
          this.snapshot.execute(
            envelope.message_id,
            c.batchSnapshot.queue,
            batchSnapshotPayloadSchema.parse(envelope.payload).batch_id,
          ),
        onFault: failBatchOf,
      },
      {
        queue: c.batchDispatch.queue,
        handle: (envelope) =>
          this.dispatch.execute(batchDispatchPayloadSchema.parse(envelope.payload).batch_id),
        onFault: failBatchOf,
      },
      {
        queue: c.singleDispatch.queue,
        handle: (envelope) =>
          this.single.execute(singleDispatchPayloadSchema.parse(envelope.payload).notification_id),
        onFault: async (envelope) => {
          const payload = singleDispatchPayloadSchema.safeParse(envelope.payload);
          if (payload.success) await this.single.markFailed(payload.data.notification_id);
        },
      },
    ];
  }
}

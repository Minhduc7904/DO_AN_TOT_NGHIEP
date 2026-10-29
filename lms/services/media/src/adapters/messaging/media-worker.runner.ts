import {
  type CommandEnvelope,
  RabbitMqCommandConsumer,
  type RabbitMqCommandPublisher,
  type RabbitMqSession,
} from '@aiops-lms/common/messaging';
import {
  MEDIA_COMMANDS,
  markdownUsageSynchronizePayloadSchema,
  notificationUsageCompleteJobPayloadSchema,
  notificationUsageRegisterBatchPayloadSchema,
  notificationUsageRegisterPayloadSchema,
  notificationUsageStartJobPayloadSchema,
  thumbnailGeneratePayloadSchema,
  usagesDeleteByIdsPayloadSchema,
} from '@aiops-lms/contracts/commands';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';

import { DeleteUsagesByIdsUseCase } from '../../application/use-cases/worker/delete-usages-by-ids.use-case.js';
import { GenerateThumbnailUseCase } from '../../application/use-cases/worker/generate-thumbnail.use-case.js';
import {
  CompleteNotificationUsageJobUseCase,
  RegisterNotificationUsageUseCase,
  StartNotificationUsageJobUseCase,
} from '../../application/use-cases/worker/notification-usage.use-cases.js';
import { SynchronizeMarkdownUsageUseCase } from '../../application/use-cases/worker/synchronize-markdown-usage.use-case.js';

export interface WorkerSettings {
  prefetch: number;
  maxAttempts: number;
  retryDelayMs: number;
}

interface Route {
  queue: string;
  handle(envelope: CommandEnvelope): Promise<void>;
  onFault?(envelope: CommandEnvelope, error: unknown): Promise<void>;
}

/** Đăng ký một consumer cho mỗi command của `media-worker` (queue canonical trong contracts). */
@Injectable()
export class MediaWorkerRunner implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(MediaWorkerRunner.name);
  private readonly consumers: RabbitMqCommandConsumer[] = [];
  private started = false;

  constructor(
    private readonly session: RabbitMqSession,
    private readonly publisher: RabbitMqCommandPublisher,
    private readonly settings: WorkerSettings,
    private readonly thumbnails: GenerateThumbnailUseCase,
    private readonly markdown: SynchronizeMarkdownUsageUseCase,
    private readonly deleteUsages: DeleteUsagesByIdsUseCase,
    private readonly registerUsage: RegisterNotificationUsageUseCase,
    private readonly startJob: StartNotificationUsageJobUseCase,
    private readonly completeJob: CompleteNotificationUsageJobUseCase,
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
        ...(route.onFault ? { onFault: route.onFault.bind(route) } : {}),
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
    const c = MEDIA_COMMANDS;
    return [
      {
        queue: c.thumbnailGenerate.queue,
        handle: (envelope) => {
          const payload = thumbnailGeneratePayloadSchema.parse(envelope.payload);
          return this.thumbnails.execute(
            envelope.message_id,
            c.thumbnailGenerate.queue,
            payload.media_id,
          );
        },
        onFault: async (envelope, error) => {
          const payload = thumbnailGeneratePayloadSchema.safeParse(envelope.payload);
          if (payload.success) {
            await this.thumbnails.markFailed(
              payload.data.media_id,
              error instanceof Error ? error.message : 'unknown',
            );
          }
        },
      },
      {
        queue: c.markdownUsageSynchronize.queue,
        handle: (envelope) => {
          const payload = markdownUsageSynchronizePayloadSchema.parse(envelope.payload);
          return this.markdown.execute(envelope.message_id, c.markdownUsageSynchronize.queue, {
            ownerKind: payload.owner_kind,
            ownerId: payload.owner_id,
            usageType: payload.usage_type,
            markdown: payload.markdown,
            actorId: payload.actor_id,
          });
        },
      },
      {
        queue: c.usagesDeleteByIds.queue,
        handle: (envelope) => {
          const payload = usagesDeleteByIdsPayloadSchema.parse(envelope.payload);
          return this.deleteUsages.execute(
            envelope.message_id,
            c.usagesDeleteByIds.queue,
            payload.usage_ids,
          );
        },
      },
      {
        queue: c.notificationUsageRegister.queue,
        handle: (envelope) => {
          const payload = notificationUsageRegisterPayloadSchema.parse(envelope.payload);
          return this.registerUsage.execute(
            envelope.message_id,
            c.notificationUsageRegister.queue,
            {
              actorId: payload.actor_id,
              items: [{ notificationId: payload.notification_id, mediaIds: payload.media_ids }],
            },
          );
        },
      },
      {
        queue: c.notificationUsageRegisterBatch.queue,
        handle: (envelope) => {
          const payload = notificationUsageRegisterBatchPayloadSchema.parse(envelope.payload);
          return this.registerUsage.execute(
            envelope.message_id,
            c.notificationUsageRegisterBatch.queue,
            {
              jobId: payload.job_id,
              actorId: payload.actor_id,
              items: payload.items.map((item) => ({
                notificationId: item.notification_id,
                mediaIds: item.media_ids,
              })),
            },
          );
        },
      },
      {
        queue: c.notificationUsageStartJob.queue,
        handle: (envelope) => {
          const payload = notificationUsageStartJobPayloadSchema.parse(envelope.payload);
          return this.startJob.execute(envelope.message_id, c.notificationUsageStartJob.queue, {
            jobId: payload.job_id,
            batchId: payload.batch_id,
          });
        },
      },
      {
        queue: c.notificationUsageCompleteJob.queue,
        handle: (envelope) => {
          const payload = notificationUsageCompleteJobPayloadSchema.parse(envelope.payload);
          return this.completeJob.execute(
            envelope.message_id,
            c.notificationUsageCompleteJob.queue,
            {
              jobId: payload.job_id,
              expectedUsageCount: payload.expected_usage_count,
            },
          );
        },
      },
    ];
  }
}

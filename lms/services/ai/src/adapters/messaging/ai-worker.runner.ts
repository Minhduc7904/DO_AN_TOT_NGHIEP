import {
  type CommandEnvelope,
  RabbitMqCommandConsumer,
  type RabbitMqCommandPublisher,
  type RabbitMqSession,
} from '@aiops-lms/common/messaging';
import {
  AI_COMMANDS,
  documentExtractPayloadSchema,
  jobRunPayloadSchema,
} from '@aiops-lms/contracts/commands';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';

import type { ExtractDocumentUseCase } from '../../application/use-cases/documents/extract-document.use-case.js';
import type { RunJobUseCase } from '../../application/use-cases/jobs/run-job.use-case.js';

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

/** Đăng ký một consumer cho mỗi command của `ai-worker` (queue canonical trong contracts). */
@Injectable()
export class AiWorkerRunner implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(AiWorkerRunner.name);
  private readonly consumers: RabbitMqCommandConsumer[] = [];
  private started = false;

  constructor(
    private readonly session: RabbitMqSession,
    private readonly publisher: RabbitMqCommandPublisher,
    private readonly settings: WorkerSettings,
    private readonly extractDocument: ExtractDocumentUseCase,
    private readonly runJob: RunJobUseCase,
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
    const c = AI_COMMANDS;
    return [
      {
        queue: c.documentExtract.queue,
        handle: (envelope) => {
          const payload = documentExtractPayloadSchema.parse(envelope.payload);
          return this.extractDocument.execute(envelope.message_id, {
            mediaId: payload.media_id,
            fileName: payload.file_name,
            contentType: payload.content_type,
            mediaType: payload.media_type,
          });
        },
        onFault: async (envelope) => {
          const payload = documentExtractPayloadSchema.safeParse(envelope.payload);
          if (payload.success) await this.extractDocument.markFaulted(payload.data.media_id);
        },
      },
      {
        queue: c.jobRun.queue,
        handle: (envelope) =>
          this.runJob.execute(
            envelope.message_id,
            jobRunPayloadSchema.parse(envelope.payload).job_id,
          ),
        onFault: async (envelope) => {
          const payload = jobRunPayloadSchema.safeParse(envelope.payload);
          if (payload.success) await this.runJob.markFaulted(payload.data.job_id);
        },
      },
    ];
  }
}

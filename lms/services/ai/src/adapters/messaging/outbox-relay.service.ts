import { OutboxRelayLoop } from '@aiops-lms/common/messaging';
import type { RabbitMqSession } from '@aiops-lms/common/messaging';
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../persistence/prisma.service.js';
import { createRabbitMq } from './rabbitmq.js';

/**
 * Relay outbox của `ai` → RabbitMQ. Chạy trong process API: command (ai-worker) được ghi cùng
 * transaction với dữ liệu nghiệp vụ và phát ra nền; broker chết thì command nằm lại trong outbox.
 */
@Injectable()
export class OutboxRelayService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly session: RabbitMqSession;
  private readonly loop: OutboxRelayLoop;

  constructor(
    @Inject(PrismaService) prisma: PrismaService,
    @Inject(ConfigService) config: ConfigService,
  ) {
    const logger = new Logger(OutboxRelayService.name);
    const { session, publisher } = createRabbitMq(
      {
        url: config.getOrThrow<string>('AI_RABBITMQ_URL'),
        connectTimeoutMs: config.getOrThrow<number>('AI_RABBITMQ_CONNECT_TIMEOUT_MS'),
        confirmTimeoutMs: config.getOrThrow<number>('AI_RABBITMQ_CONFIRM_TIMEOUT_MS'),
      },
      OutboxRelayService.name,
    );
    this.session = session;
    this.loop = new OutboxRelayLoop(prisma, publisher, {
      pollMs: config.getOrThrow<number>('AI_OUTBOX_POLL_MS'),
      batchSize: config.getOrThrow<number>('AI_OUTBOX_BATCH_SIZE'),
      leaseMs: config.getOrThrow<number>('AI_OUTBOX_LEASE_MS'),
      backoffMs: (attempt) => Math.min(30_000, 500 * 2 ** attempt),
      onWarning: (message) => logger.warn(message),
    });
  }

  onApplicationBootstrap(): void {
    this.loop.start();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.loop.stop();
    await this.session.close();
  }
}

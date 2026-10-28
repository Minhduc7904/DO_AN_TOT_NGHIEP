import { PostgresOutbox, runOnce } from '@aiops-lms/common/messaging';
import type { SqlClient } from '@aiops-lms/common/prisma';
import { MEDIA_COMMANDS } from '@aiops-lms/contracts/commands';
import { NOTIFICATION_COMMANDS } from '@aiops-lms/contracts/commands';

import type {
  NotificationCommands,
  NotificationStores,
  NotificationUnitOfWork,
} from '../../application/ports/unit-of-work.js';
import type { Db } from './db.js';
import { PrismaBatchRepository } from './prisma-batch.repository.js';
import { PrismaItemRepository } from './prisma-item.repository.js';
import { PrismaNotificationRepository } from './prisma-notification.repository.js';
import type { PrismaService } from './prisma.service.js';

const TRANSACTION_OPTIONS = { maxWait: 5_000, timeout: 30_000 };

export interface Producer {
  serviceName: string;
  serviceVersion: string;
}

class OutboxNotificationCommands implements NotificationCommands {
  constructor(private readonly outbox: PostgresOutbox) {}

  private send<T>(
    command: { name: string; version: number; queue: string },
    payload: T,
  ): Promise<void> {
    return this.outbox.enqueue({
      commandName: command.name,
      schemaVersion: command.version,
      routingKey: command.queue,
      payload,
    });
  }

  requestBatchSnapshot(batchId: string): Promise<void> {
    return this.send(NOTIFICATION_COMMANDS.batchSnapshot, { batch_id: batchId });
  }

  requestBatchDispatch(batchId: string): Promise<void> {
    return this.send(NOTIFICATION_COMMANDS.batchDispatch, { batch_id: batchId });
  }

  requestSingleDispatch(notificationId: string): Promise<void> {
    return this.send(NOTIFICATION_COMMANDS.singleDispatch, { notification_id: notificationId });
  }

  startMediaUsageJob(jobId: string, batchId: string): Promise<void> {
    return this.send(MEDIA_COMMANDS.notificationUsageStartJob, {
      job_id: jobId,
      batch_id: batchId,
    });
  }

  registerMediaUsage(
    notificationId: string,
    mediaIds: readonly string[],
    actorId: string,
  ): Promise<void> {
    return this.send(MEDIA_COMMANDS.notificationUsageRegister, {
      notification_id: notificationId,
      media_ids: mediaIds,
      actor_id: actorId,
    });
  }

  registerMediaUsageBatch(
    jobId: string,
    items: readonly { notificationId: string; mediaIds: readonly string[] }[],
    actorId: string,
  ): Promise<void> {
    return this.send(MEDIA_COMMANDS.notificationUsageRegisterBatch, {
      job_id: jobId,
      items: items.map((item) => ({
        notification_id: item.notificationId,
        media_ids: item.mediaIds,
      })),
      actor_id: actorId,
    });
  }

  completeMediaUsageJob(jobId: string, expectedUsageCount: number): Promise<void> {
    return this.send(MEDIA_COMMANDS.notificationUsageCompleteJob, {
      job_id: jobId,
      expected_usage_count: expectedUsageCount,
    });
  }
}

function storesFor(db: Db, producer: Producer): NotificationStores {
  return {
    notifications: new PrismaNotificationRepository(db),
    batches: new PrismaBatchRepository(db),
    items: new PrismaItemRepository(db),
    commands: new OutboxNotificationCommands(
      new PostgresOutbox(db as unknown as SqlClient, producer),
    ),
  };
}

export class PrismaNotificationUnitOfWork implements NotificationUnitOfWork {
  readonly stores: NotificationStores;

  constructor(
    private readonly prisma: PrismaService,
    private readonly producer: Producer,
  ) {
    this.stores = storesFor(prisma, producer);
  }

  run<T>(work: (stores: NotificationStores) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(
      (tx) => work(storesFor(tx, this.producer)),
      TRANSACTION_OPTIONS,
    );
  }

  runOnce(
    messageId: string,
    consumer: string,
    work: (stores: NotificationStores) => Promise<void>,
  ): Promise<'processed' | 'deduplicated'> {
    return runOnce(
      {
        $executeRawUnsafe: (query, ...values) => this.prisma.$executeRawUnsafe(query, ...values),
        $queryRawUnsafe: <T>(query: string, ...values: unknown[]) =>
          this.prisma.$queryRawUnsafe<T>(query, ...values),
        $transaction: (run) =>
          this.prisma.$transaction((tx) => run(tx as unknown as SqlClient), TRANSACTION_OPTIONS),
      },
      messageId,
      consumer,
      (tx) => work(storesFor(tx as unknown as Db, this.producer)),
    );
  }
}

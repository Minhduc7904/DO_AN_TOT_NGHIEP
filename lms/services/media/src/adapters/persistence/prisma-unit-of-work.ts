import { PostgresOutbox, runOnce } from '@aiops-lms/common/messaging';
import type { SqlClient } from '@aiops-lms/common/prisma';
import { MEDIA_COMMANDS } from '@aiops-lms/contracts/commands';

import type {
  MediaCommands,
  MediaStores,
  MediaUnitOfWork,
} from '../../application/ports/unit-of-work.js';
import type { Db } from './db.js';
import { PrismaJobRepository } from './prisma-job.repository.js';
import { PrismaMediaRepository } from './prisma-media.repository.js';
import { PrismaUsageRepository } from './prisma-usage.repository.js';
import type { PrismaService } from './prisma.service.js';

const TRANSACTION_OPTIONS = { maxWait: 5_000, timeout: 30_000 };

class OutboxMediaCommands implements MediaCommands {
  constructor(private readonly outbox: PostgresOutbox) {}

  requestThumbnail(mediaId: string): Promise<void> {
    const command = MEDIA_COMMANDS.thumbnailGenerate;
    return this.outbox.enqueue({
      commandName: command.name,
      schemaVersion: command.version,
      routingKey: command.queue,
      payload: { media_id: mediaId },
    });
  }
}

export interface Producer {
  serviceName: string;
  serviceVersion: string;
}

function storesFor(db: Db, producer: Producer): MediaStores {
  return {
    media: new PrismaMediaRepository(db),
    usages: new PrismaUsageRepository(db),
    jobs: new PrismaJobRepository(db),
    commands: new OutboxMediaCommands(new PostgresOutbox(db as unknown as SqlClient, producer)),
  };
}

export class PrismaMediaUnitOfWork implements MediaUnitOfWork {
  readonly stores: MediaStores;

  constructor(
    private readonly prisma: PrismaService,
    private readonly producer: Producer,
  ) {
    this.stores = storesFor(prisma, producer);
  }

  run<T>(work: (stores: MediaStores) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(
      (tx) => work(storesFor(tx, this.producer)),
      TRANSACTION_OPTIONS,
    );
  }

  runOnce(
    messageId: string,
    consumer: string,
    work: (stores: MediaStores) => Promise<void>,
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

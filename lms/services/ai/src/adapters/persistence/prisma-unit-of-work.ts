import { PostgresOutbox, runOnce } from '@aiops-lms/common/messaging';
import type { SqlClient } from '@aiops-lms/common/prisma';
import { AI_COMMANDS } from '@aiops-lms/contracts/commands';

import type { DocumentToExtract } from '../../application/ports/lesson-ai-repositories.js';
import type { AiCommands, AiStores, AiUnitOfWork } from '../../application/ports/unit-of-work.js';
import type { Db } from './db.js';
import { PrismaDocumentRepository } from './prisma-document.repository.js';
import { PrismaJobRepository } from './prisma-job.repository.js';
import type { PrismaService } from './prisma.service.js';

const TRANSACTION_OPTIONS = { maxWait: 5_000, timeout: 30_000 };

export interface Producer {
  serviceName: string;
  serviceVersion: string;
}

class OutboxAiCommands implements AiCommands {
  constructor(private readonly outbox: PostgresOutbox) {}

  requestDocumentExtraction(document: DocumentToExtract): Promise<void> {
    const command = AI_COMMANDS.documentExtract;
    return this.outbox.enqueue({
      commandName: command.name,
      schemaVersion: command.version,
      routingKey: command.queue,
      payload: {
        media_id: document.mediaId,
        file_name: document.fileName,
        content_type: document.contentType,
        media_type: document.mediaType,
      },
    });
  }

  requestJobRun(jobId: string): Promise<void> {
    const command = AI_COMMANDS.jobRun;
    return this.outbox.enqueue({
      commandName: command.name,
      schemaVersion: command.version,
      routingKey: command.queue,
      payload: { job_id: jobId },
    });
  }
}

function storesFor(db: Db, producer: Producer): AiStores {
  return {
    documents: new PrismaDocumentRepository(db),
    jobs: new PrismaJobRepository(db),
    commands: new OutboxAiCommands(new PostgresOutbox(db as unknown as SqlClient, producer)),
  };
}

export class PrismaAiUnitOfWork implements AiUnitOfWork {
  readonly stores: AiStores;

  constructor(
    private readonly prisma: PrismaService,
    private readonly producer: Producer,
  ) {
    this.stores = storesFor(prisma, producer);
  }

  run<T>(work: (stores: AiStores) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(
      (tx) => work(storesFor(tx, this.producer)),
      TRANSACTION_OPTIONS,
    );
  }

  runOnce(
    messageId: string,
    consumer: string,
    work: (stores: AiStores) => Promise<void>,
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

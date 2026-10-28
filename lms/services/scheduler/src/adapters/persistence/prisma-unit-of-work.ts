import type { SchedulerStores, SchedulerUnitOfWork } from '../../application/ports/unit-of-work.js';
import type { Db } from './db.js';
import { PrismaJobRepository } from './prisma-job.repository.js';
import { PrismaRunRepository } from './prisma-run.repository.js';
import type { PrismaService } from './prisma.service.js';

const TRANSACTION_OPTIONS = { maxWait: 5_000, timeout: 30_000 };

function storesFor(db: Db): SchedulerStores {
  return { jobs: new PrismaJobRepository(db), runs: new PrismaRunRepository(db) };
}

export class PrismaSchedulerUnitOfWork implements SchedulerUnitOfWork {
  readonly stores: SchedulerStores;

  constructor(private readonly prisma: PrismaService) {
    this.stores = storesFor(prisma);
  }

  run<T>(work: (stores: SchedulerStores) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) => work(storesFor(tx)), TRANSACTION_OPTIONS);
  }
}

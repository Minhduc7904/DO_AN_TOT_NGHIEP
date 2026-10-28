import type { BatchStatus, NotificationBatch } from '../../domain/notification.js';
import type {
  BatchPatch,
  BatchRepository,
  NewBatch,
} from '../../application/ports/repositories.js';
import type { Db } from './db.js';
import type { NotificationBatch as BatchRow, Prisma } from './generated/client.js';
import { isRecordNotFound, observeDb, omitUndefined } from './prisma-support.js';

const toBatch = (row: BatchRow): NotificationBatch => ({ ...row });

function dataOf(patch: BatchPatch): Prisma.NotificationBatchUpdateManyMutationInput {
  const { mediaUsageExpectedDelta, ...rest } = patch;
  return {
    ...omitUndefined(rest),
    ...(mediaUsageExpectedDelta
      ? { mediaUsageExpected: { increment: mediaUsageExpectedDelta } }
      : {}),
  };
}

export class PrismaBatchRepository implements BatchRepository {
  constructor(private readonly db: Db) {}

  create(batch: NewBatch): Promise<NotificationBatch | null> {
    return observeDb('batch.create', async () => {
      // Xung đột `source_batch_id` (đã có batch retry) cho `count = 0` thay vì làm hỏng transaction.
      const result = await this.db.notificationBatch.createMany({
        data: [batch],
        skipDuplicates: true,
      });
      if (result.count === 0) return null;
      return toBatch(
        await this.db.notificationBatch.findUniqueOrThrow({ where: { id: batch.id } }),
      );
    });
  }

  findById(id: string): Promise<NotificationBatch | null> {
    return observeDb('batch.find-by-id', async () => {
      const row = await this.db.notificationBatch.findUnique({ where: { id } });
      return row ? toBatch(row) : null;
    });
  }

  findBySource(sourceBatchId: string): Promise<NotificationBatch | null> {
    return observeDb('batch.find-by-source', async () => {
      const row = await this.db.notificationBatch.findUnique({ where: { sourceBatchId } });
      return row ? toBatch(row) : null;
    });
  }

  list(
    status: BatchStatus | undefined,
    page: number,
    pageSize: number,
  ): Promise<{ items: NotificationBatch[]; total: number }> {
    return observeDb('batch.list', async () => {
      const where = status ? { status } : {};
      const [rows, total] = await Promise.all([
        this.db.notificationBatch.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        this.db.notificationBatch.count({ where }),
      ]);
      return { items: rows.map(toBatch), total };
    });
  }

  update(id: string, patch: BatchPatch): Promise<NotificationBatch | null> {
    return observeDb('batch.update', async () => {
      try {
        return toBatch(
          await this.db.notificationBatch.update({ where: { id }, data: dataOf(patch) }),
        );
      } catch (error) {
        if (isRecordNotFound(error)) return null;
        throw error;
      }
    });
  }

  transition(
    id: string,
    from: readonly BatchStatus[],
    patch: BatchPatch & { status: BatchStatus },
  ): Promise<boolean> {
    return observeDb('batch.transition', async () => {
      const result = await this.db.notificationBatch.updateMany({
        where: { id, status: { in: [...from] } },
        data: dataOf(patch),
      });
      return result.count > 0;
    });
  }
}

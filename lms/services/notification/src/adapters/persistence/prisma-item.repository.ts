import type { BatchItem, BatchItemCounts } from '../../domain/notification.js';
import type { ItemRepository, NewBatchItem } from '../../application/ports/repositories.js';
import type { Db } from './db.js';
import type { NotificationBatchItem as ItemRow } from './generated/client.js';
import { observeDb } from './prisma-support.js';

const toItem = (row: ItemRow): BatchItem => ({ ...row });

const COLUMNS = `id::text AS "id", batch_id::text AS "batchId", student_id::text AS "studentId",
  email, status::text AS "status", attempts, lease_token::text AS "leaseToken",
  lease_expires_at AS "leaseExpiresAt", next_attempt_at AS "nextAttemptAt", last_error AS "lastError",
  notification_id::text AS "notificationId", created_at AS "createdAt", updated_at AS "updatedAt"`;

const OPEN_STATUSES = ['PENDING', 'RETRY', 'PROCESSING'] as const;

export class PrismaItemRepository implements ItemRepository {
  constructor(private readonly db: Db) {}

  insertMany(items: readonly NewBatchItem[]): Promise<number> {
    return observeDb('item.insert-many', async () => {
      if (items.length === 0) return 0;
      const result = await this.db.notificationBatchItem.createMany({
        data: [...items],
        skipDuplicates: true,
      });
      return result.count;
    });
  }

  copyFailed(sourceBatchId: string, targetBatchId: string): Promise<number> {
    return observeDb('item.copy-failed', () =>
      this.db.$executeRawUnsafe(
        `INSERT INTO notification_batch_items
           (id, batch_id, student_id, email, status, attempts, next_attempt_at, created_at, updated_at)
         SELECT gen_random_uuid(), $2::uuid, student_id, email, 'PENDING', 0, now(), now(), now()
         FROM notification_batch_items
         WHERE batch_id = $1::uuid AND status = 'FAILED'
         ON CONFLICT (batch_id, student_id) DO NOTHING`,
        sourceBatchId,
        targetBatchId,
      ),
    );
  }

  count(batchId: string): Promise<number> {
    return observeDb('item.count', () =>
      this.db.notificationBatchItem.count({ where: { batchId } }),
    );
  }

  countByStatus(batchId: string): Promise<BatchItemCounts> {
    return observeDb('item.count-by-status', async () => {
      const groups = await this.db.notificationBatchItem.groupBy({
        by: ['status'],
        where: { batchId },
        _count: { _all: true },
      });
      const byStatus = new Map(groups.map((group) => [group.status, group._count._all]));
      const pending = byStatus.get('PENDING') ?? 0;
      const processing = byStatus.get('PROCESSING') ?? 0;
      const retry = byStatus.get('RETRY') ?? 0;
      const success = byStatus.get('SUCCESS') ?? 0;
      const failed = byStatus.get('FAILED') ?? 0;
      return {
        total: pending + processing + retry + success + failed,
        pending,
        processing,
        retry,
        success,
        failed,
      };
    });
  }

  claim(
    batchId: string,
    limit: number,
    leaseMs: number,
    now: Date,
    leaseToken: string,
  ): Promise<BatchItem[]> {
    return observeDb('item.claim', async () => {
      const leaseExpiresAt = new Date(now.getTime() + leaseMs);
      return this.db.$queryRawUnsafe<BatchItem[]>(
        `UPDATE notification_batch_items SET
           status = 'PROCESSING', lease_token = $4::uuid, lease_expires_at = $5::timestamptz,
           attempts = attempts + 1, updated_at = now()
         WHERE id IN (
           SELECT id FROM notification_batch_items
           WHERE batch_id = $1::uuid AND (
             (status IN ('PENDING', 'RETRY') AND next_attempt_at <= $3::timestamptz)
             OR (status = 'PROCESSING' AND lease_expires_at < $3::timestamptz)
           )
           ORDER BY created_at, id
           LIMIT $2
           FOR UPDATE SKIP LOCKED
         )
         RETURNING ${COLUMNS}`,
        batchId,
        limit,
        now,
        leaseToken,
        leaseExpiresAt,
      );
    });
  }

  markSuccess(itemId: string, leaseToken: string, notificationId: string): Promise<boolean> {
    return observeDb('item.mark-success', async () => {
      const result = await this.db.notificationBatchItem.updateMany({
        where: { id: itemId, leaseToken, status: 'PROCESSING' },
        data: {
          status: 'SUCCESS',
          notificationId,
          leaseToken: null,
          leaseExpiresAt: null,
          lastError: null,
        },
      });
      return result.count > 0;
    });
  }

  markFailure(
    itemId: string,
    leaseToken: string,
    error: string,
    maxAttempts: number,
    retryDelayMs: (attempt: number) => number,
    now: Date,
  ): Promise<'RETRY' | 'FAILED' | null> {
    return observeDb('item.mark-failure', async () => {
      const item = await this.db.notificationBatchItem.findFirst({
        where: { id: itemId, leaseToken, status: 'PROCESSING' },
        select: { attempts: true },
      });
      if (!item) return null;
      const exhausted = item.attempts >= maxAttempts;
      await this.db.notificationBatchItem.updateMany({
        where: { id: itemId, leaseToken, status: 'PROCESSING' },
        data: {
          status: exhausted ? 'FAILED' : 'RETRY',
          lastError: error.slice(0, 500),
          leaseToken: null,
          leaseExpiresAt: null,
          nextAttemptAt: new Date(now.getTime() + retryDelayMs(item.attempts)),
        },
      });
      return exhausted ? 'FAILED' : 'RETRY';
    });
  }

  countOpen(batchId: string): Promise<number> {
    return observeDb('item.count-open', () =>
      this.db.notificationBatchItem.count({
        where: { batchId, status: { in: [...OPEN_STATUSES] } },
      }),
    );
  }

  nextClaimableAt(batchId: string): Promise<Date | null> {
    return observeDb('item.next-claimable-at', async () => {
      const rows = await this.db.$queryRawUnsafe<{ next: Date | null }[]>(
        `SELECT min(CASE WHEN status = 'PROCESSING' THEN lease_expires_at ELSE next_attempt_at END) AS "next"
         FROM notification_batch_items
         WHERE batch_id = $1::uuid AND status IN ('PENDING', 'RETRY', 'PROCESSING')`,
        batchId,
      );
      return rows[0]?.next ?? null;
    });
  }

  listFailed(
    batchId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: BatchItem[]; total: number }> {
    return observeDb('item.list-failed', async () => {
      const where = { batchId, status: 'FAILED' as const };
      const [rows, total] = await Promise.all([
        this.db.notificationBatchItem.findMany({
          where,
          orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        this.db.notificationBatchItem.count({ where }),
      ]);
      return { items: rows.map(toItem), total };
    });
  }
}

import type { BackgroundJobRun, JsonObject } from '../../domain/job.js';
import type {
  NewRun,
  RunClaimOptions,
  RunFilter,
  RunOutcome,
  RunRepository,
} from '../../application/ports/repositories.js';
import type { Db } from './db.js';
import type { BackgroundJobRun as RunRow, Prisma } from './generated/client.js';
import { inTransaction, observeDb } from './prisma-support.js';

const toRun = (row: RunRow): BackgroundJobRun => ({
  ...row,
  payloadSnapshot: row.payloadSnapshot as JsonObject,
  outputJson: (row.outputJson as JsonObject | null) ?? null,
});

/** Điều kiện một run đủ điều kiện được nhận: đến hạn, hoặc đang chạy nhưng lease đã hết và còn lượt. */
const CLAIMABLE = `(
  (r.status = 'PENDING' AND r.scheduled_at <= $1::timestamptz)
  OR (r.status = 'RUNNING' AND r.lease_expires_at < $1::timestamptz AND r.attempts < $2::int)
)`;

export class PrismaRunRepository implements RunRepository {
  constructor(private readonly db: Db) {}

  createIdempotent(run: NewRun): Promise<{ run: BackgroundJobRun; created: boolean }> {
    return observeDb('run.create-idempotent', async () => {
      // ON CONFLICT DO NOTHING trên (background_job_id, idempotency_key): không ném lỗi unique.
      const result = await this.db.backgroundJobRun.createMany({
        data: [
          {
            ...run,
            payloadSnapshot: run.payloadSnapshot as Prisma.InputJsonObject,
          },
        ],
        skipDuplicates: true,
      });
      const row = await this.db.backgroundJobRun.findUniqueOrThrow({
        where: { jobId_idempotencyKey: { jobId: run.jobId, idempotencyKey: run.idempotencyKey } },
      });
      return { run: toRun(row), created: result.count > 0 };
    });
  }

  findById(jobId: string, runId: string): Promise<BackgroundJobRun | null> {
    return observeDb('run.find-by-id', async () => {
      const row = await this.db.backgroundJobRun.findFirst({ where: { id: runId, jobId } });
      return row ? toRun(row) : null;
    });
  }

  findByKey(jobId: string, idempotencyKey: string): Promise<BackgroundJobRun | null> {
    return observeDb('run.find-by-key', async () => {
      const row = await this.db.backgroundJobRun.findUnique({
        where: { jobId_idempotencyKey: { jobId, idempotencyKey } },
      });
      return row ? toRun(row) : null;
    });
  }

  list(
    jobId: string,
    filter: RunFilter,
    page: number,
    pageSize: number,
  ): Promise<{ items: BackgroundJobRun[]; total: number }> {
    return observeDb('run.list', async () => {
      const where: Prisma.BackgroundJobRunWhereInput = {
        jobId,
        ...(filter.status ? { status: filter.status } : {}),
      };
      const [rows, total] = await Promise.all([
        this.db.backgroundJobRun.findMany({
          where,
          orderBy: [{ scheduledAt: 'desc' }, { id: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        this.db.backgroundJobRun.count({ where }),
      ]);
      return { items: rows.map(toRun), total };
    });
  }

  claimNext(options: RunClaimOptions): Promise<BackgroundJobRun | null> {
    return observeDb('run.claim-next', () =>
      // Hai câu lệnh trong một transaction: khóa dòng job trước (tuần tự hóa các instance theo job),
      // rồi nhận run bằng câu lệnh mới để thấy run vừa kết thúc của instance khác.
      inTransaction(this.db, async (tx) => {
        const jobs = await tx.$queryRawUnsafe<{ id: string; allowConcurrent: boolean }[]>(
          `SELECT j.id::text AS "id", j.allow_concurrent AS "allowConcurrent"
           FROM background_jobs j
           WHERE j.status = 'ACTIVE'
             AND EXISTS (
               SELECT 1 FROM background_job_runs r
               WHERE r.background_job_id = j.id AND ${CLAIMABLE}
             )
             AND (j.allow_concurrent OR NOT EXISTS (
               SELECT 1 FROM background_job_runs x
               WHERE x.background_job_id = j.id AND x.status = 'RUNNING'
                 AND x.lease_expires_at >= $1::timestamptz
             ))
           ORDER BY (
             SELECT min(r.scheduled_at) FROM background_job_runs r
             WHERE r.background_job_id = j.id AND r.status IN ('PENDING', 'RUNNING')
           ), j.id
           LIMIT 1
           FOR UPDATE OF j SKIP LOCKED`,
          options.now,
          options.maxAttempts,
        );
        const job = jobs[0];
        if (!job) return null;

        const claimed = await tx.$queryRawUnsafe<{ id: string }[]>(
          `UPDATE background_job_runs SET
             status = 'RUNNING', attempts = attempts + 1, started_at = $1::timestamptz,
             finished_at = NULL, error_code = NULL, error_message = NULL,
             lease_token = $3::uuid, lease_expires_at = $4::timestamptz, worker_instance = $5,
             updated_at = now()
           WHERE id = (
             SELECT r.id FROM background_job_runs r
             WHERE r.background_job_id = $6::uuid AND ${CLAIMABLE}
               AND ($7::boolean OR NOT EXISTS (
                 SELECT 1 FROM background_job_runs x
                 WHERE x.background_job_id = $6::uuid AND x.status = 'RUNNING'
                   AND x.lease_expires_at >= $1::timestamptz AND x.id <> r.id
               ))
             ORDER BY r.scheduled_at, r.id
             LIMIT 1
             FOR UPDATE OF r SKIP LOCKED
           )
           RETURNING id::text AS "id"`,
          options.now,
          options.maxAttempts,
          options.leaseToken,
          new Date(options.now.getTime() + options.leaseMs),
          options.workerInstance,
          job.id,
          job.allowConcurrent,
        );
        const id = claimed[0]?.id;
        if (!id) return null;
        const row = await tx.backgroundJobRun.findUniqueOrThrow({ where: { id } });
        return toRun(row);
      }),
    );
  }

  finish(runId: string, leaseToken: string, outcome: RunOutcome, now: Date): Promise<boolean> {
    return observeDb('run.finish', async () => {
      const result = await this.db.backgroundJobRun.updateMany({
        where: { id: runId, leaseToken, status: 'RUNNING' },
        data: {
          status: outcome.status,
          finishedAt: now,
          leaseToken: null,
          leaseExpiresAt: null,
          errorCode: outcome.status === 'FAILED' ? outcome.errorCode : null,
          errorMessage: outcome.status === 'FAILED' ? outcome.errorMessage : null,
          ...(outcome.output ? { outputJson: outcome.output as Prisma.InputJsonObject } : {}),
        },
      });
      return result.count > 0;
    });
  }

  failExhausted(
    now: Date,
    maxAttempts: number,
    errorCode: string,
    message: string,
  ): Promise<number> {
    return observeDb('run.fail-exhausted', async () => {
      const result = await this.db.backgroundJobRun.updateMany({
        where: {
          status: 'RUNNING',
          leaseExpiresAt: { lt: now },
          attempts: { gte: maxAttempts },
        },
        data: {
          status: 'FAILED',
          finishedAt: now,
          leaseToken: null,
          leaseExpiresAt: null,
          errorCode,
          errorMessage: message,
        },
      });
      return result.count;
    });
  }

  failPendingOfJob(jobId: string, errorCode: string, message: string, now: Date): Promise<number> {
    return observeDb('run.fail-pending-of-job', async () => {
      const result = await this.db.backgroundJobRun.updateMany({
        where: { jobId, status: 'PENDING' },
        data: { status: 'FAILED', finishedAt: now, errorCode, errorMessage: message },
      });
      return result.count;
    });
  }
}

import type { BackgroundJob, JobStatus, JsonObject } from '../../domain/job.js';
import type { JobFilter, JobRepository, NewJob } from '../../application/ports/repositories.js';
import type { Db } from './db.js';
import type { BackgroundJob as JobRow, Prisma } from './generated/client.js';
import { observeDb } from './prisma-support.js';

const toJob = (row: JobRow): BackgroundJob => ({ ...row, payload: row.payload as JsonObject });

export class PrismaJobRepository implements JobRepository {
  constructor(private readonly db: Db) {}

  create(job: NewJob): Promise<BackgroundJob | null> {
    return observeDb('job.create', async () => {
      // ON CONFLICT DO NOTHING: lỗi unique làm hỏng transaction PostgreSQL đang mở.
      const result = await this.db.backgroundJob.createMany({
        data: [{ ...job, payload: job.payload as Prisma.InputJsonObject }],
        skipDuplicates: true,
      });
      if (result.count === 0) return null;
      const row = await this.db.backgroundJob.findUnique({ where: { id: job.id } });
      return row ? toJob(row) : null;
    });
  }

  findById(id: string): Promise<BackgroundJob | null> {
    return observeDb('job.find-by-id', async () => {
      const row = await this.db.backgroundJob.findUnique({ where: { id } });
      return row ? toJob(row) : null;
    });
  }

  list(
    filter: JobFilter,
    page: number,
    pageSize: number,
  ): Promise<{ items: BackgroundJob[]; total: number }> {
    return observeDb('job.list', async () => {
      const where: Prisma.BackgroundJobWhereInput = {
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.type ? { type: filter.type } : {}),
      };
      const [rows, total] = await Promise.all([
        this.db.backgroundJob.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        this.db.backgroundJob.count({ where }),
      ]);
      return { items: rows.map(toJob), total };
    });
  }

  updateStatus(
    id: string,
    status: JobStatus,
    nextRunAt: Date | null,
  ): Promise<BackgroundJob | null> {
    return observeDb('job.update-status', async () => {
      const result = await this.db.backgroundJob.updateMany({
        where: { id },
        data: { status, nextRunAt },
      });
      if (result.count === 0) return null;
      const row = await this.db.backgroundJob.findUnique({ where: { id } });
      return row ? toJob(row) : null;
    });
  }

  lockDueCronJobs(now: Date, limit: number): Promise<BackgroundJob[]> {
    return observeDb('job.lock-due-cron', async () => {
      const locked = await this.db.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id::text AS "id" FROM background_jobs
         WHERE status = 'ACTIVE' AND schedule_type = 'CRON' AND next_run_at <= $1::timestamptz
         ORDER BY next_run_at, id
         LIMIT $2
         FOR UPDATE SKIP LOCKED`,
        now,
        limit,
      );
      if (locked.length === 0) return [];
      const rows = await this.db.backgroundJob.findMany({
        where: { id: { in: locked.map((row) => row.id) } },
        orderBy: [{ nextRunAt: 'asc' }, { id: 'asc' }],
      });
      return rows.map(toJob);
    });
  }

  setNextRunAt(id: string, nextRunAt: Date | null): Promise<void> {
    return observeDb('job.set-next-run-at', async () => {
      await this.db.backgroundJob.update({ where: { id }, data: { nextRunAt } });
    });
  }
}

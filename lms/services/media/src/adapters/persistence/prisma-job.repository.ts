import type { MediaJob } from '../../domain/media.js';
import type {
  JobFilter,
  JobPatch,
  JobRepository,
  NewJob,
} from '../../application/ports/repositories.js';
import type { Db } from './db.js';
import type { MediaBackgroundJob as JobRow } from './generated/client.js';
import { isRecordNotFound, observeDb, omitUndefined } from './prisma-support.js';

const toJob = (row: JobRow): MediaJob => ({ ...row });

export class PrismaJobRepository implements JobRepository {
  constructor(private readonly db: Db) {}

  ensure(job: NewJob): Promise<MediaJob> {
    return observeDb('job.ensure', async () => {
      // `skipDuplicates` (ON CONFLICT DO NOTHING) thay vì bắt P2002: lỗi unique làm hỏng cả
      // transaction PostgreSQL đang mở, các câu lệnh sau đó sẽ lỗi theo.
      await this.db.mediaBackgroundJob.createMany({
        data: [omitUndefined(job) as never],
        skipDuplicates: true,
      });
      const row = await this.db.mediaBackgroundJob.findUniqueOrThrow({
        where: { deduplicationKey: job.deduplicationKey },
      });
      return toJob(row);
    });
  }

  findById(id: string): Promise<MediaJob | null> {
    return observeDb('job.find-by-id', async () => {
      const row = await this.db.mediaBackgroundJob.findUnique({ where: { id } });
      return row ? toJob(row) : null;
    });
  }

  findByKey(deduplicationKey: string): Promise<MediaJob | null> {
    return observeDb('job.find-by-key', async () => {
      const row = await this.db.mediaBackgroundJob.findUnique({ where: { deduplicationKey } });
      return row ? toJob(row) : null;
    });
  }

  update(id: string, patch: JobPatch): Promise<MediaJob | null> {
    return observeDb('job.update', async () => {
      const { processedDelta, failedDelta, ...rest } = patch;
      try {
        return toJob(
          await this.db.mediaBackgroundJob.update({
            where: { id },
            data: {
              ...omitUndefined(rest),
              ...(processedDelta ? { processedCount: { increment: processedDelta } } : {}),
              ...(failedDelta ? { failedCount: { increment: failedDelta } } : {}),
            },
          }),
        );
      } catch (error) {
        if (isRecordNotFound(error)) return null;
        throw error;
      }
    });
  }

  list(
    filter: JobFilter,
    page: number,
    pageSize: number,
  ): Promise<{ items: MediaJob[]; total: number }> {
    return observeDb('job.list', async () => {
      const where = omitUndefined(filter);
      const [rows, total] = await Promise.all([
        this.db.mediaBackgroundJob.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        this.db.mediaBackgroundJob.count({ where }),
      ]);
      return { items: rows.map(toJob), total };
    });
  }
}

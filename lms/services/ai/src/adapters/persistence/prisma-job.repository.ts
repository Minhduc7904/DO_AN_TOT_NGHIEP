import type {
  JobDetail,
  JobRepository,
  NewJob,
} from '../../application/ports/lesson-ai-repositories.js';
import { AI_JOB_ERROR_CODES, type AiJob } from '../../domain/lesson-ai.js';
import type { Db } from './db.js';
import type { AiJob as JobRow } from './generated/client.js';
import { observeDb } from './prisma-support.js';

function toJob(row: JobRow): AiJob {
  return {
    id: row.id,
    lessonId: row.lessonId,
    courseId: row.courseId,
    jobType: row.jobType,
    status: row.status,
    mediaIds: row.mediaIds,
    questionCount: row.questionCount,
    overwriteContent: row.overwriteContent,
    hasPreviousContent: row.hasPreviousContent,
    resultQuizId: row.resultQuizId,
    stepCount: row.stepCount,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    requestedById: row.requestedById,
    requestedByRole: row.requestedByRole,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
  };
}

/**
 * Job AI. Nhận job bằng một câu lệnh `UPDATE … WHERE id = $1 AND status = 'PENDING'` nên hai worker không
 * chạy trùng một job. Không bắt unique violation trong transaction: tạo job dùng `createMany skipDuplicates`
 * (`ON CONFLICT DO NOTHING`) dựa trên partial unique index `ai_jobs_one_active`.
 */
export class PrismaJobRepository implements JobRepository {
  constructor(private readonly db: Db) {}

  create(job: NewJob): Promise<AiJob | null> {
    return observeDb('job.create', async () => {
      const result = await this.db.aiJob.createMany({
        data: [{ ...job, mediaIds: [...job.mediaIds] }],
        skipDuplicates: true,
      });
      if (result.count === 0) return null;
      return toJob(await this.db.aiJob.findUniqueOrThrow({ where: { id: job.id } }));
    });
  }

  listRecent(lessonId: string, limit: number): Promise<AiJob[]> {
    return observeDb('job.list-recent', async () => {
      const rows = await this.db.aiJob.findMany({
        where: { lessonId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      return rows.map(toJob);
    });
  }

  find(lessonId: string, jobId: string): Promise<JobDetail | null> {
    return observeDb('job.find', async () => {
      const row = await this.db.aiJob.findFirst({ where: { id: jobId, lessonId } });
      return row ? { job: toJob(row), previousContentMarkdown: row.previousContentMarkdown } : null;
    });
  }

  claim(jobId: string, now: Date, leaseUntil: Date): Promise<AiJob | null> {
    return observeDb('job.claim', async () => {
      const rows = await this.db.$queryRaw<{ id: string }[]>`
        UPDATE ai_jobs
        SET status = 'RUNNING', started_at = COALESCE(started_at, ${now}::timestamptz),
            lease_expires_at = ${leaseUntil}::timestamptz, updated_at = ${now}::timestamptz
        WHERE id = ${jobId}::uuid AND status = 'PENDING'
        RETURNING id`;
      const claimed = rows[0];
      if (!claimed) return null;
      return toJob(await this.db.aiJob.findUniqueOrThrow({ where: { id: claimed.id } }));
    });
  }

  failIfInterrupted(jobId: string, now: Date): Promise<boolean> {
    return observeDb('job.fail-if-interrupted', async () => {
      const result = await this.db.aiJob.updateMany({
        where: { id: jobId, status: 'RUNNING', leaseExpiresAt: { lt: now } },
        data: {
          status: 'FAILED',
          errorCode: AI_JOB_ERROR_CODES.workerInterrupted,
          errorMessage: 'Worker bị gián đoạn khi đang chạy job; job không được chạy lại',
          finishedAt: now,
          leaseExpiresAt: null,
          updatedAt: now,
        },
      });
      return result.count > 0;
    });
  }

  beginStep(jobId: string, now: Date, leaseUntil: Date): Promise<void> {
    return observeDb('job.begin-step', async () => {
      await this.db.aiJob.update({
        where: { id: jobId },
        data: { stepCount: { increment: 1 }, leaseExpiresAt: leaseUntil, updatedAt: now },
      });
    });
  }

  recordPreviousContent(jobId: string, content: string, now: Date): Promise<void> {
    return observeDb('job.record-previous-content', async () => {
      await this.db.aiJob.update({
        where: { id: jobId },
        data: { hasPreviousContent: true, previousContentMarkdown: content, updatedAt: now },
      });
    });
  }

  clearPreviousContent(jobId: string, now: Date): Promise<void> {
    return observeDb('job.clear-previous-content', async () => {
      await this.db.aiJob.update({
        where: { id: jobId },
        data: { hasPreviousContent: false, previousContentMarkdown: null, updatedAt: now },
      });
    });
  }

  complete(jobId: string, resultQuizId: string | null, now: Date): Promise<void> {
    return observeDb('job.complete', async () => {
      await this.db.aiJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          resultQuizId,
          errorCode: null,
          errorMessage: null,
          finishedAt: now,
          leaseExpiresAt: null,
          updatedAt: now,
        },
      });
    });
  }

  fail(jobId: string, errorCode: string, errorMessage: string, now: Date): Promise<void> {
    return observeDb('job.fail', async () => {
      await this.db.aiJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          errorCode,
          errorMessage,
          finishedAt: now,
          leaseExpiresAt: null,
          updatedAt: now,
        },
      });
    });
  }

  failIfActive(jobId: string, errorCode: string, errorMessage: string, now: Date): Promise<void> {
    return observeDb('job.fail-if-active', async () => {
      await this.db.aiJob.updateMany({
        where: { id: jobId, status: { in: ['PENDING', 'RUNNING'] } },
        data: {
          status: 'FAILED',
          errorCode,
          errorMessage,
          finishedAt: now,
          leaseExpiresAt: null,
          updatedAt: now,
        },
      });
    });
  }
}

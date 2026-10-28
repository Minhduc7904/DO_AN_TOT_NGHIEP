import type { BackgroundJobDto, BackgroundJobRunDto } from '@aiops-lms/contracts';

import type { BackgroundJob, BackgroundJobRun } from '../../../domain/job.js';

export function presentJob(job: BackgroundJob): BackgroundJobDto {
  return {
    id: job.id,
    name: job.name,
    type: job.type,
    schedule_type: job.scheduleType,
    cron_expression: job.cronExpression,
    payload: job.payload,
    status: job.status,
    allow_concurrent: job.allowConcurrent,
    next_run_at: job.nextRunAt?.toISOString() ?? null,
    created_by: job.createdBy,
    created_at: job.createdAt.toISOString(),
    updated_at: job.updatedAt.toISOString(),
  };
}

/** Không đưa `lease_token` hay payload snapshot ra ngoài. */
export function presentRun(run: BackgroundJobRun): BackgroundJobRunDto {
  return {
    id: run.id,
    job_id: run.jobId,
    trigger_type: run.triggerType,
    idempotency_key: run.idempotencyKey,
    status: run.status,
    attempts: run.attempts,
    scheduled_at: run.scheduledAt.toISOString(),
    started_at: run.startedAt?.toISOString() ?? null,
    finished_at: run.finishedAt?.toISOString() ?? null,
    worker_instance: run.workerInstance,
    error_code: run.errorCode,
    error_message: run.errorMessage,
    output: run.outputJson,
    created_by: run.createdBy,
    created_at: run.createdAt.toISOString(),
  };
}

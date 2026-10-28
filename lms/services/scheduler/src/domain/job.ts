export type JobType = 'MEDIA_UNUSED_CLEANUP';
export type ScheduleType = 'MANUAL' | 'CRON';
export type JobStatus = 'ACTIVE' | 'PAUSED' | 'DISABLED';
export type RunTriggerType = 'MANUAL' | 'CRON';
export type RunStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export type JsonObject = Record<string, unknown>;

export interface BackgroundJob {
  id: string;
  name: string;
  type: JobType;
  scheduleType: ScheduleType;
  cronExpression: string | null;
  payload: JsonObject;
  status: JobStatus;
  allowConcurrent: boolean;
  nextRunAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BackgroundJobRun {
  id: string;
  jobId: string;
  triggerType: RunTriggerType;
  idempotencyKey: string;
  payloadSnapshot: JsonObject;
  status: RunStatus;
  scheduledAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  attempts: number;
  leaseToken: string | null;
  leaseExpiresAt: Date | null;
  workerInstance: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  outputJson: JsonObject | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Mã lỗi ổn định ghi vào `error_code` của run (không phải mã HTTP). */
export const RUN_ERROR_CODES = {
  jobDisabled: 'JOB_DISABLED',
  leaseExpired: 'RUN_LEASE_EXPIRED',
  mediaCleanupIncomplete: 'MEDIA_CLEANUP_INCOMPLETE',
  mediaCleanupRejected: 'MEDIA_CLEANUP_REJECTED',
  mediaCleanupInvalidResponse: 'MEDIA_CLEANUP_INVALID_RESPONSE',
  internal: 'INTERNAL_ERROR',
} as const;

/** Khóa lũy đẳng của run CRON: mọi instance tính cùng một khóa cho cùng một mốc lịch. */
export function cronIdempotencyKey(jobId: string, scheduledAt: Date): string {
  return `cron:${jobId}:${scheduledAt.toISOString()}`;
}

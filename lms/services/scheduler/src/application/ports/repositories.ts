import type {
  BackgroundJob,
  BackgroundJobRun,
  JobStatus,
  JobType,
  JsonObject,
  RunStatus,
  RunTriggerType,
  ScheduleType,
} from '../../domain/job.js';

export interface NewJob {
  id: string;
  name: string;
  type: JobType;
  scheduleType: ScheduleType;
  cronExpression: string | null;
  payload: JsonObject;
  allowConcurrent: boolean;
  nextRunAt: Date | null;
  createdBy: string;
}

export interface JobFilter {
  status?: JobStatus | undefined;
  type?: JobType | undefined;
}

export interface JobRepository {
  /** `null` khi tên job đã tồn tại (không ném lỗi unique trong transaction). */
  create(job: NewJob): Promise<BackgroundJob | null>;
  findById(id: string): Promise<BackgroundJob | null>;
  list(
    filter: JobFilter,
    page: number,
    pageSize: number,
  ): Promise<{ items: BackgroundJob[]; total: number }>;
  /** Đổi trạng thái và `nextRunAt` (null khi không còn chạy theo lịch). */
  updateStatus(
    id: string,
    status: JobStatus,
    nextRunAt: Date | null,
  ): Promise<BackgroundJob | null>;
  /**
   * Job CRON `ACTIVE` đến hạn (`next_run_at <= now`), khóa dòng bằng `FOR UPDATE SKIP LOCKED` trong
   * transaction hiện tại để chỉ một instance tính lịch cho một job.
   */
  lockDueCronJobs(now: Date, limit: number): Promise<BackgroundJob[]>;
  setNextRunAt(id: string, nextRunAt: Date | null): Promise<void>;
}

export interface NewRun {
  id: string;
  jobId: string;
  triggerType: RunTriggerType;
  idempotencyKey: string;
  payloadSnapshot: JsonObject;
  scheduledAt: Date;
  createdBy: string | null;
}

export interface RunFilter {
  status?: RunStatus | undefined;
}

export interface RunClaimOptions {
  now: Date;
  leaseMs: number;
  leaseToken: string;
  workerInstance: string;
  /** Số lần nhận tối đa; run quá số này sau khi lease hết hạn không được nhận lại. */
  maxAttempts: number;
}

export type RunOutcome =
  | { status: 'SUCCEEDED'; output: JsonObject }
  | { status: 'FAILED'; errorCode: string; errorMessage: string; output?: JsonObject | undefined };

export interface RunRepository {
  /**
   * Tạo run, hoặc trả run đã có cùng `(jobId, idempotencyKey)` với `created=false`
   * (`INSERT … ON CONFLICT DO NOTHING`, không bắt lỗi unique).
   */
  createIdempotent(run: NewRun): Promise<{ run: BackgroundJobRun; created: boolean }>;
  findById(jobId: string, runId: string): Promise<BackgroundJobRun | null>;
  findByKey(jobId: string, idempotencyKey: string): Promise<BackgroundJobRun | null>;
  list(
    jobId: string,
    filter: RunFilter,
    page: number,
    pageSize: number,
  ): Promise<{ items: BackgroundJobRun[]; total: number }>;
  /**
   * Nhận một run `PENDING` (hoặc `RUNNING` đã hết lease) của job `ACTIVE` bằng lease. Job không
   * `allowConcurrent` chỉ có một run chạy tại một thời điểm.
   */
  claimNext(options: RunClaimOptions): Promise<BackgroundJobRun | null>;
  /** Ghi kết quả; `false` nếu lease đã mất (instance khác đã nhận lại). */
  finish(runId: string, leaseToken: string, outcome: RunOutcome, now: Date): Promise<boolean>;
  /** Đánh dấu `FAILED` các run `RUNNING` hết lease mà đã hết số lần nhận. Trả số run. */
  failExhausted(
    now: Date,
    maxAttempts: number,
    errorCode: string,
    message: string,
  ): Promise<number>;
  /** Đánh dấu `FAILED` mọi run `PENDING` của job (khi job bị `DISABLED`). Trả số run. */
  failPendingOfJob(jobId: string, errorCode: string, message: string, now: Date): Promise<number>;
}

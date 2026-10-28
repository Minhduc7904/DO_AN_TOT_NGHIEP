import { z } from 'zod';

import { idSchema, paginationQuerySchema } from '../common/index.js';
import { mediaCleanupRequestSchema } from '../internal/media.js';

/** Loại job tích hợp sẵn; mỗi loại có handler riêng trong `scheduler-worker`. */
export const backgroundJobTypeSchema = z.enum(['MEDIA_UNUSED_CLEANUP']);
export const scheduleTypeSchema = z.enum(['MANUAL', 'CRON']);
export const backgroundJobStatusSchema = z.enum(['ACTIVE', 'PAUSED', 'DISABLED']);
export const jobRunStatusSchema = z.enum(['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED']);
export const runTriggerTypeSchema = z.enum(['MANUAL', 'CRON']);

const dateTime = z.iso.datetime();
const jobName = z.string().trim().min(1).max(120);

/** Payload nhỏ của job (tham số, không phải dữ liệu nghiệp vụ); tối đa 4 KB sau khi serialize. */
const MAX_PAYLOAD_BYTES = 4_096;
const payloadSchema = z
  .record(z.string(), z.unknown())
  .refine((payload) => JSON.stringify(payload).length <= MAX_PAYLOAD_BYTES, {
    message: `payload tối đa ${MAX_PAYLOAD_BYTES} ký tự`,
  });

// ---- Request ---------------------------------------------------------------------------------

export const createJobRequestSchema = z
  .object({
    name: jobName,
    type: backgroundJobTypeSchema,
    schedule_type: scheduleTypeSchema,
    /** Biểu thức CRON 5 trường theo UTC; bắt buộc khi `CRON`, không được có khi `MANUAL`. */
    cron_expression: z.string().trim().min(1).max(120).nullish(),
    payload: payloadSchema.default({}),
    /** Cho phép nhiều run của cùng job chạy đồng thời; mặc định `false`. */
    allow_concurrent: z.boolean().default(false),
  })
  .superRefine((value, context) => {
    if (value.schedule_type === 'CRON' && !value.cron_expression) {
      context.addIssue({
        code: 'custom',
        path: ['cron_expression'],
        message: 'cron_expression là bắt buộc khi schedule_type=CRON',
      });
    }
    if (value.schedule_type === 'MANUAL' && value.cron_expression) {
      context.addIssue({
        code: 'custom',
        path: ['cron_expression'],
        message: 'cron_expression chỉ dùng cho schedule_type=CRON',
      });
    }
    if (value.type === 'MEDIA_UNUSED_CLEANUP') {
      const parsed = mediaCleanupRequestSchema.safeParse(value.payload);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          context.addIssue({
            code: 'custom',
            path: ['payload', ...issue.path],
            message: issue.message,
          });
        }
      }
    }
  });
export type CreateJobRequest = z.infer<typeof createJobRequestSchema>;

export const updateJobStatusRequestSchema = z.object({ status: backgroundJobStatusSchema });
export type UpdateJobStatusRequest = z.infer<typeof updateJobStatusRequestSchema>;

export const triggerJobRunRequestSchema = z.object({
  /** Cùng khóa cho cùng job luôn trả về cùng một run. */
  idempotency_key: z.string().trim().min(1).max(128),
});
export type TriggerJobRunRequest = z.infer<typeof triggerJobRunRequestSchema>;

export const listJobsQuerySchema = paginationQuerySchema.extend({
  status: backgroundJobStatusSchema.optional(),
  type: backgroundJobTypeSchema.optional(),
});
export type ListJobsQuery = z.infer<typeof listJobsQuerySchema>;

export const listJobRunsQuerySchema = paginationQuerySchema.extend({
  status: jobRunStatusSchema.optional(),
});
export type ListJobRunsQuery = z.infer<typeof listJobRunsQuerySchema>;

// ---- Response --------------------------------------------------------------------------------

export const backgroundJobDtoSchema = z.object({
  id: idSchema,
  name: z.string(),
  type: backgroundJobTypeSchema,
  schedule_type: scheduleTypeSchema,
  cron_expression: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()),
  status: backgroundJobStatusSchema,
  allow_concurrent: z.boolean(),
  next_run_at: dateTime.nullable(),
  created_by: idSchema.nullable(),
  created_at: dateTime,
  updated_at: dateTime,
});
export type BackgroundJobDto = z.infer<typeof backgroundJobDtoSchema>;

export const backgroundJobRunDtoSchema = z.object({
  id: idSchema,
  job_id: idSchema,
  trigger_type: runTriggerTypeSchema,
  idempotency_key: z.string(),
  status: jobRunStatusSchema,
  attempts: z.number().int().min(0),
  scheduled_at: dateTime,
  started_at: dateTime.nullable(),
  finished_at: dateTime.nullable(),
  worker_instance: z.string().nullable(),
  /** Mã lỗi ổn định của run (xem contract §4.6), không phải mã HTTP. */
  error_code: z.string().nullable(),
  error_message: z.string().nullable(),
  /** Tóm tắt an toàn của lượt chạy; không phải dữ liệu nghiệp vụ. */
  output: z.record(z.string(), z.unknown()).nullable(),
  created_by: idSchema.nullable(),
  created_at: dateTime,
});
export type BackgroundJobRunDto = z.infer<typeof backgroundJobRunDtoSchema>;

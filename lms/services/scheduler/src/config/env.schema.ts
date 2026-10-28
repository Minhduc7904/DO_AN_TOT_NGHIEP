import {
  baseEnvironmentSchema,
  parseEnvironment,
  serviceAuthEnvironmentShape,
  serviceClientEnvironmentShape,
} from '@aiops-lms/common/config';
import { z } from 'zod';

const positiveInt = (
  min: number,
  max: number,
  fallback: number,
): z.ZodDefault<z.ZodCoercedNumber> => z.coerce.number().int().min(min).max(max).default(fallback);

const apiSchema = baseEnvironmentSchema.extend({
  ...serviceAuthEnvironmentShape,
  PORT: positiveInt(1, 65_535, 3008),
  SCHEDULER_DATABASE_URL: z.url(),
});

const workerSchema = baseEnvironmentSchema
  .extend({
    ...serviceAuthEnvironmentShape,
    ...serviceClientEnvironmentShape,
    PORT: positiveInt(1, 65_535, 3010),
    SCHEDULER_DATABASE_URL: z.url(),
    /** Chờ giữa hai lượt nhận run khi hàng đợi rỗng. */
    SCHEDULER_WORKER_POLL_MS: positiveInt(50, 60_000, 1_000),
    /** Số run một instance chạy song song. */
    SCHEDULER_WORKER_CONCURRENCY: positiveInt(1, 20, 2),
    /** Chu kỳ quét job CRON đến hạn. */
    SCHEDULER_CRON_TICK_MS: positiveInt(50, 300_000, 5_000),
    SCHEDULER_CRON_BATCH_SIZE: positiveInt(1, 500, 20),
    /** Thời gian giữ lease một run; phải dài hơn `SCHEDULER_MEDIA_TIMEOUT_MS`. */
    SCHEDULER_RUN_LEASE_MS: positiveInt(1_000, 3_600_000, 120_000),
    /** Số lần tối đa một run được nhận (kể cả nhận lại sau khi worker chết). */
    SCHEDULER_RUN_MAX_ATTEMPTS: positiveInt(1, 20, 3),
    SCHEDULER_MEDIA_BASE_URL: z.url().default('http://localhost:3004'),
    SCHEDULER_MEDIA_TIMEOUT_MS: positiveInt(100, 600_000, 60_000),
    SCHEDULER_MEDIA_BREAKER_THRESHOLD: positiveInt(1, 100, 3),
    SCHEDULER_MEDIA_BREAKER_COOLDOWN_MS: positiveInt(1, 300_000, 5_000),
  })
  .refine((env) => env.SCHEDULER_RUN_LEASE_MS > env.SCHEDULER_MEDIA_TIMEOUT_MS, {
    path: ['SCHEDULER_RUN_LEASE_MS'],
    message: 'SCHEDULER_RUN_LEASE_MS phải lớn hơn SCHEDULER_MEDIA_TIMEOUT_MS',
  });

export type Environment = z.infer<typeof apiSchema>;
export type WorkerEnvironment = z.infer<typeof workerSchema>;

export function validateEnvironment(config: Record<string, unknown>): Environment {
  return parseEnvironment(apiSchema, config);
}

export function validateWorkerEnvironment(config: Record<string, unknown>): WorkerEnvironment {
  return parseEnvironment(workerSchema, config);
}

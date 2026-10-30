import {
  baseEnvironmentSchema,
  environmentBoolean,
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

const sharedShape = {
  NOTIFICATION_DATABASE_URL: z.url(),
  NOTIFICATION_RABBITMQ_URL: z.url().default('amqp://lms:lms-local-only@localhost:5672'),
  NOTIFICATION_RABBITMQ_CONNECT_TIMEOUT_MS: positiveInt(100, 60_000, 5_000),
  NOTIFICATION_RABBITMQ_CONFIRM_TIMEOUT_MS: positiveInt(100, 60_000, 3_000),
  NOTIFICATION_OUTBOX_POLL_MS: positiveInt(50, 60_000, 500),
  NOTIFICATION_OUTBOX_BATCH_SIZE: positiveInt(1, 500, 20),
  NOTIFICATION_OUTBOX_LEASE_MS: positiveInt(1_000, 300_000, 30_000),
};

const apiSchema = baseEnvironmentSchema.extend({
  ...serviceAuthEnvironmentShape,
  ...sharedShape,
  PORT: positiveInt(1, 65_535, 3006),
});

const workerSchema = baseEnvironmentSchema.extend({
  ...serviceAuthEnvironmentShape,
  ...serviceClientEnvironmentShape,
  ...sharedShape,
  PORT: positiveInt(1, 65_535, 3007),
  NOTIFICATION_WORKER_PREFETCH: positiveInt(1, 100, 4),
  NOTIFICATION_WORKER_MAX_ATTEMPTS: positiveInt(1, 20, 5),
  NOTIFICATION_WORKER_RETRY_DELAY_MS: positiveInt(0, 300_000, 1_000),
  NOTIFICATION_IDENTITY_BASE_URL: z.url().default('http://localhost:3001'),
  NOTIFICATION_IDENTITY_TIMEOUT_MS: positiveInt(100, 60_000, 3_000),
  NOTIFICATION_IDENTITY_BREAKER_THRESHOLD: positiveInt(1, 100, 3),
  NOTIFICATION_IDENTITY_BREAKER_COOLDOWN_MS: positiveInt(1, 300_000, 5_000),
  NOTIFICATION_SMTP_HOST: z.string().trim().min(1).default('localhost'),
  NOTIFICATION_SMTP_PORT: positiveInt(1, 65_535, 1_025),
  NOTIFICATION_SMTP_SECURE: environmentBoolean.default(false),
  NOTIFICATION_SMTP_USER: z.string().optional(),
  NOTIFICATION_SMTP_PASSWORD: z.string().optional(),
  NOTIFICATION_SMTP_FROM: z.string().trim().min(3).default('LMS <no-reply@lms.local>'),
  NOTIFICATION_SMTP_TIMEOUT_MS: positiveInt(100, 120_000, 5_000),
  /** Số lần gửi tối đa cho một recipient trước khi item `FAILED`. */
  NOTIFICATION_ITEM_MAX_ATTEMPTS: positiveInt(1, 20, 3),
  NOTIFICATION_ITEM_RETRY_DELAY_MS: positiveInt(0, 600_000, 1_000),
  NOTIFICATION_DISPATCH_LEASE_MS: positiveInt(1_000, 3_600_000, 120_000),
  NOTIFICATION_DISPATCH_CONCURRENCY: positiveInt(1, 50, 5),
  NOTIFICATION_DISPATCH_IDLE_WAIT_MS: positiveInt(0, 60_000, 5_000),
});

export type Environment = z.infer<typeof apiSchema>;
export type WorkerEnvironment = z.infer<typeof workerSchema>;

export function validateEnvironment(config: Record<string, unknown>): Environment {
  return parseEnvironment(apiSchema, config);
}

export function validateWorkerEnvironment(config: Record<string, unknown>): WorkerEnvironment {
  return parseEnvironment(workerSchema, config);
}

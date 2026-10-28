import {
  baseEnvironmentSchema,
  parseEnvironment,
  serviceAuthEnvironmentShape,
  serviceClientEnvironmentShape,
} from '@aiops-lms/common/config';
import { z } from 'zod';

const ENCRYPTION_KEY_BYTES = 32;

/** Khóa AES-256 dạng base64 (đúng 32 byte); service từ chối khởi động nếu thiếu hoặc sai độ dài. */
const encryptionKey = z
  .string()
  .refine(
    (value) =>
      /^[A-Za-z0-9+/]+={0,2}$/u.test(value) &&
      Buffer.from(value, 'base64').length === ENCRYPTION_KEY_BYTES,
    'AI_ENCRYPTION_KEY phải là base64 của đúng 32 byte (ví dụ: openssl rand -base64 32)',
  );

const positiveInt = (
  min: number,
  max: number,
  fallback: number,
): z.ZodDefault<z.ZodCoercedNumber> => z.coerce.number().int().min(min).max(max).default(fallback);

/** Cấu hình dùng chung cho `ai` (API) và `ai-worker`: cùng DB, cùng khóa mã hóa, cùng outbox. */
const sharedShape = {
  AI_DATABASE_URL: z.url(),
  AI_ENCRYPTION_KEY: encryptionKey,
  /** Timeout một lượt gọi chat-completions tới provider (đọc tài liệu dài nên lớn). */
  AI_COMPLETION_TIMEOUT_MS: positiveInt(100, 600_000, 240_000),
  AI_RABBITMQ_URL: z.url().default('amqp://lms:lms-local-only@localhost:5672'),
  AI_RABBITMQ_CONNECT_TIMEOUT_MS: positiveInt(100, 60_000, 5_000),
  AI_RABBITMQ_CONFIRM_TIMEOUT_MS: positiveInt(100, 60_000, 3_000),
  AI_OUTBOX_POLL_MS: positiveInt(50, 60_000, 500),
  AI_OUTBOX_BATCH_SIZE: positiveInt(1, 500, 20),
  AI_OUTBOX_LEASE_MS: positiveInt(1_000, 300_000, 30_000),
};

const apiSchema = baseEnvironmentSchema.extend({
  ...serviceAuthEnvironmentShape,
  ...sharedShape,
  PORT: positiveInt(1, 65_535, 3009),
  /** Timeout health check `GET {base}/models`. */
  AI_HEALTH_CHECK_TIMEOUT_MS: positiveInt(100, 60_000, 6_000),
});

const workerSchema = baseEnvironmentSchema.extend({
  ...serviceAuthEnvironmentShape,
  ...serviceClientEnvironmentShape,
  ...sharedShape,
  PORT: positiveInt(1, 65_535, 3011),
  AI_WORKER_PREFETCH: positiveInt(1, 100, 2),
  AI_WORKER_MAX_ATTEMPTS: positiveInt(1, 20, 5),
  AI_WORKER_RETRY_DELAY_MS: positiveInt(0, 300_000, 1_000),
  /**
   * Lease của tài liệu/job; job được gia hạn lease trước mỗi lượt gọi model. Phải lớn hơn
   * `AI_COMPLETION_TIMEOUT_MS` (một lượt gọi provider) cộng thời gian ghi vào course.
   */
  AI_WORKER_LEASE_MS: positiveInt(1_000, 3_600_000, 600_000),
  AI_COURSE_BASE_URL: z.url().default('http://localhost:3003'),
  AI_COURSE_TIMEOUT_MS: positiveInt(100, 60_000, 5_000),
  AI_COURSE_BREAKER_THRESHOLD: positiveInt(1, 100, 3),
  AI_COURSE_BREAKER_COOLDOWN_MS: positiveInt(1, 300_000, 5_000),
  AI_MEDIA_BASE_URL: z.url().default('http://localhost:3004'),
  /** Tải byte tệp (tối đa 15 MB) nên dài hơn truy vấn thường. */
  AI_MEDIA_CONTENT_TIMEOUT_MS: positiveInt(100, 300_000, 30_000),
  AI_MEDIA_BREAKER_THRESHOLD: positiveInt(1, 100, 3),
  AI_MEDIA_BREAKER_COOLDOWN_MS: positiveInt(1, 300_000, 5_000),
});

export type Environment = z.infer<typeof apiSchema>;
export type WorkerEnvironment = z.infer<typeof workerSchema>;

export function validateEnvironment(config: Record<string, unknown>): Environment {
  return parseEnvironment(apiSchema, config);
}

export function validateWorkerEnvironment(config: Record<string, unknown>): WorkerEnvironment {
  return parseEnvironment(workerSchema, config);
}

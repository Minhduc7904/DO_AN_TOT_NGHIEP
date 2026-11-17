import {
  baseEnvironmentSchema,
  environmentBoolean,
  parseEnvironment,
  serviceAuthEnvironmentShape,
  serviceClientEnvironmentShape,
} from '@aiops-lms/common/config';
import { z } from 'zod';

const storageShape = {
  MEDIA_DATABASE_URL: z.url(),
  MEDIA_RABBITMQ_URL: z.url().default('amqp://lms:lms-local-only@localhost:5672'),
  MINIO_ENDPOINT: z.string().trim().min(1).default('localhost'),
  MINIO_PORT: z.coerce.number().int().min(1).max(65_535).default(9000),
  MINIO_USE_SSL: environmentBoolean.default(false),
  MINIO_ACCESS_KEY: z.string().trim().min(1).default('lms-minio'),
  MINIO_SECRET_KEY: z.string().min(8).default('lms-minio-local-only'),
};

const consumerShape = {
  MEDIA_RABBITMQ_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(5_000),
};

const apiSchema = baseEnvironmentSchema.extend({
  ...serviceAuthEnvironmentShape,
  ...serviceClientEnvironmentShape,
  ...storageShape,
  ...consumerShape,
  PORT: z.coerce.number().int().min(1).max(65_535).default(3004),
  /** Địa chỉ MinIO mà trình duyệt truy cập được; dùng để ký presigned POST. */
  MINIO_PUBLIC_URL: z.url().default('http://localhost:9000'),
  MEDIA_UPLOAD_EXPIRES_SECONDS: z.coerce.number().int().min(60).max(3_600).default(900),
  /** Giới hạn upload multipart qua `media`; file lớn hơn dùng upload-intents. */
  MEDIA_MULTIPART_MAX_BYTES: z.coerce
    .number()
    .int()
    .min(1_024)
    .max(524_288_000)
    .default(26_214_400),
  /** Cleanup (`POST /internal/v1/media/cleanup`): mặc định và biên của tham số trong body. */
  MEDIA_CLEANUP_DEFAULT_RETENTION_HOURS: z.coerce.number().int().min(0).max(8_760).default(168),
  MEDIA_CLEANUP_MIN_RETENTION_HOURS: z.coerce.number().int().min(0).max(8_760).default(1),
  MEDIA_CLEANUP_MAX_RETENTION_HOURS: z.coerce.number().int().min(0).max(8_760).default(8_760),
  MEDIA_CLEANUP_PENDING_GRACE_MINUTES: z.coerce.number().int().min(0).max(10_080).default(15),
  MEDIA_CLEANUP_DEFAULT_LIMIT: z.coerce.number().int().min(1).max(1_000).default(200),
  MEDIA_CLEANUP_MAX_LIMIT: z.coerce.number().int().min(1).max(1_000).default(1_000),
  MEDIA_IDENTITY_BASE_URL: z.url().default('http://localhost:3001'),
  MEDIA_IDENTITY_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(3_000),
  MEDIA_IDENTITY_BREAKER_THRESHOLD: z.coerce.number().int().min(1).max(100).default(3),
  MEDIA_IDENTITY_BREAKER_COOLDOWN_MS: z.coerce.number().int().min(1).max(300_000).default(5_000),
  MEDIA_OUTBOX_POLL_MS: z.coerce.number().int().min(50).max(60_000).default(500),
  MEDIA_OUTBOX_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(20),
  MEDIA_OUTBOX_LEASE_MS: z.coerce.number().int().min(1_000).max(300_000).default(30_000),
  MEDIA_RABBITMQ_CONFIRM_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(3_000),
});

const workerSchema = baseEnvironmentSchema.extend({
  ...storageShape,
  ...consumerShape,
  PORT: z.coerce.number().int().min(1).max(65_535).default(3005),
  MEDIA_RABBITMQ_CONFIRM_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(3_000),
  MEDIA_WORKER_PREFETCH: z.coerce.number().int().min(1).max(100).default(4),
  MEDIA_WORKER_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
  MEDIA_WORKER_RETRY_DELAY_MS: z.coerce.number().int().min(0).max(300_000).default(1_000),
  MEDIA_THUMBNAIL_MAX_EDGE_PX: z.coerce.number().int().min(32).max(2_048).default(480),
  MEDIA_THUMBNAIL_QUALITY: z.coerce.number().int().min(1).max(100).default(80),
  MEDIA_FFMPEG_PATH: z.string().trim().min(1).default('ffmpeg'),
  MEDIA_FFMPEG_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(300_000).default(30_000),
});

export type Environment = z.infer<typeof apiSchema>;
export type WorkerEnvironment = z.infer<typeof workerSchema>;

export function validateEnvironment(config: Record<string, unknown>): Environment {
  return parseEnvironment(apiSchema, config);
}

export function validateWorkerEnvironment(config: Record<string, unknown>): WorkerEnvironment {
  return parseEnvironment(workerSchema, config);
}

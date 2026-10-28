import {
  baseEnvironmentSchema,
  parseEnvironment,
  serviceAuthEnvironmentShape,
  serviceClientEnvironmentShape,
} from '@aiops-lms/common/config';
import { z } from 'zod';

const environmentSchema = baseEnvironmentSchema.extend({
  ...serviceAuthEnvironmentShape,
  ...serviceClientEnvironmentShape,
  PORT: z.coerce.number().int().min(1).max(65_535).default(3003),
  COURSE_DATABASE_URL: z.url(),
  COURSE_RABBITMQ_URL: z.url().default('amqp://lms:lms-local-only@localhost:5672'),
  COURSE_RABBITMQ_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(5_000),
  COURSE_RABBITMQ_CONFIRM_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(3_000),
  COURSE_OUTBOX_POLL_MS: z.coerce.number().int().min(50).max(60_000).default(500),
  COURSE_OUTBOX_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(20),
  COURSE_OUTBOX_LEASE_MS: z.coerce.number().int().min(1_000).max(300_000).default(30_000),
  COURSE_MEDIA_BASE_URL: z.url().default('http://localhost:3004'),
  COURSE_MEDIA_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(3_000),
  COURSE_MEDIA_BREAKER_THRESHOLD: z.coerce.number().int().min(1).max(100).default(3),
  COURSE_MEDIA_BREAKER_COOLDOWN_MS: z.coerce.number().int().min(1).max(300_000).default(5_000),
  COURSE_AI_BASE_URL: z.url().default('http://localhost:3009'),
  /** Các route nội bộ của `ai` (tài liệu, job) chỉ đọc/ghi DB và outbox nên ngắn như truy vấn thường. */
  COURSE_AI_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(5_000),
  COURSE_AI_BREAKER_THRESHOLD: z.coerce.number().int().min(1).max(100).default(3),
  COURSE_AI_BREAKER_COOLDOWN_MS: z.coerce.number().int().min(1).max(300_000).default(5_000),
});

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(config: Record<string, unknown>): Environment {
  return parseEnvironment(environmentSchema, config);
}

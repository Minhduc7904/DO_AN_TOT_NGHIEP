import { baseEnvironmentSchema, parseEnvironment } from '@aiops-lms/common/config';
import { z } from 'zod';

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === '' ? undefined : value))
  .optional();

const environmentSchema = baseEnvironmentSchema.extend({
  PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  AUTH_DATABASE_URL: z.url(),
  AUTH_JWT_SECRET: z.string().min(32),
  AUTH_JWT_TTL_SECONDS: z.coerce.number().int().min(60).max(86_400).default(3_600),
  AUTH_REFRESH_TTL_SECONDS: z.coerce.number().int().min(300).max(2_592_000).default(86_400),
  AUTH_STUDENT_BASE_URL: z.url().default('http://localhost:3002'),
  AUTH_STUDENT_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(3_000),
  AUTH_STUDENT_BREAKER_THRESHOLD: z.coerce.number().int().min(1).max(100).default(3),
  AUTH_STUDENT_BREAKER_COOLDOWN_MS: z.coerce.number().int().min(1).max(300_000).default(5_000),
  AUTH_BOOTSTRAP_STUDENT_ID: z.uuid().default('11111111-1111-4111-8111-111111111111'),
  AUTH_BOOTSTRAP_STUDENT_EMAIL: optionalText,
  AUTH_BOOTSTRAP_STUDENT_PASSWORD: optionalText,
  // Tài khoản seed khi khởi động; bỏ trống cả email lẫn mật khẩu thì bỏ qua tài khoản đó.
  AUTH_BOOTSTRAP_ADMIN_ID: z.uuid().default('00000000-0000-4000-8000-000000000001'),
  AUTH_BOOTSTRAP_ADMIN_EMAIL: optionalText,
  AUTH_BOOTSTRAP_ADMIN_PASSWORD: optionalText,
  AUTH_BOOTSTRAP_INSTRUCTOR_ID: z.uuid().default('22222222-2222-4222-8222-222222222222'),
  AUTH_BOOTSTRAP_INSTRUCTOR_EMAIL: optionalText,
  AUTH_BOOTSTRAP_INSTRUCTOR_PASSWORD: optionalText,
});

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(config: Record<string, unknown>): Environment {
  return parseEnvironment(environmentSchema, config);
}

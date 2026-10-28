import {
  baseEnvironmentSchema,
  jwksCacheEnvironmentShape,
  parseEnvironment,
  serviceClientEnvironmentShape,
} from '@aiops-lms/common/config';
import { z } from 'zod';

const baseUrl = (port: number): z.ZodDefault<z.ZodURL> =>
  z.url().default(`http://localhost:${port}`);

const environmentSchema = baseEnvironmentSchema.extend({
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  // Danh tính của Gateway với auth (client-credentials) và cache JWKS để verify user token.
  ...serviceClientEnvironmentShape,
  ...jwksCacheEnvironmentShape,
  // Timeout tới khi upstream trả header phản hồi; phần body stream sau đó không bị giới hạn.
  GATEWAY_UPSTREAM_TIMEOUT_MS: z.coerce.number().int().min(100).max(300_000).default(30_000),
  GATEWAY_AUTH_BASE_URL: baseUrl(3001),
  GATEWAY_STUDENT_BASE_URL: baseUrl(3002),
  GATEWAY_COURSE_BASE_URL: baseUrl(3003),
  GATEWAY_MEDIA_BASE_URL: baseUrl(3004),
  GATEWAY_NOTIFICATION_BASE_URL: baseUrl(3005),
  GATEWAY_SCHEDULER_BASE_URL: baseUrl(3006),
  GATEWAY_AI_BASE_URL: baseUrl(3007),
});

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(config: Record<string, unknown>): Environment {
  return parseEnvironment(environmentSchema, config);
}

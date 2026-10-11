import { z } from 'zod';

import {
  DEFAULT_GRADE_COMPLETED_EXCHANGE,
  DEFAULT_GRADE_COMPLETED_QUEUE,
  DEFAULT_NOTIFICATION_CONSUMER_PREFETCH,
  DEFAULT_NOTIFICATION_CONSUMER_SLOWDOWN_ENABLED,
  DEFAULT_NOTIFICATION_CONSUMER_SLOWDOWN_MS,
  DEFAULT_NOTIFICATION_RABBITMQ_URL,
  DEFAULT_OTLP_TRACES_ENDPOINT,
  DEFAULT_PORT,
  DEFAULT_SERVICE_INSTANCE_ID,
  DEFAULT_SERVICE_VERSION,
  NODE_ENVIRONMENTS,
} from './app-config.js';

const environmentBoolean = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((value) => value === true || value === 'true');

const environmentSchema = z.object({
  NODE_ENV: z.enum(NODE_ENVIRONMENTS).default('development'),
  NOTIFICATION_GRADE_COMPLETED_EXCHANGE: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .default(DEFAULT_GRADE_COMPLETED_EXCHANGE),
  NOTIFICATION_GRADE_COMPLETED_QUEUE: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .default(DEFAULT_GRADE_COMPLETED_QUEUE),
  NOTIFICATION_CONSUMER_PREFETCH: z.coerce
    .number()
    .int()
    .min(1)
    .max(32)
    .default(DEFAULT_NOTIFICATION_CONSUMER_PREFETCH),
  NOTIFICATION_CONSUMER_SLOWDOWN_ENABLED: environmentBoolean.default(
    DEFAULT_NOTIFICATION_CONSUMER_SLOWDOWN_ENABLED,
  ),
  NOTIFICATION_CONSUMER_SLOWDOWN_MS: z.coerce
    .number()
    .int()
    .min(0)
    .max(60_000)
    .default(DEFAULT_NOTIFICATION_CONSUMER_SLOWDOWN_MS),
  NOTIFICATION_RABBITMQ_URL: z.url().default(DEFAULT_NOTIFICATION_RABBITMQ_URL),
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: z.url().default(DEFAULT_OTLP_TRACES_ENDPOINT),
  OTEL_SDK_DISABLED: environmentBoolean.default(false),
  OTEL_SERVICE_INSTANCE_ID: z.string().trim().min(1).default(DEFAULT_SERVICE_INSTANCE_ID),
  OTEL_SERVICE_VERSION: z.string().trim().min(1).default(DEFAULT_SERVICE_VERSION),
  PORT: z.coerce.number().int().min(1).max(65_535).default(DEFAULT_PORT),
});

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(config: Record<string, unknown>): Environment {
  const result = environmentSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

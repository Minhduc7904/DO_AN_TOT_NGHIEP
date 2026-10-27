import { z } from 'zod';

export const environmentBoolean = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((value) => value === true || value === 'true');

/** Biến môi trường chung của mọi service/worker; service mở rộng bằng `.extend(...)`. */
export const baseEnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535),
  OTEL_SDK_DISABLED: environmentBoolean.default(false),
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: z.url().default('http://localhost:4318/v1/traces'),
  OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: z.url().optional(),
  OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: z.url().optional(),
  OTEL_METRIC_EXPORT_INTERVAL: z.coerce.number().int().min(1_000).max(60_000).default(5_000),
  OTEL_SERVICE_INSTANCE_ID: z.string().trim().min(1).default('local-1'),
  OTEL_SERVICE_VERSION: z.string().trim().min(1).default('0.1.0'),
  HTTP_ACCESS_LOG_ENABLED: environmentBoolean.default(true),
});

export type BaseEnvironment = z.infer<typeof baseEnvironmentSchema>;

export function parseEnvironment<TSchema extends z.ZodType>(
  schema: TSchema,
  config: Record<string, unknown>,
): z.infer<TSchema> {
  const result = schema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

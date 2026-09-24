import { z } from 'zod';

import {
  DEFAULT_OTLP_TRACES_ENDPOINT,
  DEFAULT_PORT,
  DEFAULT_SERVICE_INSTANCE_ID,
  DEFAULT_SERVICE_VERSION,
  DEFAULT_STORAGE_MOCK_ERROR_MODE,
  DEFAULT_STORAGE_MOCK_LATENCY_MS,
  NODE_ENVIRONMENTS,
} from './app-config.js';

const environmentBoolean = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((value) => value === true || value === 'true');

const environmentSchema = z.object({
  NODE_ENV: z.enum(NODE_ENVIRONMENTS).default('development'),
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: z.url().default(DEFAULT_OTLP_TRACES_ENDPOINT),
  OTEL_SDK_DISABLED: environmentBoolean.default(false),
  OTEL_SERVICE_INSTANCE_ID: z.string().trim().min(1).default(DEFAULT_SERVICE_INSTANCE_ID),
  OTEL_SERVICE_VERSION: z.string().trim().min(1).default(DEFAULT_SERVICE_VERSION),
  PORT: z.coerce.number().int().min(1).max(65_535).default(DEFAULT_PORT),
  STORAGE_MOCK_DEFAULT_LATENCY_MS: z.coerce
    .number()
    .int()
    .min(0)
    .max(60_000)
    .default(DEFAULT_STORAGE_MOCK_LATENCY_MS),
  STORAGE_MOCK_DEFAULT_ERROR_MODE: z
    .enum(['none', 'unavailable'])
    .default(DEFAULT_STORAGE_MOCK_ERROR_MODE),
});

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(config: Record<string, unknown>): Environment {
  const result = environmentSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

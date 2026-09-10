import { z } from 'zod';

import {
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

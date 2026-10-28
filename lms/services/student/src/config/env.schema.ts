import {
  baseEnvironmentSchema,
  parseEnvironment,
  serviceAuthEnvironmentShape,
} from '@aiops-lms/common/config';
import { z } from 'zod';

const environmentSchema = baseEnvironmentSchema.extend({
  ...serviceAuthEnvironmentShape,
  PORT: z.coerce.number().int().min(1).max(65_535).default(3002),
  STUDENT_DATABASE_URL: z.url(),
});

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(config: Record<string, unknown>): Environment {
  return parseEnvironment(environmentSchema, config);
}

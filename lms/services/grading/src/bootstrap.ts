import { createHttpTelemetryMiddleware } from '@aiops-lms/observability';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { DEFAULT_HOST } from './config/app-config.js';

export async function bootstrapApplication(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.use(createHttpTelemetryMiddleware());
  await app.listen(config.getOrThrow<number>('PORT'), DEFAULT_HOST);
  return app;
}

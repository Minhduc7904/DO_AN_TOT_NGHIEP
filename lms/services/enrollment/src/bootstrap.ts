import { createHttpTelemetryMiddleware } from '@aiops-lms/observability';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './adapters/http/http-exception.filter.js';
import { DEFAULT_HOST } from './config/app-config.js';

export async function bootstrapApplication(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.getOrThrow<number>('PORT');

  app.use(createHttpTelemetryMiddleware());
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(port, DEFAULT_HOST);
  return app;
}

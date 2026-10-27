import { AppExceptionFilter, correlationIdMiddleware } from '@aiops-lms/common/http';
import { createHttpTelemetryMiddleware, StructuredLogger } from '@aiops-lms/observability';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { DEFAULT_HOST } from './config/app-config.js';

export async function bootstrapApplication(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { logger: new StructuredLogger() });
  const config = app.get(ConfigService);

  app.use(correlationIdMiddleware);
  app.use(
    createHttpTelemetryMiddleware({
      accessLog: { enabled: config.getOrThrow<boolean>('HTTP_ACCESS_LOG_ENABLED') },
    }),
  );
  app.useGlobalFilters(new AppExceptionFilter());
  app.enableShutdownHooks();
  await app.listen(config.getOrThrow<number>('PORT'), DEFAULT_HOST);
  return app;
}

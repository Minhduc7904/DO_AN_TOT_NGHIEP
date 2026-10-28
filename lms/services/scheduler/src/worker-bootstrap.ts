import { AppExceptionFilter, correlationIdMiddleware } from '@aiops-lms/common/http';
import { createHttpTelemetryMiddleware, StructuredLogger } from '@aiops-lms/observability';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { DEFAULT_HOST } from './config/app-config.js';
import { WorkerModule } from './worker.module.js';

/** Worker chỉ mở cổng HTTP cho `/health` và `/ready`; việc chính là các vòng nền nhận run. */
export async function bootstrapWorker(): Promise<INestApplication> {
  const app = await NestFactory.create(WorkerModule, { logger: new StructuredLogger() });
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

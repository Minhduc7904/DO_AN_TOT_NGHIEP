import { randomUUID } from 'node:crypto';

import { createHttpServiceAuth, SERVICE_AUTH } from '@aiops-lms/common/auth';
import { COMMON_HTTP_PROVIDERS, HealthController, READINESS_CHECKS } from '@aiops-lms/common/http';
import { type Clock, type IdGenerator, systemClock } from '@aiops-lms/common/ports';
import { Module, type Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { NotificationBatchController } from './adapters/http/public/notification-batch.controller.js';
import { NotificationController } from './adapters/http/public/notification.controller.js';
import { OutboxRelayService } from './adapters/messaging/outbox-relay.service.js';
import { PrismaService } from './adapters/persistence/prisma.service.js';
import { PrismaNotificationUnitOfWork } from './adapters/persistence/prisma-unit-of-work.js';
import {
  NOTIFICATION_UNIT_OF_WORK,
  type NotificationUnitOfWork,
} from './application/ports/unit-of-work.js';
import { CLOCK, ID_GENERATOR } from './application/runtime.js';
import {
  GetBatchDeliveryStatusUseCase,
  GetBatchSnapshotStatusUseCase,
  GetNotificationBatchUseCase,
  ListFailedBatchItemsUseCase,
  ListNotificationBatchesUseCase,
} from './application/use-cases/batches/batch-queries.use-cases.js';
import { CreateNotificationBatchUseCase } from './application/use-cases/batches/create-notification-batch.use-case.js';
import { RetryFailedBatchUseCase } from './application/use-cases/batches/retry-failed-batch.use-case.js';
import { CreateNotificationUseCase } from './application/use-cases/notifications/create-notification.use-case.js';
import {
  GetNotificationUseCase,
  ListMyNotificationsUseCase,
  MarkAllNotificationsReadUseCase,
  MarkNotificationReadUseCase,
} from './application/use-cases/notifications/inbox.use-cases.js';
import { NOTIFICATION_SERVICE_NAME } from './config/app-config.js';
import { type Environment, validateEnvironment } from './config/env.schema.js';

const uuidGenerator: IdGenerator = { next: () => randomUUID() };

type Config = ConfigService<Environment, true>;

const INFRASTRUCTURE: Provider[] = [
  PrismaService,
  OutboxRelayService,
  { provide: CLOCK, useValue: systemClock },
  { provide: ID_GENERATOR, useValue: uuidGenerator },
  {
    provide: NOTIFICATION_UNIT_OF_WORK,
    useFactory: (prisma: PrismaService, config: Config): NotificationUnitOfWork =>
      new PrismaNotificationUnitOfWork(prisma, {
        serviceName: NOTIFICATION_SERVICE_NAME,
        serviceVersion: config.getOrThrow('OTEL_SERVICE_VERSION'),
      }),
    inject: [PrismaService, ConfigService],
  },
  {
    provide: SERVICE_AUTH,
    useFactory: (config: Config) =>
      createHttpServiceAuth(NOTIFICATION_SERVICE_NAME, {
        baseUrl: config.getOrThrow('IDENTITY_BASE_URL'),
        timeoutMs: config.getOrThrow('IDENTITY_JWKS_TIMEOUT_MS'),
        cacheTtlMs: config.getOrThrow('IDENTITY_JWKS_CACHE_TTL_MS'),
        minRefetchIntervalMs: config.getOrThrow('IDENTITY_JWKS_MIN_REFETCH_MS'),
      }),
    inject: [ConfigService],
  },
  {
    provide: READINESS_CHECKS,
    useFactory: (prisma: PrismaService) => ({ postgres: () => prisma.ping() }),
    inject: [PrismaService],
  },
];

const withUow = (...useCases: (new (uow: NotificationUnitOfWork) => unknown)[]): Provider[] =>
  useCases.map((useCase) => ({
    provide: useCase,
    useFactory: (uow: NotificationUnitOfWork) => new useCase(uow),
    inject: [NOTIFICATION_UNIT_OF_WORK],
  }));

const withUowAndIds = (
  ...useCases: (new (uow: NotificationUnitOfWork, ids: IdGenerator) => unknown)[]
): Provider[] =>
  useCases.map((useCase) => ({
    provide: useCase,
    useFactory: (uow: NotificationUnitOfWork, ids: IdGenerator) => new useCase(uow, ids),
    inject: [NOTIFICATION_UNIT_OF_WORK, ID_GENERATOR],
  }));

const withUowAndClock = (
  ...useCases: (new (uow: NotificationUnitOfWork, clock: Clock) => unknown)[]
): Provider[] =>
  useCases.map((useCase) => ({
    provide: useCase,
    useFactory: (uow: NotificationUnitOfWork, clock: Clock) => new useCase(uow, clock),
    inject: [NOTIFICATION_UNIT_OF_WORK, CLOCK],
  }));

const USE_CASES: Provider[] = [
  ...withUowAndIds(
    CreateNotificationUseCase,
    CreateNotificationBatchUseCase,
    RetryFailedBatchUseCase,
  ),
  ...withUowAndClock(MarkNotificationReadUseCase, MarkAllNotificationsReadUseCase),
  ...withUow(
    GetNotificationUseCase,
    ListMyNotificationsUseCase,
    ListNotificationBatchesUseCase,
    GetNotificationBatchUseCase,
    GetBatchSnapshotStatusUseCase,
    GetBatchDeliveryStatusUseCase,
    ListFailedBatchItemsUseCase,
  ),
];

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment })],
  controllers: [HealthController, NotificationController, NotificationBatchController],
  providers: [...COMMON_HTTP_PROVIDERS, ...INFRASTRUCTURE, ...USE_CASES],
})
export class AppModule {}

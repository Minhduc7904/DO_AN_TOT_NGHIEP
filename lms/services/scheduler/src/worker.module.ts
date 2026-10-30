import { randomUUID } from 'node:crypto';

import {
  HttpServiceTokenSource,
  SERVICE_TOKEN_PROVIDER,
  ServiceTokenProvider,
  type TokenProvider,
} from '@aiops-lms/common/auth';
import { ENVELOPE_PROVIDERS, HealthController, READINESS_CHECKS } from '@aiops-lms/common/http';
import { type Clock, type IdGenerator, systemClock } from '@aiops-lms/common/ports';
import { Module, type Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { MediaCleanupHandler } from './adapters/clients/media-cleanup.handler.js';
import { PrismaSchedulerUnitOfWork } from './adapters/persistence/prisma-unit-of-work.js';
import { PrismaService } from './adapters/persistence/prisma.service.js';
import { SchedulerWorkerRunner } from './adapters/runtime/scheduler-worker.runner.js';
import { JOB_HANDLERS, type JobHandlers } from './application/ports/job-handler.js';
import {
  SCHEDULER_UNIT_OF_WORK,
  type SchedulerUnitOfWork,
} from './application/ports/unit-of-work.js';
import { CLOCK, ID_GENERATOR } from './application/runtime.js';
import { ExecuteNextRunUseCase } from './application/use-cases/worker/execute-next-run.use-case.js';
import { TickCronJobsUseCase } from './application/use-cases/worker/tick-cron-jobs.use-case.js';
import { SCHEDULER_WORKER_SERVICE_NAME } from './config/app-config.js';
import { type WorkerEnvironment, validateWorkerEnvironment } from './config/env.schema.js';

type Config = ConfigService<WorkerEnvironment, true>;

const uuidGenerator: IdGenerator = { next: () => randomUUID() };

const PROVIDERS: Provider[] = [
  ...ENVELOPE_PROVIDERS,
  PrismaService,
  MediaCleanupHandler,
  SchedulerWorkerRunner,
  { provide: CLOCK, useValue: systemClock },
  { provide: ID_GENERATOR, useValue: uuidGenerator },
  {
    provide: SCHEDULER_UNIT_OF_WORK,
    useFactory: (prisma: PrismaService): SchedulerUnitOfWork =>
      new PrismaSchedulerUnitOfWork(prisma),
    inject: [PrismaService],
  },
  {
    provide: SERVICE_TOKEN_PROVIDER,
    useFactory: (config: Config): TokenProvider =>
      new ServiceTokenProvider(
        new HttpServiceTokenSource({
          dependency: 'scheduler-worker-identity-token',
          baseUrl: config.getOrThrow('IDENTITY_BASE_URL'),
          clientId: config.getOrThrow('SERVICE_CLIENT_ID'),
          clientSecret: config.getOrThrow('SERVICE_CLIENT_SECRET'),
          timeoutMs: config.getOrThrow('IDENTITY_TOKEN_TIMEOUT_MS'),
          breaker: {
            failureThreshold: config.getOrThrow('IDENTITY_TOKEN_BREAKER_THRESHOLD'),
            cooldownMs: config.getOrThrow('IDENTITY_TOKEN_BREAKER_COOLDOWN_MS'),
          },
        }),
      ),
    inject: [ConfigService],
  },
  {
    // Mỗi loại job một handler; thêm loại job mới = thêm một dòng ở đây và một enum ở contract.
    provide: JOB_HANDLERS,
    useFactory: (mediaCleanup: MediaCleanupHandler): JobHandlers => ({
      MEDIA_UNUSED_CLEANUP: mediaCleanup,
    }),
    inject: [MediaCleanupHandler],
  },
  {
    provide: TickCronJobsUseCase,
    useFactory: (uow: SchedulerUnitOfWork, ids: IdGenerator, clock: Clock, config: Config) =>
      new TickCronJobsUseCase(uow, ids, clock, config.getOrThrow('SCHEDULER_CRON_BATCH_SIZE')),
    inject: [SCHEDULER_UNIT_OF_WORK, ID_GENERATOR, CLOCK, ConfigService],
  },
  {
    provide: ExecuteNextRunUseCase,
    useFactory: (
      uow: SchedulerUnitOfWork,
      handlers: JobHandlers,
      ids: IdGenerator,
      clock: Clock,
      config: Config,
    ) =>
      new ExecuteNextRunUseCase(uow, handlers, ids, clock, {
        leaseMs: config.getOrThrow('SCHEDULER_RUN_LEASE_MS'),
        maxAttempts: config.getOrThrow('SCHEDULER_RUN_MAX_ATTEMPTS'),
        workerInstance: `${SCHEDULER_WORKER_SERVICE_NAME}@${config.getOrThrow('OTEL_SERVICE_INSTANCE_ID')}`,
      }),
    inject: [SCHEDULER_UNIT_OF_WORK, JOB_HANDLERS, ID_GENERATOR, CLOCK, ConfigService],
  },
  {
    provide: READINESS_CHECKS,
    useFactory: (prisma: PrismaService, runner: SchedulerWorkerRunner) => ({
      postgres: () => prisma.ping(),
      loops: () =>
        runner.isReady() ? Promise.resolve() : Promise.reject(new Error('vòng nền chưa chạy')),
    }),
    inject: [PrismaService, SchedulerWorkerRunner],
  },
];

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateWorkerEnvironment })],
  controllers: [HealthController],
  providers: PROVIDERS,
})
export class WorkerModule {}

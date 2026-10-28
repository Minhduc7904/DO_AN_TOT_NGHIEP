import { randomUUID } from 'node:crypto';

import { createHttpServiceAuth, SERVICE_AUTH } from '@aiops-lms/common/auth';
import { COMMON_HTTP_PROVIDERS, HealthController, READINESS_CHECKS } from '@aiops-lms/common/http';
import { type Clock, type IdGenerator, systemClock } from '@aiops-lms/common/ports';
import { Module, type Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { SchedulerController } from './adapters/http/public/scheduler.controller.js';
import { PrismaSchedulerUnitOfWork } from './adapters/persistence/prisma-unit-of-work.js';
import { PrismaService } from './adapters/persistence/prisma.service.js';
import {
  SCHEDULER_UNIT_OF_WORK,
  type SchedulerUnitOfWork,
} from './application/ports/unit-of-work.js';
import { CLOCK, ID_GENERATOR } from './application/runtime.js';
import { CreateJobUseCase } from './application/use-cases/jobs/create-job.use-case.js';
import {
  GetJobUseCase,
  ListJobRunsUseCase,
  ListJobsUseCase,
} from './application/use-cases/jobs/job-queries.use-cases.js';
import { TriggerJobRunUseCase } from './application/use-cases/jobs/trigger-job-run.use-case.js';
import { UpdateJobStatusUseCase } from './application/use-cases/jobs/update-job-status.use-case.js';
import { SCHEDULER_SERVICE_NAME } from './config/app-config.js';
import { type Environment, validateEnvironment } from './config/env.schema.js';

const uuidGenerator: IdGenerator = { next: () => randomUUID() };

type Config = ConfigService<Environment, true>;

const INFRASTRUCTURE: Provider[] = [
  PrismaService,
  { provide: CLOCK, useValue: systemClock },
  { provide: ID_GENERATOR, useValue: uuidGenerator },
  {
    provide: SCHEDULER_UNIT_OF_WORK,
    useFactory: (prisma: PrismaService): SchedulerUnitOfWork =>
      new PrismaSchedulerUnitOfWork(prisma),
    inject: [PrismaService],
  },
  {
    provide: SERVICE_AUTH,
    useFactory: (config: Config) =>
      createHttpServiceAuth(SCHEDULER_SERVICE_NAME, {
        baseUrl: config.getOrThrow('AUTH_BASE_URL'),
        timeoutMs: config.getOrThrow('AUTH_JWKS_TIMEOUT_MS'),
        cacheTtlMs: config.getOrThrow('AUTH_JWKS_CACHE_TTL_MS'),
        minRefetchIntervalMs: config.getOrThrow('AUTH_JWKS_MIN_REFETCH_MS'),
      }),
    inject: [ConfigService],
  },
  {
    provide: READINESS_CHECKS,
    useFactory: (prisma: PrismaService) => ({ postgres: () => prisma.ping() }),
    inject: [PrismaService],
  },
];

const withUow = (...useCases: (new (uow: SchedulerUnitOfWork) => unknown)[]): Provider[] =>
  useCases.map((useCase) => ({
    provide: useCase,
    useFactory: (uow: SchedulerUnitOfWork) => new useCase(uow),
    inject: [SCHEDULER_UNIT_OF_WORK],
  }));

const USE_CASES: Provider[] = [
  ...withUow(ListJobsUseCase, GetJobUseCase, ListJobRunsUseCase),
  {
    provide: CreateJobUseCase,
    useFactory: (uow: SchedulerUnitOfWork, ids: IdGenerator, clock: Clock) =>
      new CreateJobUseCase(uow, ids, clock),
    inject: [SCHEDULER_UNIT_OF_WORK, ID_GENERATOR, CLOCK],
  },
  {
    provide: UpdateJobStatusUseCase,
    useFactory: (uow: SchedulerUnitOfWork, clock: Clock) => new UpdateJobStatusUseCase(uow, clock),
    inject: [SCHEDULER_UNIT_OF_WORK, CLOCK],
  },
  {
    provide: TriggerJobRunUseCase,
    useFactory: (uow: SchedulerUnitOfWork, ids: IdGenerator, clock: Clock) =>
      new TriggerJobRunUseCase(uow, ids, clock),
    inject: [SCHEDULER_UNIT_OF_WORK, ID_GENERATOR, CLOCK],
  },
];

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment })],
  controllers: [HealthController, SchedulerController],
  providers: [...COMMON_HTTP_PROVIDERS, ...INFRASTRUCTURE, ...USE_CASES],
})
export class AppModule {}

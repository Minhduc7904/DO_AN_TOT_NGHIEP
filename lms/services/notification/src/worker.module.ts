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

import { StudentHttpClient } from './adapters/clients/student-http.client.js';
import { SmtpEmailSender } from './adapters/mail/smtp-email.sender.js';
import { NotificationWorkerRunner } from './adapters/messaging/notification-worker.runner.js';
import { createRabbitMq } from './adapters/messaging/rabbitmq.js';
import { OutboxRelayService } from './adapters/messaging/outbox-relay.service.js';
import { PrismaService } from './adapters/persistence/prisma.service.js';
import { PrismaNotificationUnitOfWork } from './adapters/persistence/prisma-unit-of-work.js';
import { EMAIL_SENDER, type EmailSender } from './application/ports/email-sender.js';
import { STUDENT_DIRECTORY, type StudentDirectory } from './application/ports/student-directory.js';
import {
  NOTIFICATION_UNIT_OF_WORK,
  type NotificationUnitOfWork,
} from './application/ports/unit-of-work.js';
import { CLOCK, ID_GENERATOR } from './application/runtime.js';
import { DispatchBatchUseCase } from './application/use-cases/worker/dispatch-batch.use-case.js';
import { DispatchSingleNotificationUseCase } from './application/use-cases/worker/dispatch-single.use-case.js';
import { FailBatchUseCase } from './application/use-cases/worker/fail-batch.use-case.js';
import { SnapshotBatchUseCase } from './application/use-cases/worker/snapshot-batch.use-case.js';
import { NOTIFICATION_WORKER_SERVICE_NAME } from './config/app-config.js';
import { type WorkerEnvironment, validateWorkerEnvironment } from './config/env.schema.js';

type Config = ConfigService<WorkerEnvironment, true>;

const uuidGenerator: IdGenerator = { next: () => randomUUID() };

const PROVIDERS: Provider[] = [
  ...ENVELOPE_PROVIDERS,
  PrismaService,
  StudentHttpClient,
  // Worker cũng ghi command vào outbox (dispatch kế tiếp, lệnh media) nên cần relay riêng.
  OutboxRelayService,
  { provide: CLOCK, useValue: systemClock },
  { provide: ID_GENERATOR, useValue: uuidGenerator },
  { provide: STUDENT_DIRECTORY, useExisting: StudentHttpClient },
  {
    provide: NOTIFICATION_UNIT_OF_WORK,
    useFactory: (prisma: PrismaService, config: Config): NotificationUnitOfWork =>
      new PrismaNotificationUnitOfWork(prisma, {
        serviceName: NOTIFICATION_WORKER_SERVICE_NAME,
        serviceVersion: config.getOrThrow('OTEL_SERVICE_VERSION'),
      }),
    inject: [PrismaService, ConfigService],
  },
  {
    provide: SERVICE_TOKEN_PROVIDER,
    useFactory: (config: Config): TokenProvider =>
      new ServiceTokenProvider(
        new HttpServiceTokenSource({
          dependency: 'notification-worker-identity-token',
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
    provide: EMAIL_SENDER,
    useFactory: (config: Config): EmailSender =>
      new SmtpEmailSender({
        host: config.getOrThrow('NOTIFICATION_SMTP_HOST'),
        port: config.getOrThrow('NOTIFICATION_SMTP_PORT'),
        secure: config.getOrThrow('NOTIFICATION_SMTP_SECURE'),
        user: config.get('NOTIFICATION_SMTP_USER'),
        password: config.get('NOTIFICATION_SMTP_PASSWORD'),
        from: config.getOrThrow('NOTIFICATION_SMTP_FROM'),
        timeoutMs: config.getOrThrow('NOTIFICATION_SMTP_TIMEOUT_MS'),
      }),
    inject: [ConfigService],
  },
  {
    provide: FailBatchUseCase,
    useFactory: (uow: NotificationUnitOfWork, clock: Clock) => new FailBatchUseCase(uow, clock),
    inject: [NOTIFICATION_UNIT_OF_WORK, CLOCK],
  },
  {
    provide: SnapshotBatchUseCase,
    useFactory: (
      uow: NotificationUnitOfWork,
      students: StudentDirectory,
      ids: IdGenerator,
      clock: Clock,
      failBatch: FailBatchUseCase,
    ) => new SnapshotBatchUseCase(uow, students, ids, clock, failBatch),
    inject: [NOTIFICATION_UNIT_OF_WORK, STUDENT_DIRECTORY, ID_GENERATOR, CLOCK, FailBatchUseCase],
  },
  {
    provide: DispatchBatchUseCase,
    useFactory: (
      uow: NotificationUnitOfWork,
      emails: EmailSender,
      ids: IdGenerator,
      clock: Clock,
      config: Config,
    ) =>
      new DispatchBatchUseCase(uow, emails, ids, clock, {
        leaseMs: config.getOrThrow('NOTIFICATION_DISPATCH_LEASE_MS'),
        maxAttempts: config.getOrThrow('NOTIFICATION_ITEM_MAX_ATTEMPTS'),
        retryBaseMs: config.getOrThrow('NOTIFICATION_ITEM_RETRY_DELAY_MS'),
        concurrency: config.getOrThrow('NOTIFICATION_DISPATCH_CONCURRENCY'),
        maxIdleWaitMs: config.getOrThrow('NOTIFICATION_DISPATCH_IDLE_WAIT_MS'),
      }),
    inject: [NOTIFICATION_UNIT_OF_WORK, EMAIL_SENDER, ID_GENERATOR, CLOCK, ConfigService],
  },
  {
    provide: DispatchSingleNotificationUseCase,
    useFactory: (uow: NotificationUnitOfWork, students: StudentDirectory, emails: EmailSender) =>
      new DispatchSingleNotificationUseCase(uow, students, emails),
    inject: [NOTIFICATION_UNIT_OF_WORK, STUDENT_DIRECTORY, EMAIL_SENDER],
  },
  {
    provide: NotificationWorkerRunner,
    useFactory: (
      config: Config,
      snapshot: SnapshotBatchUseCase,
      dispatch: DispatchBatchUseCase,
      single: DispatchSingleNotificationUseCase,
      failBatch: FailBatchUseCase,
    ) => {
      const { session, publisher } = createRabbitMq(
        {
          url: config.getOrThrow('NOTIFICATION_RABBITMQ_URL'),
          connectTimeoutMs: config.getOrThrow('NOTIFICATION_RABBITMQ_CONNECT_TIMEOUT_MS'),
          confirmTimeoutMs: config.getOrThrow('NOTIFICATION_RABBITMQ_CONFIRM_TIMEOUT_MS'),
          dependencyIdentity: 'notification-worker-rabbitmq',
        },
        NotificationWorkerRunner.name,
      );
      return new NotificationWorkerRunner(
        session,
        publisher,
        {
          prefetch: config.getOrThrow('NOTIFICATION_WORKER_PREFETCH'),
          maxAttempts: config.getOrThrow('NOTIFICATION_WORKER_MAX_ATTEMPTS'),
          retryDelayMs: config.getOrThrow('NOTIFICATION_WORKER_RETRY_DELAY_MS'),
        },
        snapshot,
        dispatch,
        single,
        failBatch,
      );
    },
    inject: [
      ConfigService,
      SnapshotBatchUseCase,
      DispatchBatchUseCase,
      DispatchSingleNotificationUseCase,
      FailBatchUseCase,
    ],
  },
  {
    provide: READINESS_CHECKS,
    useFactory: (prisma: PrismaService, runner: NotificationWorkerRunner) => ({
      postgres: () => prisma.ping(),
      consumers: () =>
        runner.isReady() ? Promise.resolve() : Promise.reject(new Error('consumer chưa đăng ký')),
    }),
    inject: [PrismaService, NotificationWorkerRunner],
  },
];

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateWorkerEnvironment })],
  controllers: [HealthController],
  providers: PROVIDERS,
})
export class WorkerModule {}

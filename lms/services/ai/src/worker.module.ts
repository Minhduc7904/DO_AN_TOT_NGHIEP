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

import { CourseHttpClient } from './adapters/clients/course-http.client.js';
import { MediaHttpClient } from './adapters/clients/media-http.client.js';
import { DocxMarkdownExtractor } from './adapters/documents/docx-markdown-extractor.js';
import { AiWorkerRunner } from './adapters/messaging/ai-worker.runner.js';
import { createRabbitMq } from './adapters/messaging/rabbitmq.js';
import { PrismaBindingRepository } from './adapters/persistence/prisma-binding.repository.js';
import { PrismaInvocationRepository } from './adapters/persistence/prisma-invocation.repository.js';
import { PrismaAiUnitOfWork } from './adapters/persistence/prisma-unit-of-work.js';
import { PrismaService } from './adapters/persistence/prisma.service.js';
import { OpenAiCompatibleChatClient } from './adapters/provider/openai-compatible-chat.client.js';
import { AesGcmSecretProtector } from './adapters/security/aes-gcm-secret-protector.js';
import {
  DOCX_TEXT_EXTRACTOR,
  type DocxTextExtractor,
} from './application/ports/docx-text-extractor.js';
import {
  LESSON_COURSE_CLIENT,
  type LessonCourseClient,
  MEDIA_CONTENT_SOURCE,
  type MediaContentSource,
} from './application/ports/lesson-course-client.js';
import { CHAT_CLIENT, type ChatClient } from './application/ports/provider-client.js';
import {
  BINDING_REPOSITORY,
  type BindingRepository,
  INVOCATION_REPOSITORY,
  type InvocationRepository,
} from './application/ports/repositories.js';
import { SECRET_PROTECTOR, type SecretProtector } from './application/ports/secret-protector.js';
import { AI_UNIT_OF_WORK, type AiUnitOfWork } from './application/ports/unit-of-work.js';
import { CLOCK, ID_GENERATOR } from './application/runtime.js';
import { CreateCompletionUseCase } from './application/use-cases/completions/create-completion.use-case.js';
import { ExtractDocumentUseCase } from './application/use-cases/documents/extract-document.use-case.js';
import { RunJobUseCase } from './application/use-cases/jobs/run-job.use-case.js';
import { AI_WORKER_SERVICE_NAME } from './config/app-config.js';
import { type WorkerEnvironment, validateWorkerEnvironment } from './config/env.schema.js';
import { AI_COMMANDS } from '@aiops-lms/contracts/commands';

type Config = ConfigService<WorkerEnvironment, true>;

const uuidGenerator: IdGenerator = { next: () => randomUUID() };

const PROVIDERS: Provider[] = [
  ...ENVELOPE_PROVIDERS,
  PrismaService,
  PrismaBindingRepository,
  PrismaInvocationRepository,
  CourseHttpClient,
  MediaHttpClient,
  { provide: BINDING_REPOSITORY, useExisting: PrismaBindingRepository },
  { provide: INVOCATION_REPOSITORY, useExisting: PrismaInvocationRepository },
  { provide: LESSON_COURSE_CLIENT, useExisting: CourseHttpClient },
  { provide: MEDIA_CONTENT_SOURCE, useExisting: MediaHttpClient },
  { provide: DOCX_TEXT_EXTRACTOR, useClass: DocxMarkdownExtractor },
  { provide: CLOCK, useValue: systemClock },
  { provide: ID_GENERATOR, useValue: uuidGenerator },
  {
    provide: SECRET_PROTECTOR,
    useFactory: (config: Config): SecretProtector =>
      AesGcmSecretProtector.fromBase64(config.getOrThrow('AI_ENCRYPTION_KEY')),
    inject: [ConfigService],
  },
  {
    provide: CHAT_CLIENT,
    useFactory: (config: Config): ChatClient =>
      new OpenAiCompatibleChatClient(config.getOrThrow('AI_COMPLETION_TIMEOUT_MS')),
    inject: [ConfigService],
  },
  {
    provide: AI_UNIT_OF_WORK,
    useFactory: (prisma: PrismaService, config: Config): AiUnitOfWork =>
      new PrismaAiUnitOfWork(prisma, {
        serviceName: AI_WORKER_SERVICE_NAME,
        serviceVersion: config.getOrThrow('OTEL_SERVICE_VERSION'),
      }),
    inject: [PrismaService, ConfigService],
  },
  {
    provide: SERVICE_TOKEN_PROVIDER,
    useFactory: (config: Config): TokenProvider =>
      new ServiceTokenProvider(
        new HttpServiceTokenSource({
          dependency: 'ai-worker-auth-token',
          baseUrl: config.getOrThrow('AUTH_BASE_URL'),
          clientId: config.getOrThrow('SERVICE_CLIENT_ID'),
          clientSecret: config.getOrThrow('SERVICE_CLIENT_SECRET'),
          timeoutMs: config.getOrThrow('AUTH_TOKEN_TIMEOUT_MS'),
          breaker: {
            failureThreshold: config.getOrThrow('AUTH_TOKEN_BREAKER_THRESHOLD'),
            cooldownMs: config.getOrThrow('AUTH_TOKEN_BREAKER_COOLDOWN_MS'),
          },
        }),
      ),
    inject: [ConfigService],
  },
  // Provider được gọi trong process của worker (không qua `POST /internal/v1/ai/completions`).
  {
    provide: CreateCompletionUseCase,
    useFactory: (
      bindings: BindingRepository,
      secrets: SecretProtector,
      chat: ChatClient,
      invocations: InvocationRepository,
      clock: Clock,
      ids: IdGenerator,
    ) => new CreateCompletionUseCase(bindings, secrets, chat, invocations, clock, ids),
    inject: [
      BINDING_REPOSITORY,
      SECRET_PROTECTOR,
      CHAT_CLIENT,
      INVOCATION_REPOSITORY,
      CLOCK,
      ID_GENERATOR,
    ],
  },
  {
    provide: ExtractDocumentUseCase,
    useFactory: (
      uow: AiUnitOfWork,
      media: MediaContentSource,
      completions: CreateCompletionUseCase,
      docx: DocxTextExtractor,
      ids: IdGenerator,
      clock: Clock,
      config: Config,
    ) =>
      new ExtractDocumentUseCase(
        uow,
        media,
        completions,
        docx,
        ids,
        clock,
        AI_COMMANDS.documentExtract.queue,
        config.getOrThrow('AI_WORKER_LEASE_MS'),
      ),
    inject: [
      AI_UNIT_OF_WORK,
      MEDIA_CONTENT_SOURCE,
      CreateCompletionUseCase,
      DOCX_TEXT_EXTRACTOR,
      ID_GENERATOR,
      CLOCK,
      ConfigService,
    ],
  },
  {
    provide: RunJobUseCase,
    useFactory: (
      uow: AiUnitOfWork,
      course: LessonCourseClient,
      completions: CreateCompletionUseCase,
      clock: Clock,
      config: Config,
    ) =>
      new RunJobUseCase(
        uow,
        course,
        completions,
        clock,
        AI_COMMANDS.jobRun.queue,
        config.getOrThrow('AI_WORKER_LEASE_MS'),
      ),
    inject: [AI_UNIT_OF_WORK, LESSON_COURSE_CLIENT, CreateCompletionUseCase, CLOCK, ConfigService],
  },
  {
    provide: AiWorkerRunner,
    useFactory: (config: Config, extract: ExtractDocumentUseCase, run: RunJobUseCase) => {
      const { session, publisher } = createRabbitMq(
        {
          url: config.getOrThrow('AI_RABBITMQ_URL'),
          connectTimeoutMs: config.getOrThrow('AI_RABBITMQ_CONNECT_TIMEOUT_MS'),
          confirmTimeoutMs: config.getOrThrow('AI_RABBITMQ_CONFIRM_TIMEOUT_MS'),
        },
        AiWorkerRunner.name,
      );
      return new AiWorkerRunner(
        session,
        publisher,
        {
          prefetch: config.getOrThrow('AI_WORKER_PREFETCH'),
          maxAttempts: config.getOrThrow('AI_WORKER_MAX_ATTEMPTS'),
          retryDelayMs: config.getOrThrow('AI_WORKER_RETRY_DELAY_MS'),
        },
        extract,
        run,
      );
    },
    inject: [ConfigService, ExtractDocumentUseCase, RunJobUseCase],
  },
  {
    provide: READINESS_CHECKS,
    useFactory: (prisma: PrismaService, runner: AiWorkerRunner) => ({
      postgres: () => prisma.ping(),
      consumers: () =>
        runner.isReady() ? Promise.resolve() : Promise.reject(new Error('consumer chưa đăng ký')),
    }),
    inject: [PrismaService, AiWorkerRunner],
  },
];

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateWorkerEnvironment })],
  controllers: [HealthController],
  providers: PROVIDERS,
})
export class WorkerModule {}

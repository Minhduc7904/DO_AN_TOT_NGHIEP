import { randomUUID } from 'node:crypto';

import { createHttpServiceAuth, SERVICE_AUTH } from '@aiops-lms/common/auth';
import { COMMON_HTTP_PROVIDERS, HealthController, READINESS_CHECKS } from '@aiops-lms/common/http';
import { type Clock, type IdGenerator, systemClock } from '@aiops-lms/common/ports';
import { Module, type Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AiCompletionController } from './adapters/http/internal/ai-completion.controller.js';
import { AiDocumentsController } from './adapters/http/internal/ai-documents.controller.js';
import { AiJobsController } from './adapters/http/internal/ai-jobs.controller.js';
import { AiBindingController } from './adapters/http/public/ai-binding.controller.js';
import { AiModelController } from './adapters/http/public/ai-model.controller.js';
import { AiProviderController } from './adapters/http/public/ai-provider.controller.js';
import { OutboxRelayService } from './adapters/messaging/outbox-relay.service.js';
import { PrismaBindingRepository } from './adapters/persistence/prisma-binding.repository.js';
import { PrismaInvocationRepository } from './adapters/persistence/prisma-invocation.repository.js';
import { PrismaModelRepository } from './adapters/persistence/prisma-model.repository.js';
import { PrismaProviderRepository } from './adapters/persistence/prisma-provider.repository.js';
import { PrismaAiUnitOfWork } from './adapters/persistence/prisma-unit-of-work.js';
import { PrismaService } from './adapters/persistence/prisma.service.js';
import { ModelsListProbe } from './adapters/provider/models-probe.js';
import { OpenAiCompatibleChatClient } from './adapters/provider/openai-compatible-chat.client.js';
import { AesGcmSecretProtector } from './adapters/security/aes-gcm-secret-protector.js';
import {
  CHAT_CLIENT,
  PROVIDER_PROBE,
  type ChatClient,
  type ProviderProbe,
} from './application/ports/provider-client.js';
import {
  BINDING_REPOSITORY,
  type BindingRepository,
  INVOCATION_REPOSITORY,
  type InvocationRepository,
  MODEL_REPOSITORY,
  type ModelRepository,
  PROVIDER_REPOSITORY,
  type ProviderRepository,
} from './application/ports/repositories.js';
import { SECRET_PROTECTOR, type SecretProtector } from './application/ports/secret-protector.js';
import { AI_UNIT_OF_WORK, type AiUnitOfWork } from './application/ports/unit-of-work.js';
import { CLOCK, ID_GENERATOR } from './application/runtime.js';
import { DeleteBindingUseCase } from './application/use-cases/bindings/delete-binding.use-case.js';
import { GetBindingUseCase } from './application/use-cases/bindings/get-binding.use-case.js';
import { ListBindingsUseCase } from './application/use-cases/bindings/list-bindings.use-case.js';
import { UpsertBindingUseCase } from './application/use-cases/bindings/upsert-binding.use-case.js';
import { CreateCompletionUseCase } from './application/use-cases/completions/create-completion.use-case.js';
import { QueryDocumentsUseCase } from './application/use-cases/documents/query-documents.use-case.js';
import { SyncDocumentsUseCase } from './application/use-cases/documents/sync-documents.use-case.js';
import { CreateJobUseCase } from './application/use-cases/jobs/create-job.use-case.js';
import { GetJobUseCase } from './application/use-cases/jobs/get-job.use-case.js';
import { ListJobsUseCase } from './application/use-cases/jobs/list-jobs.use-case.js';
import { CreateModelUseCase } from './application/use-cases/models/create-model.use-case.js';
import { DeleteModelUseCase } from './application/use-cases/models/delete-model.use-case.js';
import { GetModelUseCase } from './application/use-cases/models/get-model.use-case.js';
import { ListModelsUseCase } from './application/use-cases/models/list-models.use-case.js';
import { UpdateModelUseCase } from './application/use-cases/models/update-model.use-case.js';
import { GetAiOptionsUseCase } from './application/use-cases/options/get-ai-options.use-case.js';
import { CheckAllProvidersHealthUseCase } from './application/use-cases/providers/check-all-providers-health.use-case.js';
import { CheckProviderHealthUseCase } from './application/use-cases/providers/check-provider-health.use-case.js';
import { CreateProviderUseCase } from './application/use-cases/providers/create-provider.use-case.js';
import { DeleteProviderUseCase } from './application/use-cases/providers/delete-provider.use-case.js';
import { GetProviderUseCase } from './application/use-cases/providers/get-provider.use-case.js';
import { ListProvidersUseCase } from './application/use-cases/providers/list-providers.use-case.js';
import { ProviderHealthChecker } from './application/use-cases/providers/provider-health-checker.js';
import { UpdateProviderUseCase } from './application/use-cases/providers/update-provider.use-case.js';
import { AI_SERVICE_NAME } from './config/app-config.js';
import { type Environment, validateEnvironment } from './config/env.schema.js';

/**
 * Mỗi use case là một class trong `application/use-cases/<area>/<verb-noun>.use-case.ts`, được
 * đăng ký bằng provider factory (use case không import Nest) và gọi từ controller mỏng. DTO
 * request/response là zod schema trong `lms/contracts/src/http/`; controller trả DTO hoặc
 * `Page<Dto>`, envelope do `ResponseEnvelopeInterceptor` bọc.
 */
const uuidGenerator: IdGenerator = { next: () => randomUUID() };

type Config = ConfigService<Environment, true>;
const HEALTH_CHECKER = Symbol('HEALTH_CHECKER');

const INFRASTRUCTURE: Provider[] = [
  PrismaService,
  PrismaProviderRepository,
  PrismaModelRepository,
  PrismaBindingRepository,
  PrismaInvocationRepository,
  { provide: PROVIDER_REPOSITORY, useExisting: PrismaProviderRepository },
  { provide: MODEL_REPOSITORY, useExisting: PrismaModelRepository },
  { provide: BINDING_REPOSITORY, useExisting: PrismaBindingRepository },
  { provide: INVOCATION_REPOSITORY, useExisting: PrismaInvocationRepository },
  OutboxRelayService,
  {
    provide: AI_UNIT_OF_WORK,
    useFactory: (prisma: PrismaService, config: Config): AiUnitOfWork =>
      new PrismaAiUnitOfWork(prisma, {
        serviceName: AI_SERVICE_NAME,
        serviceVersion: config.getOrThrow('OTEL_SERVICE_VERSION'),
      }),
    inject: [PrismaService, ConfigService],
  },
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
    provide: PROVIDER_PROBE,
    useFactory: (config: Config): ProviderProbe =>
      new ModelsListProbe(config.getOrThrow('AI_HEALTH_CHECK_TIMEOUT_MS')),
    inject: [ConfigService],
  },
  {
    provide: HEALTH_CHECKER,
    useFactory: (secrets: SecretProtector, probe: ProviderProbe, clock: Clock) =>
      new ProviderHealthChecker(secrets, probe, clock),
    inject: [SECRET_PROTECTOR, PROVIDER_PROBE, CLOCK],
  },
  {
    provide: SERVICE_AUTH,
    useFactory: (config: Config) =>
      createHttpServiceAuth(AI_SERVICE_NAME, {
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

const USE_CASES: Provider[] = [
  // providers
  {
    provide: CreateProviderUseCase,
    useFactory: (providers: ProviderRepository, secrets: SecretProtector, ids: IdGenerator) =>
      new CreateProviderUseCase(providers, secrets, ids),
    inject: [PROVIDER_REPOSITORY, SECRET_PROTECTOR, ID_GENERATOR],
  },
  {
    provide: UpdateProviderUseCase,
    useFactory: (providers: ProviderRepository, secrets: SecretProtector) =>
      new UpdateProviderUseCase(providers, secrets),
    inject: [PROVIDER_REPOSITORY, SECRET_PROTECTOR],
  },
  ...[ListProvidersUseCase, GetProviderUseCase, DeleteProviderUseCase].map((useCase) => ({
    provide: useCase,
    useFactory: (providers: ProviderRepository) => new useCase(providers),
    inject: [PROVIDER_REPOSITORY],
  })),
  ...[CheckProviderHealthUseCase, CheckAllProvidersHealthUseCase].map((useCase) => ({
    provide: useCase,
    useFactory: (providers: ProviderRepository, checker: ProviderHealthChecker) =>
      new useCase(providers, checker),
    inject: [PROVIDER_REPOSITORY, HEALTH_CHECKER],
  })),
  // models
  {
    provide: CreateModelUseCase,
    useFactory: (models: ModelRepository, providers: ProviderRepository, ids: IdGenerator) =>
      new CreateModelUseCase(models, providers, ids),
    inject: [MODEL_REPOSITORY, PROVIDER_REPOSITORY, ID_GENERATOR],
  },
  ...[ListModelsUseCase, GetModelUseCase, UpdateModelUseCase, DeleteModelUseCase].map(
    (useCase) => ({
      provide: useCase,
      useFactory: (models: ModelRepository) => new useCase(models),
      inject: [MODEL_REPOSITORY],
    }),
  ),
  // bindings
  ...[ListBindingsUseCase, GetBindingUseCase, DeleteBindingUseCase].map((useCase) => ({
    provide: useCase,
    useFactory: (bindings: BindingRepository) => new useCase(bindings),
    inject: [BINDING_REPOSITORY],
  })),
  {
    provide: UpsertBindingUseCase,
    useFactory: (bindings: BindingRepository, models: ModelRepository, ids: IdGenerator) =>
      new UpsertBindingUseCase(bindings, models, ids),
    inject: [BINDING_REPOSITORY, MODEL_REPOSITORY, ID_GENERATOR],
  },
  { provide: GetAiOptionsUseCase, useFactory: () => new GetAiOptionsUseCase() },
  // completions
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
  // tài liệu và job AI (course gọi qua HTTP nội bộ; ai-worker xử lý nền)
  {
    provide: SyncDocumentsUseCase,
    useFactory: (uow: AiUnitOfWork, ids: IdGenerator, clock: Clock) =>
      new SyncDocumentsUseCase(uow, ids, clock),
    inject: [AI_UNIT_OF_WORK, ID_GENERATOR, CLOCK],
  },
  {
    provide: QueryDocumentsUseCase,
    useFactory: (uow: AiUnitOfWork) => new QueryDocumentsUseCase(uow.stores.documents),
    inject: [AI_UNIT_OF_WORK],
  },
  {
    provide: CreateJobUseCase,
    useFactory: (uow: AiUnitOfWork, ids: IdGenerator) => new CreateJobUseCase(uow, ids),
    inject: [AI_UNIT_OF_WORK, ID_GENERATOR],
  },
  ...[ListJobsUseCase, GetJobUseCase].map((useCase) => ({
    provide: useCase,
    useFactory: (uow: AiUnitOfWork) => new useCase(uow.stores.jobs),
    inject: [AI_UNIT_OF_WORK],
  })),
];

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment })],
  controllers: [
    HealthController,
    AiProviderController,
    AiModelController,
    AiBindingController,
    AiCompletionController,
    AiDocumentsController,
    AiJobsController,
  ],
  providers: [...COMMON_HTTP_PROVIDERS, ...INFRASTRUCTURE, ...USE_CASES],
})
export class AppModule {}

import { randomUUID } from 'node:crypto';

import {
  createHttpServiceAuth,
  HttpServiceTokenSource,
  SERVICE_AUTH,
  SERVICE_TOKEN_PROVIDER,
  ServiceTokenProvider,
  type TokenProvider,
} from '@aiops-lms/common/auth';
import { COMMON_HTTP_PROVIDERS, HealthController, READINESS_CHECKS } from '@aiops-lms/common/http';
import { type Clock, type IdGenerator, systemClock } from '@aiops-lms/common/ports';
import { Logger, Module, type Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { MediaInternalController } from './adapters/http/internal/media-internal.controller.js';
import { MediaAdminController } from './adapters/http/public/media-admin.controller.js';
import { MediaUsageController } from './adapters/http/public/media-usage.controller.js';
import { MediaController } from './adapters/http/public/media.controller.js';
import { StudentHttpClient } from './adapters/clients/student-http.client.js';
import { OutboxRelayService } from './adapters/messaging/outbox-relay.service.js';
import { PrismaMediaUnitOfWork } from './adapters/persistence/prisma-unit-of-work.js';
import { PrismaService } from './adapters/persistence/prisma.service.js';
import { MinioObjectStorage } from './adapters/storage/minio-object-storage.js';
import { OBJECT_STORAGE, type ObjectStorage } from './application/ports/object-storage.js';
import { STUDENT_CLIENT, type StudentClient } from './application/ports/student-client.js';
import { MEDIA_UNIT_OF_WORK, type MediaUnitOfWork } from './application/ports/unit-of-work.js';
import { CLOCK, ID_GENERATOR } from './application/runtime.js';
import { CleanupMediaUseCase } from './application/use-cases/cleanup/cleanup-media.use-case.js';
import {
  GetMediaBackgroundJobsUseCase,
  GetMediaSummaryUseCase,
  GetUsageJobStatusUseCase,
} from './application/use-cases/jobs/media-jobs.use-cases.js';
import { CompleteDirectUploadUseCase } from './application/use-cases/media/complete-direct-upload.use-case.js';
import { CreateUploadIntentUseCase } from './application/use-cases/media/create-upload-intent.use-case.js';
import { GetMediaContentUseCase } from './application/use-cases/media/get-media-content.use-case.js';
import { GetMediaLibraryUseCase } from './application/use-cases/media/get-media-library.use-case.js';
import { GetMediaThumbnailUseCase } from './application/use-cases/media/get-media-thumbnail.use-case.js';
import { RetryMediaThumbnailUseCase } from './application/use-cases/media/retry-media-thumbnail.use-case.js';
import { UploadMediaUseCase } from './application/use-cases/media/upload-media.use-case.js';
import {
  CreateMediaUsagesUseCase,
  CreateMediaUsageUseCase,
} from './application/use-cases/usages/create-media-usage.use-case.js';
import { DeleteMediaUsageUseCase } from './application/use-cases/usages/delete-media-usage.use-case.js';
import { GetMediaUsageUrlsUseCase } from './application/use-cases/usages/get-media-usage-urls.use-case.js';
import { ListOwnerUsagesUseCase } from './application/use-cases/usages/list-owner-usages.use-case.js';
import { QueryUsageIdsUseCase } from './application/use-cases/usages/query-usage-ids.use-case.js';
import { ReorderMediaUsagesUseCase } from './application/use-cases/usages/reorder-media-usages.use-case.js';
import { UsageRules } from './application/use-cases/usages/usage-attacher.js';
import { MEDIA_SERVICE_NAME } from './config/app-config.js';
import { type Environment, validateEnvironment } from './config/env.schema.js';

const uuidGenerator: IdGenerator = { next: () => randomUUID() };

type Config = ConfigService<Environment, true>;

/** Chia `MINIO_PUBLIC_URL` thành endpoint cho SDK. */
function endpointOf(url: string): { endPoint: string; port: number; useSSL: boolean } {
  const parsed = new URL(url);
  const useSSL = parsed.protocol === 'https:';
  return {
    endPoint: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : useSSL ? 443 : 80,
    useSSL,
  };
}

const INFRASTRUCTURE: Provider[] = [
  PrismaService,
  StudentHttpClient,
  OutboxRelayService,
  { provide: CLOCK, useValue: systemClock },
  { provide: ID_GENERATOR, useValue: uuidGenerator },
  { provide: STUDENT_CLIENT, useExisting: StudentHttpClient },
  {
    provide: MEDIA_UNIT_OF_WORK,
    useFactory: (prisma: PrismaService, config: Config): MediaUnitOfWork =>
      new PrismaMediaUnitOfWork(prisma, {
        serviceName: MEDIA_SERVICE_NAME,
        serviceVersion: config.getOrThrow('OTEL_SERVICE_VERSION'),
      }),
    inject: [PrismaService, ConfigService],
  },
  {
    provide: OBJECT_STORAGE,
    useFactory: (config: Config): ObjectStorage =>
      new MinioObjectStorage({
        internal: {
          endPoint: config.getOrThrow('MINIO_ENDPOINT'),
          port: config.getOrThrow('MINIO_PORT'),
          useSSL: config.getOrThrow('MINIO_USE_SSL'),
        },
        public: endpointOf(config.getOrThrow('MINIO_PUBLIC_URL')),
        accessKey: config.getOrThrow('MINIO_ACCESS_KEY'),
        secretKey: config.getOrThrow('MINIO_SECRET_KEY'),
      }),
    inject: [ConfigService],
  },
  {
    provide: SERVICE_AUTH,
    useFactory: (config: Config) =>
      createHttpServiceAuth(MEDIA_SERVICE_NAME, {
        baseUrl: config.getOrThrow('IDENTITY_BASE_URL'),
        timeoutMs: config.getOrThrow('IDENTITY_JWKS_TIMEOUT_MS'),
        cacheTtlMs: config.getOrThrow('IDENTITY_JWKS_CACHE_TTL_MS'),
        minRefetchIntervalMs: config.getOrThrow('IDENTITY_JWKS_MIN_REFETCH_MS'),
      }),
    inject: [ConfigService],
  },
  {
    provide: SERVICE_TOKEN_PROVIDER,
    useFactory: (config: Config): TokenProvider =>
      new ServiceTokenProvider(
        new HttpServiceTokenSource({
          dependency: 'media-identity-token',
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
    provide: READINESS_CHECKS,
    useFactory: (prisma: PrismaService, storage: ObjectStorage) => ({
      postgres: () => prisma.ping(),
      minio: () => storage.ping(),
    }),
    inject: [PrismaService, OBJECT_STORAGE],
  },
  {
    provide: UsageRules,
    useFactory: (students: StudentClient, ids: IdGenerator) => new UsageRules(students, ids),
    inject: [STUDENT_CLIENT, ID_GENERATOR],
  },
];

const withUow = (...useCases: (new (uow: MediaUnitOfWork) => unknown)[]): Provider[] =>
  useCases.map((useCase) => ({
    provide: useCase,
    useFactory: (uow: MediaUnitOfWork) => new useCase(uow),
    inject: [MEDIA_UNIT_OF_WORK],
  }));

const USE_CASES: Provider[] = [
  {
    provide: UploadMediaUseCase,
    useFactory: (uow: MediaUnitOfWork, storage: ObjectStorage, ids: IdGenerator, clock: Clock) =>
      new UploadMediaUseCase(uow, storage, ids, clock),
    inject: [MEDIA_UNIT_OF_WORK, OBJECT_STORAGE, ID_GENERATOR, CLOCK],
  },
  {
    provide: CreateUploadIntentUseCase,
    useFactory: (
      uow: MediaUnitOfWork,
      storage: ObjectStorage,
      ids: IdGenerator,
      clock: Clock,
      config: Config,
    ) =>
      new CreateUploadIntentUseCase(
        uow,
        storage,
        ids,
        clock,
        config.getOrThrow('MEDIA_UPLOAD_EXPIRES_SECONDS'),
      ),
    inject: [MEDIA_UNIT_OF_WORK, OBJECT_STORAGE, ID_GENERATOR, CLOCK, ConfigService],
  },
  {
    provide: CompleteDirectUploadUseCase,
    useFactory: (uow: MediaUnitOfWork, storage: ObjectStorage, ids: IdGenerator, clock: Clock) =>
      new CompleteDirectUploadUseCase(uow, storage, ids, clock),
    inject: [MEDIA_UNIT_OF_WORK, OBJECT_STORAGE, ID_GENERATOR, CLOCK],
  },
  {
    provide: GetMediaContentUseCase,
    useFactory: (uow: MediaUnitOfWork, storage: ObjectStorage) =>
      new GetMediaContentUseCase(uow, storage),
    inject: [MEDIA_UNIT_OF_WORK, OBJECT_STORAGE],
  },
  {
    provide: GetMediaThumbnailUseCase,
    useFactory: (uow: MediaUnitOfWork, content: GetMediaContentUseCase) =>
      new GetMediaThumbnailUseCase(uow, content),
    inject: [MEDIA_UNIT_OF_WORK, GetMediaContentUseCase],
  },
  {
    provide: RetryMediaThumbnailUseCase,
    useFactory: (uow: MediaUnitOfWork, ids: IdGenerator) =>
      new RetryMediaThumbnailUseCase(uow, ids),
    inject: [MEDIA_UNIT_OF_WORK, ID_GENERATOR],
  },
  {
    provide: CleanupMediaUseCase,
    useFactory: (uow: MediaUnitOfWork, storage: ObjectStorage, clock: Clock, config: Config) => {
      const logger = new Logger(CleanupMediaUseCase.name);
      return new CleanupMediaUseCase(uow, storage, clock, {
        defaultRetentionHours: config.getOrThrow('MEDIA_CLEANUP_DEFAULT_RETENTION_HOURS'),
        minRetentionHours: config.getOrThrow('MEDIA_CLEANUP_MIN_RETENTION_HOURS'),
        maxRetentionHours: config.getOrThrow('MEDIA_CLEANUP_MAX_RETENTION_HOURS'),
        defaultPendingGraceMinutes: config.getOrThrow('MEDIA_CLEANUP_PENDING_GRACE_MINUTES'),
        defaultLimit: config.getOrThrow('MEDIA_CLEANUP_DEFAULT_LIMIT'),
        maxLimit: config.getOrThrow('MEDIA_CLEANUP_MAX_LIMIT'),
        onItemError: (mediaId, error) =>
          logger.warn(
            `Cleanup bỏ qua media ${mediaId}: ${error instanceof Error ? error.name : 'lỗi không rõ'}`,
          ),
      });
    },
    inject: [MEDIA_UNIT_OF_WORK, OBJECT_STORAGE, CLOCK, ConfigService],
  },
  ...[
    CreateMediaUsageUseCase,
    CreateMediaUsagesUseCase,
    ReorderMediaUsagesUseCase,
    DeleteMediaUsageUseCase,
  ].map((useCase) => ({
    provide: useCase,
    useFactory: (uow: MediaUnitOfWork, rules: UsageRules) => new useCase(uow, rules),
    inject: [MEDIA_UNIT_OF_WORK, UsageRules],
  })),
  ...withUow(
    GetMediaLibraryUseCase,
    GetMediaUsageUrlsUseCase,
    QueryUsageIdsUseCase,
    ListOwnerUsagesUseCase,
    GetUsageJobStatusUseCase,
    GetMediaSummaryUseCase,
    GetMediaBackgroundJobsUseCase,
  ),
];

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment })],
  controllers: [
    HealthController,
    MediaController,
    MediaUsageController,
    MediaAdminController,
    MediaInternalController,
  ],
  providers: [...COMMON_HTTP_PROVIDERS, ...INFRASTRUCTURE, ...USE_CASES],
})
export class AppModule {}

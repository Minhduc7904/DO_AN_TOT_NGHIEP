import { randomUUID } from 'node:crypto';

import { ENVELOPE_PROVIDERS, HealthController, READINESS_CHECKS } from '@aiops-lms/common/http';
import { type Clock, type IdGenerator, systemClock } from '@aiops-lms/common/ports';
import { Module, type Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { MediaWorkerRunner } from './adapters/messaging/media-worker.runner.js';
import { createRabbitMq } from './adapters/messaging/rabbitmq.js';
import { PrismaMediaUnitOfWork } from './adapters/persistence/prisma-unit-of-work.js';
import { PrismaService } from './adapters/persistence/prisma.service.js';
import { MinioObjectStorage } from './adapters/storage/minio-object-storage.js';
import { SharpThumbnailRenderer } from './adapters/thumbnail/sharp-thumbnail.renderer.js';
import { OBJECT_STORAGE, type ObjectStorage } from './application/ports/object-storage.js';
import {
  THUMBNAIL_RENDERER,
  type ThumbnailRenderer,
} from './application/ports/thumbnail-renderer.js';
import { MEDIA_UNIT_OF_WORK, type MediaUnitOfWork } from './application/ports/unit-of-work.js';
import { CLOCK, ID_GENERATOR } from './application/runtime.js';
import { DeleteUsagesByIdsUseCase } from './application/use-cases/worker/delete-usages-by-ids.use-case.js';
import { GenerateThumbnailUseCase } from './application/use-cases/worker/generate-thumbnail.use-case.js';
import {
  CompleteNotificationUsageJobUseCase,
  RegisterNotificationUsageUseCase,
  StartNotificationUsageJobUseCase,
} from './application/use-cases/worker/notification-usage.use-cases.js';
import { SynchronizeMarkdownUsageUseCase } from './application/use-cases/worker/synchronize-markdown-usage.use-case.js';
import { MEDIA_WORKER_SERVICE_NAME } from './config/app-config.js';
import { type WorkerEnvironment, validateWorkerEnvironment } from './config/env.schema.js';

type Config = ConfigService<WorkerEnvironment, true>;

const uuidGenerator: IdGenerator = { next: () => randomUUID() };

const PROVIDERS: Provider[] = [
  ...ENVELOPE_PROVIDERS,
  PrismaService,
  { provide: CLOCK, useValue: systemClock },
  { provide: ID_GENERATOR, useValue: uuidGenerator },
  {
    provide: MEDIA_UNIT_OF_WORK,
    useFactory: (prisma: PrismaService, config: Config): MediaUnitOfWork =>
      new PrismaMediaUnitOfWork(prisma, {
        serviceName: MEDIA_WORKER_SERVICE_NAME,
        serviceVersion: config.getOrThrow('OTEL_SERVICE_VERSION'),
      }),
    inject: [PrismaService, ConfigService],
  },
  {
    provide: OBJECT_STORAGE,
    useFactory: (config: Config): ObjectStorage => {
      const internal = {
        endPoint: config.getOrThrow<string>('MINIO_ENDPOINT'),
        port: config.getOrThrow<number>('MINIO_PORT'),
        useSSL: config.getOrThrow<boolean>('MINIO_USE_SSL'),
      };
      // Worker không ký URL cho trình duyệt nên endpoint công khai trùng endpoint nội bộ.
      return new MinioObjectStorage({
        internal,
        public: internal,
        accessKey: config.getOrThrow('MINIO_ACCESS_KEY'),
        secretKey: config.getOrThrow('MINIO_SECRET_KEY'),
      });
    },
    inject: [ConfigService],
  },
  {
    provide: THUMBNAIL_RENDERER,
    useFactory: (storage: ObjectStorage, config: Config): ThumbnailRenderer =>
      new SharpThumbnailRenderer(storage, {
        maxEdgePx: config.getOrThrow('MEDIA_THUMBNAIL_MAX_EDGE_PX'),
        quality: config.getOrThrow('MEDIA_THUMBNAIL_QUALITY'),
        ffmpegPath: config.getOrThrow('MEDIA_FFMPEG_PATH'),
        ffmpegTimeoutMs: config.getOrThrow('MEDIA_FFMPEG_TIMEOUT_MS'),
      }),
    inject: [OBJECT_STORAGE, ConfigService],
  },
  {
    provide: GenerateThumbnailUseCase,
    useFactory: (
      uow: MediaUnitOfWork,
      storage: ObjectStorage,
      renderer: ThumbnailRenderer,
      ids: IdGenerator,
      clock: Clock,
    ) => new GenerateThumbnailUseCase(uow, storage, renderer, ids, clock),
    inject: [MEDIA_UNIT_OF_WORK, OBJECT_STORAGE, THUMBNAIL_RENDERER, ID_GENERATOR, CLOCK],
  },
  ...[
    SynchronizeMarkdownUsageUseCase,
    DeleteUsagesByIdsUseCase,
    RegisterNotificationUsageUseCase,
  ].map((useCase) => ({
    provide: useCase,
    useFactory: (uow: MediaUnitOfWork, ids: IdGenerator) => new useCase(uow, ids),
    inject: [MEDIA_UNIT_OF_WORK, ID_GENERATOR],
  })),
  ...[StartNotificationUsageJobUseCase, CompleteNotificationUsageJobUseCase].map((useCase) => ({
    provide: useCase,
    useFactory: (uow: MediaUnitOfWork) => new useCase(uow),
    inject: [MEDIA_UNIT_OF_WORK],
  })),
  {
    provide: MediaWorkerRunner,
    useFactory: (
      config: Config,
      thumbnails: GenerateThumbnailUseCase,
      markdown: SynchronizeMarkdownUsageUseCase,
      deleteUsages: DeleteUsagesByIdsUseCase,
      register: RegisterNotificationUsageUseCase,
      start: StartNotificationUsageJobUseCase,
      complete: CompleteNotificationUsageJobUseCase,
    ) => {
      const { session, publisher } = createRabbitMq(
        {
          url: config.getOrThrow('MEDIA_RABBITMQ_URL'),
          connectTimeoutMs: config.getOrThrow('MEDIA_RABBITMQ_CONNECT_TIMEOUT_MS'),
          confirmTimeoutMs: config.getOrThrow('MEDIA_RABBITMQ_CONFIRM_TIMEOUT_MS'),
          dependencyIdentity: 'media-worker-rabbitmq',
        },
        MediaWorkerRunner.name,
      );
      return new MediaWorkerRunner(
        session,
        publisher,
        {
          prefetch: config.getOrThrow('MEDIA_WORKER_PREFETCH'),
          maxAttempts: config.getOrThrow('MEDIA_WORKER_MAX_ATTEMPTS'),
          retryDelayMs: config.getOrThrow('MEDIA_WORKER_RETRY_DELAY_MS'),
        },
        thumbnails,
        markdown,
        deleteUsages,
        register,
        start,
        complete,
      );
    },
    inject: [
      ConfigService,
      GenerateThumbnailUseCase,
      SynchronizeMarkdownUsageUseCase,
      DeleteUsagesByIdsUseCase,
      RegisterNotificationUsageUseCase,
      StartNotificationUsageJobUseCase,
      CompleteNotificationUsageJobUseCase,
    ],
  },
  {
    provide: READINESS_CHECKS,
    useFactory: (prisma: PrismaService, storage: ObjectStorage, runner: MediaWorkerRunner) => ({
      postgres: () => prisma.ping(),
      minio: () => storage.ping(),
      consumers: () =>
        runner.isReady() ? Promise.resolve() : Promise.reject(new Error('consumer chưa đăng ký')),
    }),
    inject: [PrismaService, OBJECT_STORAGE, MediaWorkerRunner],
  },
];

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateWorkerEnvironment })],
  controllers: [HealthController],
  providers: PROVIDERS,
})
export class WorkerModule {}

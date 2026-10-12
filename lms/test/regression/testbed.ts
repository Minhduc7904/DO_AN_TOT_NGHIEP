import {
  createHttpTelemetryMiddleware,
  startTelemetry,
} from '../../packages/observability/src/index.js';
import {
  InMemoryMetricExporter,
  InMemorySpanExporter,
  PeriodicExportingMetricReader,
  SimpleSpanProcessor,
} from '../../packages/observability/src/testing.js';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';

import { HttpExceptionFilter as AuthFilter } from '../../services/auth/src/adapters/http/http-exception.filter.js';
import { AppModule as AuthModule } from '../../services/auth/src/app.module.js';
import { HttpExceptionFilter as CourseFilter } from '../../services/course/src/adapters/http/http-exception.filter.js';
import { AppModule as CourseModule } from '../../services/course/src/app.module.js';
import { HttpExceptionFilter as EnrollmentFilter } from '../../services/enrollment/src/adapters/http/http-exception.filter.js';
import { AppModule as EnrollmentModule } from '../../services/enrollment/src/app.module.js';
import { HttpExceptionFilter as GatewayFilter } from '../../services/gateway/src/adapters/http/http-exception.filter.js';
import { AppModule as GatewayModule } from '../../services/gateway/src/app.module.js';
import { ConfigService } from '../../services/gateway/node_modules/@nestjs/config/dist/config.service.js';
import { HttpExceptionFilter as StorageFilter } from '../../services/submission-storage-mock/src/adapters/http/http-exception.filter.js';
import { AppModule as StorageModule } from '../../services/submission-storage-mock/src/app.module.js';
import { HttpExceptionFilter as SubmissionFilter } from '../../services/submission/src/adapters/http/http-exception.filter.js';
import { AppModule as SubmissionModule } from '../../services/submission/src/app.module.js';

// amqplib là dependency của Grading nên resolve từ package đó, không thêm dependency vào root workspace.
const requireFromGrading = createRequire(
  fileURLToPath(new URL('../../services/grading/package.json', import.meta.url)),
);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const amqp: any = requireFromGrading('amqplib');

export const JWT_SECRET = 'mvp-regression-test-secret-with-at-least-thirty-two-characters';
export const EVENT_EXCHANGE = 'lms.events';
export const NOTIFICATION_QUEUE = 'notification.grade-completed.mvp-regression';
export const SUBMISSION_DEPENDENCY_TIMEOUT_MS = 300;
export const GATEWAY_UPSTREAM_TIMEOUT_MS = 2_000;

const REQUIRED_ENV = [
  'W1_AUTH_DATABASE_URL',
  'COURSE_DATABASE_URL',
  'ENROLLMENT_DATABASE_URL',
  'SUBMISSION_DATABASE_URL',
  'GRADING_DATABASE_URL',
  'W2_REDIS_URL',
  'GRADING_RABBITMQ_URL',
] as const;

export interface TestApplication {
  close(): Promise<void>;
  getHttpServer(): Server;
  init(): Promise<unknown>;
  listen(port: number, host: string): Promise<unknown>;
  use(middleware: unknown): void;
  useGlobalFilters(...filters: unknown[]): void;
}

interface NotificationConsumer {
  onModuleDestroy(): Promise<void>;
  onModuleInit(): Promise<void>;
}

export interface NotificationLog {
  event_id: string;
  outcome: 'accepted' | 'duplicate';
  trace_id?: string;
}

export interface Testbed {
  apps: {
    auth: TestApplication;
    course: TestApplication;
    enrollment: TestApplication;
    gateway: TestApplication;
    grading: TestApplication;
    storage: TestApplication;
    submission: TestApplication;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  brokerChannel: any;
  /** Queue tạm quan sát payload publisher, tách khỏi queue mà Notification consume. */
  eventQueue: string;
  metricExporter: InMemoryMetricExporter;
  notificationHasProcessed(eventId: string): boolean;
  notificationLogs: NotificationLog[];
  spanExporter: InMemorySpanExporter;
  telemetry: ReturnType<typeof startTelemetry>;
  stop(): Promise<void>;
}

export function address(app: { getHttpServer(): Server }): string {
  return `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
}

/** Poll với timeout hữu hạn; khi quá hạn nêu rõ đang chờ điều kiện nào. */
export async function waitUntil(
  predicate: () => boolean | Promise<boolean>,
  description: string,
  { intervalMs = 25, timeoutMs = 8_000 }: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, intervalMs);
    });
  }
  throw new Error(`Quá hạn ${timeoutMs} ms khi chờ ${description}`);
}

/**
 * Chạy một bước của workflow; khi lỗi, gắn tên workflow, bước và service chịu trách nhiệm vào thông
 * báo để biết ngay chỗ hỏng mà không phải đọc stack trace.
 */
export async function step<T>(
  workflow: string,
  name: string,
  service: string,
  action: () => Promise<T>,
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`[${workflow}] Bước "${name}" (service: ${service}) thất bại: ${reason}`, {
      cause: error,
    });
  }
}

async function createApp(
  module: unknown,
  filter: unknown,
  values: Record<string, unknown>,
  listen = true,
): Promise<TestApplication> {
  const compiled = await Test.createTestingModule({ imports: [module as never] })
    .overrideProvider(ConfigService)
    .useValue({ getOrThrow: (key: string): unknown => values[key] })
    .compile();
  const app = compiled.createNestApplication() as TestApplication;
  app.use(createHttpTelemetryMiddleware());
  app.useGlobalFilters(filter);
  if (listen) await app.listen(0, '127.0.0.1');
  else await app.init();
  return app;
}

/**
 * Dựng toàn bộ topology Testbed MVP trong process: Gateway, sáu business service và storage mock,
 * nối với PostgreSQL, Redis và RabbitMQ thật. Mọi service gọi nhau qua HTTP thật, không stub.
 */
export async function startTestbed(): Promise<Testbed> {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Thiếu biến môi trường cho regression suite: ${missing.join(', ')}`);
  }
  const env = process.env as Record<(typeof REQUIRED_ENV)[number], string>;

  const spanExporter = new InMemorySpanExporter();
  // 1 = AggregationTemporality.CUMULATIVE; enum không được re-export từ testing helper dùng chung.
  const metricExporter = new InMemoryMetricExporter(1);
  const telemetry = startTelemetry(
    {
      enabled: true,
      otlpTracesEndpoint: 'http://127.0.0.1:4318/v1/traces',
      serviceInstanceId: 'mvp-regression-1',
      serviceName: 'gateway',
      serviceVersion: '0.1.0-test',
    },
    {
      metricReader: new PeriodicExportingMetricReader({ exporter: metricExporter }),
      spanProcessor: new SimpleSpanProcessor(spanExporter),
    },
  );

  const brokerConnection = await amqp.connect(env.GRADING_RABBITMQ_URL);
  const brokerChannel = await brokerConnection.createChannel();
  await brokerChannel.assertExchange(EVENT_EXCHANGE, 'topic', { durable: true });
  const eventQueue = (await brokerChannel.assertQueue('', { exclusive: true })).queue as string;
  await brokerChannel.bindQueue(eventQueue, EVENT_EXCHANGE, 'grade.completed');
  await brokerChannel.assertQueue(NOTIFICATION_QUEUE, { durable: true });
  await brokerChannel.bindQueue(NOTIFICATION_QUEUE, EVENT_EXCHANGE, 'grade.completed');
  await brokerChannel.purgeQueue(NOTIFICATION_QUEUE);

  // Jest ESM phải link các module dùng chung @aiops-lms/contracts theo thứ tự ổn định, và meter của
  // OpenTelemetry chỉ bind khi provider đã đăng ký, nên Notification/Grading import sau startTelemetry.
  const { GradeCompletedFixtureConsumer } =
    await import('../../services/notification/src/adapters/messaging/grade-completed.fixture-consumer.js');
  const { NotificationConsumerFault } =
    await import('../../services/notification/src/adapters/messaging/notification-consumer-fault.js');
  const { NotificationMessagingTelemetry } =
    await import('../../services/notification/src/adapters/messaging/notification-messaging-telemetry.js');
  const { connectRabbitMq } =
    await import('../../services/notification/src/adapters/messaging/rabbitmq-client.js');
  const { RabbitMqGradeCompletedConsumer } =
    await import('../../services/notification/src/adapters/messaging/rabbitmq-grade-completed.consumer.js');
  const { RabbitMqGradeCompletedMessageHandler } =
    await import('../../services/notification/src/adapters/messaging/rabbitmq-grade-completed.message-handler.js');
  const notificationBinding = {
    exchange: EVENT_EXCHANGE,
    prefetch: 1,
    queue: NOTIFICATION_QUEUE,
    routing_key: 'grade.completed' as const,
    url: env.GRADING_RABBITMQ_URL,
  };
  const processor = new GradeCompletedFixtureConsumer();
  const notificationConsumer: NotificationConsumer = new RabbitMqGradeCompletedConsumer(
    notificationBinding,
    new RabbitMqGradeCompletedMessageHandler(
      processor,
      new NotificationConsumerFault({
        getOrThrow: (key: string): boolean | number =>
          ({
            NOTIFICATION_CONSUMER_SLOWDOWN_ENABLED: false,
            NOTIFICATION_CONSUMER_SLOWDOWN_MS: 0,
          })[key] as boolean | number,
      } as never),
      new NotificationMessagingTelemetry(notificationBinding),
    ),
    connectRabbitMq,
  );

  // Notification chỉ báo kết quả xử lý qua structured log, nên thu log để assert outcome và trace_id.
  const notificationLogs: NotificationLog[] = [];
  const originalConsoleInfo = console.info;
  console.info = (...values: unknown[]): void => {
    try {
      const parsed = JSON.parse(String(values[0])) as Partial<NotificationLog> & {
        service_name?: string;
      };
      if (
        parsed.service_name === 'notification' &&
        typeof parsed.event_id === 'string' &&
        (parsed.outcome === 'accepted' || parsed.outcome === 'duplicate')
      ) {
        notificationLogs.push({
          event_id: parsed.event_id,
          outcome: parsed.outcome,
          ...(typeof parsed.trace_id === 'string' ? { trace_id: parsed.trace_id } : {}),
        });
        return;
      }
    } catch {
      // Chuyển tiếp log không phải JSON của Notification như bình thường.
    }
    originalConsoleInfo(...values);
  };
  await notificationConsumer.onModuleInit();

  const auth = await createApp(AuthModule, new AuthFilter(), {
    AUTH_DATABASE_URL: env.W1_AUTH_DATABASE_URL,
    AUTH_JWT_SECRET: JWT_SECRET,
    AUTH_JWT_TTL_SECONDS: 3_600,
    AUTH_REFRESH_TTL_SECONDS: 86_400,
  });
  const course = await createApp(CourseModule, new CourseFilter(), {
    COURSE_CACHE_TIMEOUT_MS: 300,
    COURSE_CACHE_TTL_SECONDS: 60,
    COURSE_DATABASE_URL: env.COURSE_DATABASE_URL,
    COURSE_REDIS_URL: env.W2_REDIS_URL,
  });
  const enrollment = await createApp(EnrollmentModule, new EnrollmentFilter(), {
    ENROLLMENT_COURSE_BASE_URL: address(course),
    ENROLLMENT_COURSE_BREAKER_COOLDOWN_MS: 5_000,
    ENROLLMENT_COURSE_BREAKER_THRESHOLD: 3,
    ENROLLMENT_COURSE_TIMEOUT_MS: 500,
    ENROLLMENT_DATABASE_URL: env.ENROLLMENT_DATABASE_URL,
  });
  const storage = await createApp(StorageModule, new StorageFilter(), {
    STORAGE_MOCK_DEFAULT_ERROR_MODE: 'none',
    STORAGE_MOCK_DEFAULT_LATENCY_MS: 0,
  });
  const submission = await createApp(SubmissionModule, new SubmissionFilter(), {
    SUBMISSION_COURSE_BASE_URL: address(course),
    SUBMISSION_DATABASE_URL: env.SUBMISSION_DATABASE_URL,
    SUBMISSION_DEPENDENCY_TIMEOUT_MS,
    SUBMISSION_ENROLLMENT_BASE_URL: address(enrollment),
    SUBMISSION_STORAGE_BASE_URL: address(storage),
  });
  const { HttpExceptionFilter: GradingFilter } =
    await import('../../services/grading/src/adapters/http/http-exception.filter.js');
  const { AppModule: GradingModule } = await import('../../services/grading/src/app.module.js');
  const grading = await createApp(GradingModule, new GradingFilter(), {
    GRADING_DATABASE_URL: env.GRADING_DATABASE_URL,
    GRADING_DEPENDENCY_TIMEOUT_MS: 500,
    GRADING_EVENT_RETRY_BATCH_SIZE: 20,
    GRADING_EVENT_RETRY_INTERVAL_MS: 1_000,
    GRADING_GRADE_COMPLETED_EXCHANGE: EVENT_EXCHANGE,
    GRADING_PUBLISH_CONFIRM_TIMEOUT_MS: 3_000,
    GRADING_RABBITMQ_URL: env.GRADING_RABBITMQ_URL,
    GRADING_SUBMISSION_BASE_URL: address(submission),
    OTEL_SERVICE_VERSION: '0.1.0-test',
  });
  const gateway = await createApp(
    GatewayModule,
    new GatewayFilter(),
    {
      GATEWAY_AUTH_BASE_URL: address(auth),
      GATEWAY_COURSE_BASE_URL: address(course),
      GATEWAY_ENROLLMENT_BASE_URL: address(enrollment),
      GATEWAY_GRADING_BASE_URL: address(grading),
      GATEWAY_JWT_SECRET: JWT_SECRET,
      GATEWAY_SUBMISSION_BASE_URL: address(submission),
      GATEWAY_UPSTREAM_TIMEOUT_MS,
    },
    false,
  );

  return {
    apps: { auth, course, enrollment, gateway, grading, storage, submission },
    brokerChannel,
    eventQueue,
    metricExporter,
    notificationHasProcessed: (eventId) => processor.hasProcessed(eventId),
    notificationLogs,
    spanExporter,
    telemetry,
    async stop(): Promise<void> {
      console.info = originalConsoleInfo;
      await gateway.close();
      await grading.close();
      await notificationConsumer.onModuleDestroy().catch(() => undefined);
      await submission.close();
      await storage.close();
      await enrollment.close();
      await course.close();
      await auth.close();
      await brokerChannel.deleteQueue(NOTIFICATION_QUEUE).catch(() => undefined);
      await brokerChannel.close().catch(() => undefined);
      await brokerConnection.close().catch(() => undefined);
      await telemetry.shutdown();
    },
  };
}

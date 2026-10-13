import { createAccessToken } from '../services/auth/src/domain/token.js';
import {
  createHttpTelemetryMiddleware,
  startTelemetry,
} from '../packages/observability/src/index.js';
import {
  InMemoryMetricExporter,
  InMemorySpanExporter,
  PeriodicExportingMetricReader,
  SimpleSpanProcessor,
  SpanKind,
} from '../packages/observability/src/testing.js';
import { Test } from '@nestjs/testing';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import request from 'supertest';

import { HttpExceptionFilter as AuthFilter } from '../services/auth/src/adapters/http/http-exception.filter.js';
import { AppModule as AuthModule } from '../services/auth/src/app.module.js';
import { HttpExceptionFilter as GatewayFilter } from '../services/gateway/src/adapters/http/http-exception.filter.js';
import { AppModule as GatewayModule } from '../services/gateway/src/app.module.js';
import { ConfigService } from '../services/gateway/node_modules/@nestjs/config/dist/config.service.js';
import { HttpExceptionFilter as StorageFilter } from '../services/submission-storage-mock/src/adapters/http/http-exception.filter.js';
import { AppModule as StorageModule } from '../services/submission-storage-mock/src/app.module.js';
import { HttpExceptionFilter as SubmissionFilter } from '../services/submission/src/adapters/http/http-exception.filter.js';
import { AppModule as SubmissionModule } from '../services/submission/src/app.module.js';

// amqplib là dependency của Grading nên resolve từ package đó, không thêm dependency vào root workspace.
const requireFromGrading = createRequire(
  fileURLToPath(new URL('../services/grading/package.json', import.meta.url)),
);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const amqp: any = requireFromGrading('amqplib');
const EVENT_EXCHANGE = 'lms.events';
const NOTIFICATION_QUEUE = 'notification.grade-completed.w5-e2e';
const SLOWDOWN_ENABLED = process.env.W5_NOTIFICATION_SLOWDOWN_ENABLED === 'true';
const SLOWDOWN_MS = Math.max(
  1,
  Number.parseInt(process.env.W5_NOTIFICATION_SLOWDOWN_MS ?? '250', 10),
);

const JWT_SECRET = 'w5-postgres-workflow-test-secret-with-at-least-thirty-two-characters';
const TRACE_ID = '77777777777777777777777777777777';
const TRACEPARENT = `00-${TRACE_ID}-8888888888888888-01`;
const SEED_GRADE_ID = '7d1f3a52-0c4e-4b8a-9d36-5a2e8f10c001';
const SEED_STUDENT_ID = '11111111-1111-4111-8111-111111111111';

interface TestApplication {
  close(): Promise<void>;
  getHttpServer(): Server;
  init(): Promise<unknown>;
  listen(port: number, host: string): Promise<unknown>;
  use(middleware: unknown): void;
  useGlobalFilters(...filters: unknown[]): void;
}

interface NotificationConsumer {
  onModuleDestroy(): Promise<void>;
  onModuleInit(): void;
  waitUntilConnected(): Promise<void>;
}

interface NotificationLog {
  event_id: string;
  outcome: 'accepted' | 'duplicate';
  trace_id?: string;
}

interface PublishedEvent {
  content: Buffer;
  headers: Record<string, unknown>;
  id: string;
}

function address(app: { getHttpServer(): Server }): string {
  return `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
}

function expectErrorEnvelope(body: unknown, code: string): void {
  expect(body).toMatchObject({ code, details: null });
  expect(body).toEqual(
    expect.objectContaining({
      message: expect.any(String),
      timestamp: expect.any(String),
      trace_id: expect.any(String),
    }),
  );
}

describe('W5 Gateway → Grading → Submission → PostgreSQL → RabbitMQ → Notification', () => {
  const spanExporter = new InMemorySpanExporter();
  // 1 = AggregationTemporality.CUMULATIVE; enum không được re-export từ testing helper dùng chung.
  const metricExporter = new InMemoryMetricExporter(1);
  const telemetry = startTelemetry(
    {
      enabled: true,
      otlpTracesEndpoint: 'http://127.0.0.1:4318/v1/traces',
      serviceInstanceId: 'w5-e2e-test-1',
      serviceName: 'gateway',
      serviceVersion: '0.1.0-test',
    },
    {
      metricReader: new PeriodicExportingMetricReader({ exporter: metricExporter }),
      spanProcessor: new SimpleSpanProcessor(spanExporter),
    },
  );
  const submissionCalls: { headers: Record<string, unknown>; path: string }[] = [];
  let authApp: TestApplication;
  let dependencyServer: Server;
  let gatewayApp: TestApplication;
  let gradingApp: TestApplication;
  let storageApp: TestApplication;
  let submissionApp: TestApplication;
  let submissionProxy: Server;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let brokerConnection: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let brokerChannel: any;
  let eventQueue: string;
  let notificationConsumer: NotificationConsumer;
  let notificationHasProcessed: (eventId: string) => boolean;
  let publishedEvent: PublishedEvent | undefined;
  const notificationLogs: NotificationLog[] = [];
  const originalConsoleInfo = console.info;
  const slowdownTest = SLOWDOWN_ENABLED ? it : it.skip;

  async function waitUntil(
    predicate: () => boolean | Promise<boolean>,
    description: string,
    timeoutMs = 8_000,
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await predicate()) return;
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 25);
      });
    }
    throw new Error(`Quá hạn khi chờ ${description}`);
  }

  function publishDuplicate(event: PublishedEvent): void {
    brokerChannel.publish(EVENT_EXCHANGE, 'grade.completed', event.content, {
      contentType: 'application/json',
      deliveryMode: 2,
      headers: event.headers,
    });
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

  beforeAll(async () => {
    if (
      !process.env.W1_AUTH_DATABASE_URL ||
      !process.env.SUBMISSION_DATABASE_URL ||
      !process.env.GRADING_DATABASE_URL ||
      !process.env.GRADING_RABBITMQ_URL
    ) {
      throw new Error(
        'W1_AUTH_DATABASE_URL, SUBMISSION_DATABASE_URL, GRADING_DATABASE_URL và GRADING_RABBITMQ_URL là bắt buộc',
      );
    }
    // Queue tạm quan sát payload publisher, tách khỏi queue mà Notification consume.
    brokerConnection = await amqp.connect(process.env.GRADING_RABBITMQ_URL);
    brokerChannel = await brokerConnection.createChannel();
    await brokerChannel.assertExchange(EVENT_EXCHANGE, 'topic', { durable: true });
    eventQueue = (await brokerChannel.assertQueue('', { exclusive: true })).queue as string;
    await brokerChannel.bindQueue(eventQueue, EVENT_EXCHANGE, 'grade.completed');
    await brokerChannel.assertQueue(NOTIFICATION_QUEUE, { durable: true });
    await brokerChannel.bindQueue(NOTIFICATION_QUEUE, EVENT_EXCHANGE, 'grade.completed');
    await brokerChannel.purgeQueue(NOTIFICATION_QUEUE);

    // Jest ESM phải link các module dùng chung @aiops-lms/contracts theo thứ tự ổn định.
    const { GradeCompletedFixtureConsumer } =
      await import('../services/notification/src/adapters/messaging/grade-completed.fixture-consumer.js');
    const { NotificationConsumerFault } =
      await import('../services/notification/src/adapters/messaging/notification-consumer-fault.js');
    const { NotificationMessagingTelemetry } =
      await import('../services/notification/src/adapters/messaging/notification-messaging-telemetry.js');
    const { connectRabbitMq } =
      await import('../services/notification/src/adapters/messaging/rabbitmq-client.js');
    const { RabbitMqGradeCompletedConsumer } =
      await import('../services/notification/src/adapters/messaging/rabbitmq-grade-completed.consumer.js');
    const { RabbitMqGradeCompletedMessageHandler } =
      await import('../services/notification/src/adapters/messaging/rabbitmq-grade-completed.message-handler.js');
    const notificationBinding = {
      exchange: EVENT_EXCHANGE,
      prefetch: 1,
      queue: NOTIFICATION_QUEUE,
      reconnect_delay_ms: 100,
      routing_key: 'grade.completed' as const,
      url: process.env.GRADING_RABBITMQ_URL,
    };
    const processor = new GradeCompletedFixtureConsumer();
    notificationHasProcessed = processor.hasProcessed.bind(processor);
    const notificationTelemetry = new NotificationMessagingTelemetry(notificationBinding);
    const handler = new RabbitMqGradeCompletedMessageHandler(
      processor,
      new NotificationConsumerFault({
        getOrThrow: (key: string): boolean | number =>
          ({
            NOTIFICATION_CONSUMER_SLOWDOWN_ENABLED: SLOWDOWN_ENABLED,
            NOTIFICATION_CONSUMER_SLOWDOWN_MS: SLOWDOWN_ENABLED ? SLOWDOWN_MS : 0,
          })[key] as boolean | number,
      } as never),
      notificationTelemetry,
    );
    notificationConsumer = new RabbitMqGradeCompletedConsumer(
      notificationBinding,
      handler,
      connectRabbitMq,
      notificationTelemetry,
    );
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
    notificationConsumer.onModuleInit();
    await notificationConsumer.waitUntilConnected();
    // Course và Enrollment chỉ cần trả lời hợp lệ để Submission tạo bài nộp mới.
    dependencyServer = createServer((incoming, response) => {
      response.setHeader('content-type', 'application/json');
      response.end(
        incoming.url?.startsWith('/api/v1/enrollments/check')
          ? JSON.stringify({ enrolled: true })
          : JSON.stringify({ id: 'course-001' }),
      );
    });
    await new Promise<void>((resolve) => dependencyServer.listen(0, '127.0.0.1', resolve));
    const dependencyUrl = address({ getHttpServer: () => dependencyServer });

    authApp = await createApp(AuthModule, new AuthFilter(), {
      AUTH_DATABASE_URL: process.env.W1_AUTH_DATABASE_URL,
      AUTH_JWT_SECRET: JWT_SECRET,
      AUTH_JWT_TTL_SECONDS: 3_600,
      AUTH_REFRESH_TTL_SECONDS: 86_400,
    });
    storageApp = await createApp(StorageModule, new StorageFilter(), {
      STORAGE_MOCK_DEFAULT_ERROR_MODE: 'none',
      STORAGE_MOCK_DEFAULT_LATENCY_MS: 0,
    });
    submissionApp = await createApp(SubmissionModule, new SubmissionFilter(), {
      SUBMISSION_COURSE_BASE_URL: dependencyUrl,
      SUBMISSION_DATABASE_URL: process.env.SUBMISSION_DATABASE_URL,
      SUBMISSION_DEPENDENCY_TIMEOUT_MS: 500,
      SUBMISSION_ENROLLMENT_BASE_URL: dependencyUrl,
      SUBMISSION_STORAGE_BASE_URL: address(storageApp),
    });
    // Proxy ghi lại header Submission nhận được từ Grading mà không đổi hành vi của Submission.
    submissionProxy = createServer((incoming, response) => {
      submissionCalls.push({ headers: incoming.headers, path: incoming.url ?? '' });
      const headers: Record<string, string> = {};
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (typeof value === 'string' && name !== 'host') headers[name] = value;
      }
      void fetch(new URL(incoming.url ?? '/', address(submissionApp)), { headers }).then(
        async (upstream) => {
          response.writeHead(upstream.status, { 'content-type': 'application/json' });
          response.end(await upstream.text());
        },
      );
    });
    await new Promise<void>((resolve) => submissionProxy.listen(0, '127.0.0.1', resolve));
    // Meter của OpenTelemetry chỉ bind khi provider đã đăng ký, nên import Grading sau startTelemetry.
    const { HttpExceptionFilter: GradingFilter } =
      await import('../services/grading/src/adapters/http/http-exception.filter.js');
    const { AppModule: GradingModule } = await import('../services/grading/src/app.module.js');
    gradingApp = await createApp(GradingModule, new GradingFilter(), {
      GRADING_DATABASE_URL: process.env.GRADING_DATABASE_URL,
      GRADING_DEPENDENCY_TIMEOUT_MS: 500,
      GRADING_EVENT_RETRY_BATCH_SIZE: 20,
      GRADING_EVENT_RETRY_INTERVAL_MS: 1_000,
      GRADING_GRADE_COMPLETED_EXCHANGE: EVENT_EXCHANGE,
      GRADING_PUBLISH_CONFIRM_TIMEOUT_MS: 3_000,
      GRADING_RABBITMQ_URL: process.env.GRADING_RABBITMQ_URL,
      OTEL_SERVICE_VERSION: '0.1.0-test',
      GRADING_SUBMISSION_BASE_URL: address({ getHttpServer: () => submissionProxy }),
    });
    gatewayApp = await createApp(
      GatewayModule,
      new GatewayFilter(),
      {
        GATEWAY_AUTH_BASE_URL: address(authApp),
        GATEWAY_GRADING_BASE_URL: address(gradingApp),
        GATEWAY_JWT_SECRET: JWT_SECRET,
        GATEWAY_SUBMISSION_BASE_URL: address(submissionApp),
        GATEWAY_UPSTREAM_TIMEOUT_MS: 2_000,
      },
      false,
    );
  }, 30_000);

  afterAll(async () => {
    console.info = originalConsoleInfo;
    await gatewayApp?.close();
    await gradingApp?.close();
    await notificationConsumer?.onModuleDestroy().catch(() => undefined);
    if (submissionProxy) {
      await new Promise<void>((resolve) => submissionProxy.close(() => resolve()));
    }
    await submissionApp?.close();
    await storageApp?.close();
    await authApp?.close();
    if (dependencyServer) {
      await new Promise<void>((resolve) => dependencyServer.close(() => resolve()));
    }
    await brokerChannel?.deleteQueue(NOTIFICATION_QUEUE).catch(() => undefined);
    await brokerChannel?.close().catch(() => undefined);
    await brokerConnection?.close().catch(() => undefined);
    await telemetry.shutdown();
  }, 20_000);

  async function login(email: string): Promise<{ id: string; token: string }> {
    const response = await request(gatewayApp.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'example-password' })
      .expect(200);
    return {
      id: response.body.principal.id as string,
      token: response.body.access_token as string,
    };
  }

  it('grades a new Submission and keeps one trace through HTTP, RabbitMQ and Notification', async () => {
    const student = await login('student@example.test');
    const instructor = await login('instructor@example.test');
    const submission = await request(gatewayApp.getHttpServer())
      .post('/api/v1/submissions')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ content: 'w5-secret-answer', course_id: 'course-001' })
      .expect(201);
    expect(submission.body.id).not.toBe('submission-001');
    spanExporter.reset();
    submissionCalls.length = 0;

    const created = await request(gatewayApp.getHttpServer())
      .post('/api/v1/grades')
      .set('Authorization', `Bearer ${instructor.token}`)
      .set('traceparent', TRACEPARENT)
      .set('x-principal-id', 'spoofed-client')
      .set('x-principal-role', 'student')
      .send({ score: 92.5, submission_id: submission.body.id })
      .expect(201);
    expect(Object.keys(created.body).sort()).toEqual([
      'completed_at',
      'id',
      'score',
      'submission_id',
    ]);
    expect(created.body).toMatchObject({ score: 92.5, submission_id: submission.body.id });

    // Header giả mạo role student bị Gateway ghi đè bằng principal từ JWT nên instructor vẫn tạo được grade ở trên.
    // Student thật là chủ bài nộp nên đọc được grade; student khác bị chặn.
    await request(gatewayApp.getHttpServer())
      .get(`/api/v1/grades/${created.body.id as string}`)
      .set('Authorization', `Bearer ${student.token}`)
      .expect(200)
      .expect(({ body }) => expect(body).toEqual(created.body));
    await request(gatewayApp.getHttpServer())
      .get(`/api/v1/grades/${created.body.id as string}`)
      .set('Authorization', `Bearer ${instructor.token}`)
      .expect(200);
    await request(gatewayApp.getHttpServer())
      .get(`/api/v1/grades/${created.body.id as string}`)
      .set(
        'Authorization',
        `Bearer ${createAccessToken('student-other', 'student', JWT_SECRET, 600)}`,
      )
      .expect(403)
      .expect(({ body }) => expectErrorEnvelope(body, 'FORBIDDEN'));

    await request(gatewayApp.getHttpServer())
      .post('/api/v1/grades')
      .set('Authorization', `Bearer ${instructor.token}`)
      .send({ score: 50, submission_id: submission.body.id })
      .expect(409)
      .expect(({ body }) => expectErrorEnvelope(body, 'CONFLICT'));
    await request(gatewayApp.getHttpServer())
      .post('/api/v1/grades')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ score: 50, submission_id: submission.body.id })
      .expect(403)
      .expect(({ body }) => expectErrorEnvelope(body, 'FORBIDDEN'));
    await request(gatewayApp.getHttpServer())
      .post('/api/v1/grades')
      .set('Authorization', `Bearer ${instructor.token}`)
      .send({ score: 50, submission_id: 'missing-submission' })
      .expect(404)
      .expect(({ body }) => expectErrorEnvelope(body, 'NOT_FOUND'));

    // Grading gọi Submission không mang Bearer JWT hay principal header, chỉ có W3C trace context.
    const firstCall = submissionCalls[0];
    expect(firstCall?.path).toBe(`/api/v1/submissions/${submission.body.id as string}`);
    expect(firstCall?.headers.authorization).toBeUndefined();
    expect(firstCall?.headers['x-principal-id']).toBeUndefined();
    expect(String(firstCall?.headers.traceparent)).toContain(TRACE_ID);

    const message = await brokerChannel.get(eventQueue, { noAck: true });
    expect(message).toBeTruthy();
    const event = JSON.parse(String(message.content));
    expect(message.properties.deliveryMode).toBe(2);
    expect(event).toMatchObject({
      event_name: 'grade.completed',
      payload: {
        course_id: 'course-001',
        grade_id: created.body.id,
        principal_id: student.id,
        score: 92.5,
        submission_id: submission.body.id,
      },
      producer: { service_name: 'grading' },
      schema_version: 1,
    });
    expect(message.properties.headers.traceparent).toBe(event.correlation.traceparent);
    expect(event.correlation.traceparent).toContain(TRACE_ID);
    expect(await brokerChannel.get(eventQueue, { noAck: true })).toBe(false);
    publishedEvent = {
      content: Buffer.from(message.content),
      headers: message.properties.headers as Record<string, unknown>,
      id: event.event_id as string,
    };

    await waitUntil(
      () =>
        notificationLogs.some(
          (entry) => entry.event_id === event.event_id && entry.outcome === 'accepted',
        ),
      'Notification nhận grade.completed',
    );
    expect(notificationHasProcessed(event.event_id as string)).toBe(true);
    expect(
      notificationLogs.filter(
        (entry) => entry.event_id === event.event_id && entry.outcome === 'accepted',
      ),
    ).toHaveLength(1);

    await telemetry.forceFlush();
    const spans = spanExporter
      .getFinishedSpans()
      .filter((span) => span.spanContext().traceId === TRACE_ID);
    const servers = spans.filter((span) => span.kind === SpanKind.SERVER);
    expect(servers.some((span) => span.name.includes('/api/v1/grades'))).toBe(true);
    expect(servers.some((span) => span.name.includes('/api/v1/submissions'))).toBe(true);
    for (const dependencyIdentity of [
      'grading-submission',
      'grading-postgres',
      'submission-postgres',
    ]) {
      expect(
        spans.some(
          (span) =>
            span.kind === SpanKind.CLIENT &&
            span.attributes.dependency_identity === dependencyIdentity,
        ),
      ).toBe(true);
    }
    const gatewayClient = spans.find(
      (span) => span.kind === SpanKind.CLIENT && span.name === 'POST /api/v1/grades',
    );
    const gradingServer = servers.find((span) => span.name.includes('/api/v1/grades'));
    expect(gradingServer?.parentSpanContext?.spanId).toBe(gatewayClient?.spanContext().spanId);
    const gradingSubmission = spans.find(
      (span) => span.attributes.dependency_identity === 'grading-submission',
    );
    const submissionServer = servers.find((span) => span.name.includes('/api/v1/submissions'));
    expect(gradingSubmission?.parentSpanContext?.spanId).toBe(gradingServer?.spanContext().spanId);
    expect(submissionServer?.spanContext().traceId).toBe(TRACE_ID);

    // Event grade.completed và Notification consume cùng trace với chuỗi HTTP phía trước.
    const publishSpan = spans.find((span) => span.kind === SpanKind.PRODUCER);
    const consumeSpan = spans.find((span) => span.name === 'rabbitmq consume grade.completed');
    const processSpan = spans.find((span) => span.name === 'notification process grade.completed');
    expect(publishSpan?.attributes.dependency_identity).toBe('grading-rabbitmq');
    expect(publishSpan?.parentSpanContext?.spanId).toBe(gradingServer?.spanContext().spanId);
    expect(consumeSpan?.attributes.dependency_identity).toBe('notification-rabbitmq');
    expect(consumeSpan?.parentSpanContext?.spanId).toBe(publishSpan?.spanContext().spanId);
    expect(processSpan?.parentSpanContext?.spanId).toBe(consumeSpan?.spanContext().spanId);
    expect(notificationLogs.find((entry) => entry.event_id === event.event_id)?.trace_id).toBe(
      TRACE_ID,
    );

    const metrics = JSON.stringify(metricExporter.getMetrics());
    for (const metricName of [
      'grading.dependency.request.count',
      'grading.messaging.publish.count',
      'notification.rabbitmq.consume.count',
      'notification.process.count',
    ]) {
      expect(metrics).toContain(metricName);
    }
    expect(metrics).toContain('grading-rabbitmq');
    expect(metrics).toContain('grading-submission');
    expect(metrics).toContain('grading-postgres');
    expect(metrics).toContain('notification-rabbitmq');
    const telemetryText = `${metrics}${JSON.stringify(spans.map((span) => span.attributes))}`;
    expect(telemetryText).not.toMatch(
      /w5-secret-answer|example-password|spoofed-client|student-other|Bearer|jwt|root_cause|fault_id/iu,
    );
    expect(metrics).not.toContain(submission.body.id);
    expect(metrics).not.toContain(student.id);
    expect(metrics).not.toContain(created.body.id);
  });

  it('acks duplicate deliveries without creating a second simulated notification', async () => {
    if (!publishedEvent) {
      throw new Error('W5 chưa ghi nhận event grade.completed từ Grading');
    }

    publishDuplicate(publishedEvent);
    publishDuplicate(publishedEvent);
    await waitUntil(
      () => notificationLogs.filter((entry) => entry.event_id === publishedEvent?.id).length === 3,
      'Notification xử lý hai duplicate delivery',
    );
    await waitUntil(
      async () => (await brokerChannel.checkQueue(NOTIFICATION_QUEUE)).messageCount === 0,
      'Notification queue drain sau duplicate',
    );

    const outcomes = notificationLogs
      .filter((entry) => entry.event_id === publishedEvent?.id)
      .map((entry) => entry.outcome);
    expect(outcomes).toEqual(['accepted', 'duplicate', 'duplicate']);
    expect(outcomes.filter((outcome) => outcome === 'accepted')).toHaveLength(1);
  });

  slowdownTest(
    'creates an observable RabbitMQ backlog only when the slowdown scenario is enabled',
    async () => {
      if (!publishedEvent) {
        throw new Error('W5 chưa ghi nhận event grade.completed từ Grading');
      }
      const initialCount = notificationLogs.filter(
        (entry) => entry.event_id === publishedEvent?.id,
      ).length;

      publishDuplicate(publishedEvent);
      publishDuplicate(publishedEvent);
      publishDuplicate(publishedEvent);

      await waitUntil(
        async () => (await brokerChannel.checkQueue(NOTIFICATION_QUEUE)).messageCount >= 1,
        'RabbitMQ backlog khi Notification slowdown bật',
      );
      await waitUntil(
        () =>
          notificationLogs.filter((entry) => entry.event_id === publishedEvent?.id).length ===
          initialCount + 3,
        'Notification xử lý hết backlog',
      );
      await waitUntil(
        async () => (await brokerChannel.checkQueue(NOTIFICATION_QUEUE)).messageCount === 0,
        'Notification queue drain sau slowdown',
      );
    },
    15_000,
  );

  it('keeps the seeded grade readable and rejects a second grade for the seeded Submission', async () => {
    const instructor = await login('instructor@example.test');
    await request(gatewayApp.getHttpServer())
      .get(`/api/v1/grades/${SEED_GRADE_ID}`)
      .set(
        'Authorization',
        `Bearer ${createAccessToken(SEED_STUDENT_ID, 'student', JWT_SECRET, 600)}`,
      )
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({ score: 85.5, submission_id: 'submission-001' }),
      );
    await request(gatewayApp.getHttpServer())
      .post('/api/v1/grades')
      .set('Authorization', `Bearer ${instructor.token}`)
      .send({ score: 10, submission_id: 'submission-001' })
      .expect(409)
      .expect(({ body }) => expectErrorEnvelope(body, 'CONFLICT'));
  });

  it('rejects requests without a valid JWT before reaching Grading', async () => {
    await request(gatewayApp.getHttpServer())
      .post('/api/v1/grades')
      .send({})
      .expect(401)
      .expect(({ body }) => expectErrorEnvelope(body, 'UNAUTHORIZED'));
    await request(gatewayApp.getHttpServer())
      .get(`/api/v1/grades/${SEED_GRADE_ID}`)
      .set('Authorization', 'Bearer invalid')
      .expect(401)
      .expect(({ body }) => expectErrorEnvelope(body, 'UNAUTHORIZED'));
  });
});

import { createAccessToken } from '../services/auth/src/domain/token.js';
import {
  createHttpTelemetryMiddleware,
  startTelemetry,
} from '../packages/observability/src/index.js';
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
  SpanKind,
} from '../packages/observability/src/testing.js';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';

import { HttpExceptionFilter as AuthFilter } from '../services/auth/src/adapters/http/http-exception.filter.js';
import { AppModule as AuthModule } from '../services/auth/src/app.module.js';
import { HttpExceptionFilter as CourseFilter } from '../services/course/src/adapters/http/http-exception.filter.js';
import { AppModule as CourseModule } from '../services/course/src/app.module.js';
import { HttpExceptionFilter as GatewayFilter } from '../services/gateway/src/adapters/http/http-exception.filter.js';
import {
  GATEWAY_FETCH,
  type FetchClient,
} from '../services/gateway/src/application/gateway-proxy.js';
import { AppModule as GatewayModule } from '../services/gateway/src/app.module.js';
import { ConfigService } from '../services/gateway/node_modules/@nestjs/config/dist/config.service.js';

const JWT_SECRET = 'w2-postgres-workflow-test-secret-with-at-least-thirty-two-characters';
const TRACE_ID = '33333333333333333333333333333333';
const TRACEPARENT = `00-${TRACE_ID}-4444444444444444-01`;

interface TestApplication {
  close(): Promise<void>;
  getHttpServer(): Server;
  init(): Promise<unknown>;
  listen(port: number, host: string): Promise<unknown>;
  use(middleware: unknown): void;
  useGlobalFilters(...filters: unknown[]): void;
}

function address(app: TestApplication): string {
  return `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
}

describe('W1–W2 Gateway → Auth/Course → PostgreSQL/Redis', () => {
  const exporter = new InMemorySpanExporter();
  const telemetry = startTelemetry(
    {
      enabled: true,
      otlpTracesEndpoint: 'http://127.0.0.1:4318/v1/traces',
      serviceInstanceId: 'w2-e2e-test-1',
      serviceName: 'gateway',
      serviceVersion: '0.1.0-test',
    },
    { spanProcessor: new SimpleSpanProcessor(exporter) },
  );
  let authApp: TestApplication;
  let courseApp: TestApplication;
  let gatewayApp: TestApplication;
  let shouldTimeoutAuth = false;

  async function createCourseApp(redisUrl: string, databaseUrl: string): Promise<TestApplication> {
    const values: Record<string, unknown> = {
      COURSE_DATABASE_URL: databaseUrl,
      COURSE_REDIS_URL: redisUrl,
      COURSE_CACHE_TTL_SECONDS: 60,
      COURSE_CACHE_TIMEOUT_MS: 100,
    };
    const module = await Test.createTestingModule({ imports: [CourseModule] })
      .overrideProvider(ConfigService)
      .useValue({ getOrThrow: (key: string): unknown => values[key] })
      .compile();
    const app = module.createNestApplication() as TestApplication;
    app.use(createHttpTelemetryMiddleware());
    app.useGlobalFilters(new CourseFilter());
    await app.listen(0, '127.0.0.1');
    return app;
  }

  async function createGatewayApp(courseUrl: string): Promise<TestApplication> {
    const values: Record<string, unknown> = {
      GATEWAY_AUTH_BASE_URL: address(authApp),
      GATEWAY_COURSE_BASE_URL: courseUrl,
      GATEWAY_JWT_SECRET: JWT_SECRET,
      GATEWAY_UPSTREAM_TIMEOUT_MS: 500,
    };
    const fetchClient: FetchClient = async (input, init) => {
      if (shouldTimeoutAuth && new URL(input.toString()).pathname === '/api/v1/auth/login') {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('upstream timeout')));
        });
      }
      return fetch(input, init);
    };
    const module = await Test.createTestingModule({ imports: [GatewayModule] })
      .overrideProvider(ConfigService)
      .useValue({ getOrThrow: (key: string): unknown => values[key] })
      .overrideProvider(GATEWAY_FETCH)
      .useValue(fetchClient)
      .compile();
    const app = module.createNestApplication() as TestApplication;
    app.use(createHttpTelemetryMiddleware());
    app.useGlobalFilters(new GatewayFilter());
    await app.init();
    return app;
  }

  beforeAll(async () => {
    if (
      !process.env.W1_AUTH_DATABASE_URL ||
      !process.env.COURSE_DATABASE_URL ||
      !process.env.W2_REDIS_URL
    ) {
      throw new Error('W1_AUTH_DATABASE_URL, COURSE_DATABASE_URL và W2_REDIS_URL là bắt buộc');
    }
    const authValues: Record<string, unknown> = {
      AUTH_DATABASE_URL: process.env.W1_AUTH_DATABASE_URL,
      AUTH_JWT_SECRET: JWT_SECRET,
      AUTH_JWT_TTL_SECONDS: 3_600,
      AUTH_REFRESH_TTL_SECONDS: 86_400,
    };
    const authModule = await Test.createTestingModule({ imports: [AuthModule] })
      .overrideProvider(ConfigService)
      .useValue({ getOrThrow: (key: string): unknown => authValues[key] })
      .compile();
    authApp = authModule.createNestApplication() as TestApplication;
    authApp.use(createHttpTelemetryMiddleware());
    authApp.useGlobalFilters(new AuthFilter());
    await authApp.listen(0, '127.0.0.1');
    courseApp = await createCourseApp(process.env.W2_REDIS_URL, process.env.COURSE_DATABASE_URL);
    gatewayApp = await createGatewayApp(address(courseApp));
  }, 30_000);

  afterEach(() => {
    shouldTimeoutAuth = false;
  });

  afterAll(async () => {
    await gatewayApp?.close();
    await courseApp?.close();
    await authApp?.close();
    await telemetry.shutdown();
  }, 20_000);

  it('logs in, browses seeded Course and preserves trace context across both workflows', async () => {
    exporter.reset();
    const login = await request(gatewayApp.getHttpServer())
      .post('/api/v1/auth/login')
      .set('traceparent', TRACEPARENT)
      .send({ email: 'student@example.test', password: 'example-password' })
      .expect(200);
    const token = login.body.access_token as string;
    expect(token.split('.')).toHaveLength(3);

    const list = await request(gatewayApp.getHttpServer())
      .get('/api/v1/courses')
      .set('Authorization', `Bearer ${token}`)
      .set('traceparent', TRACEPARENT)
      .set('x-principal-id', 'spoofed-external')
      .expect(200);
    expect(list.body.items).toContainEqual(expect.objectContaining({ id: 'course-001' }));
    await request(gatewayApp.getHttpServer())
      .get('/api/v1/courses/course-001')
      .set('Authorization', `Bearer ${token}`)
      .set('traceparent', TRACEPARENT)
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ id: 'course-001' }));

    const spans = exporter
      .getFinishedSpans()
      .filter((span) => span.spanContext().traceId === TRACE_ID);
    expect(
      spans.some((span) => span.kind === SpanKind.SERVER && span.name.includes('auth/login')),
    ).toBe(true);
    expect(
      spans.some((span) => span.kind === SpanKind.SERVER && span.name.includes('courses')),
    ).toBe(true);
    expect(
      spans.some(
        (span) =>
          span.kind === SpanKind.CLIENT && span.attributes.dependency_identity === 'auth-postgres',
      ),
    ).toBe(true);
    expect(
      spans.some(
        (span) =>
          span.kind === SpanKind.CLIENT &&
          span.attributes.dependency_identity === 'course-postgres',
      ),
    ).toBe(true);
    expect(
      spans.some(
        (span) =>
          span.kind === SpanKind.CLIENT && span.attributes.dependency_identity === 'course-redis',
      ),
    ).toBe(true);
    expect(JSON.stringify(spans.map((span) => span.attributes))).not.toMatch(
      /example-password|spoofed-external|root_cause|fault_id/iu,
    );
  });

  it('enforces JWT and role before reaching Course', async () => {
    await request(gatewayApp.getHttpServer()).get('/api/v1/courses').expect(401);
    const viewerToken = createAccessToken('viewer-001', 'viewer', JWT_SECRET, 3_600);
    await request(gatewayApp.getHttpServer())
      .get('/api/v1/courses')
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(403);
    const instructorToken = createAccessToken('instructor-001', 'instructor', JWT_SECRET, 3_600);
    await request(gatewayApp.getHttpServer())
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${instructorToken}`)
      .send({ title: 'E2E Course' })
      .expect(201);
  });

  it('maps Auth timeout to a stable Gateway envelope', async () => {
    shouldTimeoutAuth = true;
    await request(gatewayApp.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'student@example.test', password: 'example-password' })
      .expect(504)
      .expect(({ body }) =>
        expect(body).toMatchObject({ code: 'DEPENDENCY_TIMEOUT', details: null }),
      );
  });

  it('falls back to PostgreSQL on Redis failure and propagates PostgreSQL failure', async () => {
    const token = createAccessToken('student-001', 'student', JWT_SECRET, 3_600);
    const redisDown = await createCourseApp(
      'redis://127.0.0.1:1',
      process.env.COURSE_DATABASE_URL!,
    );
    const redisGateway = await createGatewayApp(address(redisDown));
    try {
      await request(redisGateway.getHttpServer())
        .get('/api/v1/courses/course-001')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    } finally {
      await redisGateway.close();
      await redisDown.close();
    }

    const postgresDown = await createCourseApp(
      'redis://127.0.0.1:1',
      'postgresql://lms:test@127.0.0.1:1/course_db',
    );
    const postgresGateway = await createGatewayApp(address(postgresDown));
    try {
      await request(postgresGateway.getHttpServer())
        .get('/api/v1/courses/missing-postgres')
        .set('Authorization', `Bearer ${token}`)
        .expect(503)
        .expect(({ body }) =>
          expect(body).toMatchObject({ code: 'DEPENDENCY_UNAVAILABLE', details: null }),
        );
    } finally {
      await postgresGateway.close();
      await postgresDown.close();
    }
  }, 20_000);
});

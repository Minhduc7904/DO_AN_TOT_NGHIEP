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
import http from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';

import { HttpExceptionFilter as AuthFilter } from '../services/auth/src/adapters/http/http-exception.filter.js';
import { AppModule as AuthModule } from '../services/auth/src/app.module.js';
import { HttpExceptionFilter as CourseFilter } from '../services/course/src/adapters/http/http-exception.filter.js';
import { AppModule as CourseModule } from '../services/course/src/app.module.js';
import { HttpExceptionFilter as EnrollmentFilter } from '../services/enrollment/src/adapters/http/http-exception.filter.js';
import { AppModule as EnrollmentModule } from '../services/enrollment/src/app.module.js';
import { HttpExceptionFilter as GatewayFilter } from '../services/gateway/src/adapters/http/http-exception.filter.js';
import { AppModule as GatewayModule } from '../services/gateway/src/app.module.js';
import { ConfigService } from '../services/gateway/node_modules/@nestjs/config/dist/config.service.js';

const JWT_SECRET = 'w3-postgres-workflow-test-secret-with-at-least-thirty-two-characters';
const TRACE_ID = '55555555555555555555555555555555';
const TRACEPARENT = `00-${TRACE_ID}-6666666666666666-01`;

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

describe('W1–W3 Gateway → Auth/Course/Enrollment → PostgreSQL', () => {
  const exporter = new InMemorySpanExporter();
  const telemetry = startTelemetry(
    {
      enabled: true,
      otlpTracesEndpoint: 'http://127.0.0.1:4318/v1/traces',
      serviceInstanceId: 'w3-e2e-test-1',
      serviceName: 'gateway',
      serviceVersion: '0.1.0-test',
    },
    { spanProcessor: new SimpleSpanProcessor(exporter) },
  );
  let authApp: TestApplication;
  let courseApp: TestApplication;
  let enrollmentApp: TestApplication;
  let gatewayApp: TestApplication;

  async function createCourseApp(): Promise<TestApplication> {
    const values: Record<string, unknown> = {
      COURSE_DATABASE_URL: process.env.COURSE_DATABASE_URL,
      COURSE_REDIS_URL: process.env.W2_REDIS_URL,
      COURSE_CACHE_TTL_SECONDS: 60,
      COURSE_CACHE_TIMEOUT_MS: 300,
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

  async function createEnrollmentApp(
    overrides: Record<string, unknown> = {},
  ): Promise<TestApplication> {
    const values: Record<string, unknown> = {
      ENROLLMENT_COURSE_BASE_URL: address(courseApp),
      ENROLLMENT_COURSE_BREAKER_COOLDOWN_MS: 5_000,
      ENROLLMENT_COURSE_BREAKER_THRESHOLD: 3,
      ENROLLMENT_COURSE_TIMEOUT_MS: 300,
      ENROLLMENT_DATABASE_URL: process.env.ENROLLMENT_DATABASE_URL,
      ...overrides,
    };
    const module = await Test.createTestingModule({ imports: [EnrollmentModule] })
      .overrideProvider(ConfigService)
      .useValue({ getOrThrow: (key: string): unknown => values[key] })
      .compile();
    const app = module.createNestApplication() as TestApplication;
    app.use(createHttpTelemetryMiddleware());
    app.useGlobalFilters(new EnrollmentFilter());
    await app.listen(0, '127.0.0.1');
    return app;
  }

  async function createGatewayApp(enrollmentUrl: string): Promise<TestApplication> {
    const values: Record<string, unknown> = {
      GATEWAY_AUTH_BASE_URL: address(authApp),
      GATEWAY_COURSE_BASE_URL: address(courseApp),
      GATEWAY_ENROLLMENT_BASE_URL: enrollmentUrl,
      GATEWAY_JWT_SECRET: JWT_SECRET,
      GATEWAY_UPSTREAM_TIMEOUT_MS: 1_000,
    };
    const module = await Test.createTestingModule({ imports: [GatewayModule] })
      .overrideProvider(ConfigService)
      .useValue({ getOrThrow: (key: string): unknown => values[key] })
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
      !process.env.W2_REDIS_URL ||
      !process.env.ENROLLMENT_DATABASE_URL
    ) {
      throw new Error(
        'W1_AUTH_DATABASE_URL, COURSE_DATABASE_URL, W2_REDIS_URL và ENROLLMENT_DATABASE_URL là bắt buộc',
      );
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
    courseApp = await createCourseApp();
    enrollmentApp = await createEnrollmentApp();
    gatewayApp = await createGatewayApp(address(enrollmentApp));
  }, 30_000);

  afterAll(async () => {
    await gatewayApp?.close();
    await enrollmentApp?.close();
    await courseApp?.close();
    await authApp?.close();
    await telemetry.shutdown();
  }, 20_000);

  async function login(): Promise<string> {
    const response = await request(gatewayApp.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'student@example.test', password: 'example-password' })
      .expect(200);
    return response.body.access_token as string;
  }

  it('logs in and enrolls into the seeded course, preserving trace context end to end', async () => {
    exporter.reset();
    const token = await login();

    const created = await request(gatewayApp.getHttpServer())
      .post('/api/v1/enrollments')
      .set('Authorization', `Bearer ${token}`)
      .set('traceparent', TRACEPARENT)
      .send({ course_id: 'course-001' })
      .expect(201);
    expect(created.body).toMatchObject({ course_id: 'course-001' });
    expect(created.body.principal_id).toEqual(expect.any(String));

    const spans = exporter
      .getFinishedSpans()
      .filter((span) => span.spanContext().traceId === TRACE_ID);
    expect(
      spans.some((span) => span.kind === SpanKind.SERVER && span.name.includes('enrollments')),
    ).toBe(true);
    expect(
      spans.some(
        (span) =>
          span.kind === SpanKind.CLIENT &&
          span.attributes.dependency_identity === 'enrollment-postgres',
      ),
    ).toBe(true);
    expect(
      spans.some(
        (span) =>
          span.kind === SpanKind.CLIENT &&
          span.attributes.dependency_identity === 'enrollment-course',
      ),
    ).toBe(true);
    expect(
      spans.some((span) => span.kind === SpanKind.SERVER && span.name.includes('courses')),
    ).toBe(true);
    expect(JSON.stringify(spans.map((span) => span.attributes))).not.toMatch(
      /example-password|root_cause|fault_id/iu,
    );
  });

  it('rejects enrollment without a JWT or with a disallowed role', async () => {
    await request(gatewayApp.getHttpServer())
      .post('/api/v1/enrollments')
      .send({ course_id: 'course-001' })
      .expect(401);
    const viewerToken = createAccessToken('viewer-001', 'viewer', JWT_SECRET, 3_600);
    await request(gatewayApp.getHttpServer())
      .post('/api/v1/enrollments')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ course_id: 'course-001' })
      .expect(403);
  });

  // Dựa vào state để lại từ test "logs in and enrolls" phía trên (cùng enrollmentApp/DB, cùng
  // principal seed student@example.test) — student đó đã enroll course-001 nên POST lại phải 409.
  it('rejects a duplicate enrollment with the canonical conflict envelope', async () => {
    const token = await login();
    await request(gatewayApp.getHttpServer())
      .post('/api/v1/enrollments')
      .set('Authorization', `Bearer ${token}`)
      .send({ course_id: 'course-001' })
      .expect(409)
      .expect(({ body }) => expect(body).toMatchObject({ code: 'CONFLICT', details: null }));
  });

  it('maps a Course connection failure seen from Enrollment to a stable Gateway envelope', async () => {
    const token = await login();
    const unavailableEnrollment = await createEnrollmentApp({
      ENROLLMENT_COURSE_BASE_URL: 'http://127.0.0.1:1',
    });
    const unavailableGateway = await createGatewayApp(address(unavailableEnrollment));
    try {
      await request(unavailableGateway.getHttpServer())
        .post('/api/v1/enrollments')
        .set('Authorization', `Bearer ${token}`)
        .send({ course_id: 'course-001' })
        .expect(503)
        .expect(({ body }) =>
          expect(body).toMatchObject({ code: 'DEPENDENCY_UNAVAILABLE', details: null }),
        );
    } finally {
      await unavailableGateway.close();
      await unavailableEnrollment.close();
    }
  }, 15_000);

  it('maps a Course timeout seen from Enrollment to a stable Gateway envelope', async () => {
    const token = await login();
    const hangingServer = http.createServer(() => {
      /* deliberately never responds, forcing Enrollment's client timeout */
    });
    await new Promise<void>((resolve) => hangingServer.listen(0, '127.0.0.1', resolve));
    const hangingPort = (hangingServer.address() as AddressInfo).port;
    const timeoutEnrollment = await createEnrollmentApp({
      ENROLLMENT_COURSE_BASE_URL: `http://127.0.0.1:${hangingPort}`,
      ENROLLMENT_COURSE_TIMEOUT_MS: 50,
    });
    const timeoutGateway = await createGatewayApp(address(timeoutEnrollment));
    try {
      await request(timeoutGateway.getHttpServer())
        .post('/api/v1/enrollments')
        .set('Authorization', `Bearer ${token}`)
        .send({ course_id: 'course-001' })
        .expect(504)
        .expect(({ body }) =>
          expect(body).toMatchObject({ code: 'DEPENDENCY_TIMEOUT', details: null }),
        );
    } finally {
      await timeoutGateway.close();
      await timeoutEnrollment.close();
      await new Promise<void>((resolve) => hangingServer.close(() => resolve()));
    }
  }, 15_000);
});

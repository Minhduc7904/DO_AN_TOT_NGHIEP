import { createHmac } from 'node:crypto';
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { Test } from '@nestjs/testing';
import request from 'supertest';

import {
  createHttpTelemetryMiddleware,
  startTelemetry,
} from '../packages/observability/src/index.js';
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
  SpanKind,
} from '../packages/observability/src/testing.js';
import { HttpExceptionFilter as AuthHttpExceptionFilter } from '../services/auth/src/adapters/http/http-exception.filter.js';
import {
  AuthRepository,
  type AuthUser,
  type RefreshTokenRecord,
} from '../services/auth/src/application/ports/auth-repository.js';
import { hashPassword } from '../services/auth/src/domain/password.js';
import { AppModule as AuthAppModule } from '../services/auth/src/app.module.js';
import { HttpExceptionFilter as GatewayHttpExceptionFilter } from '../services/gateway/src/adapters/http/http-exception.filter.js';
import {
  GATEWAY_FETCH,
  type FetchClient,
} from '../services/gateway/src/application/gateway-proxy.js';
import { AppModule as GatewayAppModule } from '../services/gateway/src/app.module.js';
import { ConfigService } from '../services/gateway/node_modules/@nestjs/config/dist/config.service.js';

const JWT_SECRET = 'w1-login-workflow-test-secret-with-at-least-thirty-two-characters';
const TRACEPARENT = '00-0123456789abcdef0123456789abcdef-0123456789abcdef-01';

interface TestApplication {
  close(): Promise<void>;
  getHttpServer(): Server;
  init(): Promise<unknown>;
  listen(port: number, host: string): Promise<unknown>;
  use(...middlewares: unknown[]): void;
  useGlobalFilters(...filters: unknown[]): void;
}

class CleanAuthRepository extends AuthRepository {
  readonly user: AuthUser = {
    email: 'student@example.test',
    id: 'student-001',
    passwordHash: '',
    role: 'student',
  };

  private readonly refreshTokens = new Map<string, RefreshTokenRecord>();

  reset(): void {
    this.refreshTokens.clear();
  }

  async createRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    this.refreshTokens.set(tokenHash, {
      expiresAt,
      id: `refresh-${this.refreshTokens.size + 1}`,
      tokenHash,
      user: { ...this.user, id: userId },
    });
  }

  async consumeRefreshToken(tokenHash: string): Promise<AuthUser | null> {
    const token = this.refreshTokens.get(tokenHash);
    if (!token || token.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    this.refreshTokens.delete(tokenHash);
    return token.user;
  }

  async findUserByEmail(email: string): Promise<AuthUser | null> {
    return email === this.user.email ? this.user : null;
  }
}

function createToken(role: string, expiresAt: number, secret = JWT_SECRET): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ exp: expiresAt, role, sub: 'student-001' }),
  ).toString('base64url');
  const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function listen(server: Server): Promise<void> {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
}

describe('W1 Client → Gateway → Auth → JWT workflow', () => {
  let authApp: TestApplication;
  let courseServer: Server;
  let gatewayApp: TestApplication;
  let repository: CleanAuthRepository;
  let receivedAuthTraceparent: string | undefined;
  let receivedCourseHeaders: IncomingHttpHeaders | undefined;
  let shouldTimeoutAuth = false;
  const exporter = new InMemorySpanExporter();
  const telemetry = startTelemetry(
    {
      enabled: true,
      otlpTracesEndpoint: 'http://127.0.0.1:4318/v1/traces',
      serviceInstanceId: 'w1-login-workflow-test-1',
      serviceName: 'gateway',
      serviceVersion: '0.1.0-test',
    },
    { spanProcessor: new SimpleSpanProcessor(exporter) },
  );

  beforeAll(async () => {
    repository = new CleanAuthRepository();
    repository.user.passwordHash = await hashPassword('example-password');

    const authConfig = {
      AUTH_JWT_SECRET: JWT_SECRET,
      AUTH_JWT_TTL_SECONDS: 3_600,
      AUTH_REFRESH_TTL_SECONDS: 86_400,
    };
    const authModule = await Test.createTestingModule({ imports: [AuthAppModule] })
      .overrideProvider(ConfigService)
      .useValue({
        getOrThrow: <Value>(key: keyof typeof authConfig): Value => authConfig[key] as Value,
      })
      .overrideProvider(AuthRepository)
      .useValue(repository)
      .compile();
    authApp = authModule.createNestApplication();
    authApp.use(createHttpTelemetryMiddleware());
    authApp.use(
      (incomingRequest: { headers: IncomingHttpHeaders }, _response: unknown, next: () => void) => {
        const traceparent = incomingRequest.headers.traceparent;
        receivedAuthTraceparent = Array.isArray(traceparent) ? traceparent[0] : traceparent;
        next();
      },
    );
    authApp.useGlobalFilters(new AuthHttpExceptionFilter());
    await authApp.listen(0, '127.0.0.1');

    courseServer = createServer((incomingRequest, response) => {
      receivedCourseHeaders = incomingRequest.headers;
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ id: 'course-001', title: 'Kiến trúc phần mềm' }));
    });
    await listen(courseServer);

    const authAddress = authApp.getHttpServer().address() as AddressInfo;
    const courseAddress = courseServer.address() as AddressInfo;
    const fetchClient: FetchClient = async (input, init) => {
      if (shouldTimeoutAuth && new URL(input.toString()).pathname === '/api/v1/auth/login') {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('upstream timeout')));
        });
      }
      return fetch(input, init);
    };

    const gatewayConfig = {
      GATEWAY_AUTH_BASE_URL: `http://127.0.0.1:${authAddress.port}`,
      GATEWAY_COURSE_BASE_URL: `http://127.0.0.1:${courseAddress.port}`,
      GATEWAY_JWT_SECRET: JWT_SECRET,
      GATEWAY_UPSTREAM_TIMEOUT_MS: 100,
    };

    const gatewayModule = await Test.createTestingModule({ imports: [GatewayAppModule] })
      .overrideProvider(ConfigService)
      .useValue({
        getOrThrow: <Value>(key: keyof typeof gatewayConfig): Value => gatewayConfig[key] as Value,
      })
      .overrideProvider(GATEWAY_FETCH)
      .useValue(fetchClient)
      .compile();
    gatewayApp = gatewayModule.createNestApplication();
    gatewayApp.use(createHttpTelemetryMiddleware());
    gatewayApp.useGlobalFilters(new GatewayHttpExceptionFilter());
    await gatewayApp.init();
  });

  beforeEach(() => {
    repository.reset();
    receivedAuthTraceparent = undefined;
    receivedCourseHeaders = undefined;
    shouldTimeoutAuth = false;
    exporter.reset();
  });

  afterAll(async () => {
    await gatewayApp?.close();
    await authApp?.close();
    await new Promise<void>((resolve, reject) =>
      courseServer.close((error) => (error ? reject(error) : resolve())),
    );
    await telemetry.shutdown();
  }, 15_000);

  it('issues a JWT through Gateway and accepts it on the protected route', async () => {
    const loginResponse = await request(gatewayApp.getHttpServer())
      .post('/api/v1/auth/login')
      .set('traceparent', TRACEPARENT)
      .send({ email: 'student@example.test', password: 'example-password' })
      .expect(200);

    expect(loginResponse.body).toMatchObject({
      expires_in_seconds: 3600,
      principal: { id: 'student-001', role: 'student' },
      token_type: 'Bearer',
    });
    expect(loginResponse.body.access_token.split('.')).toHaveLength(3);
    expect(receivedAuthTraceparent).toMatch(
      /^00-0123456789abcdef0123456789abcdef-[0-9a-f]{16}-01$/u,
    );
    expect(receivedAuthTraceparent).not.toBe(TRACEPARENT);

    await request(gatewayApp.getHttpServer())
      .get('/api/v1/courses')
      .set('Authorization', `Bearer ${loginResponse.body.access_token}`)
      .expect(200)
      .expect({ id: 'course-001', title: 'Kiến trúc phần mềm' });

    expect(receivedCourseHeaders).toMatchObject({
      'x-principal-id': 'student-001',
      'x-principal-role': 'student',
    });
    expect(receivedCourseHeaders?.authorization).toBeUndefined();
  });

  it('preserves the canonical invalid-credential envelope from Auth', async () => {
    const response = await request(gatewayApp.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'student@example.test', password: 'wrong-password' })
      .expect(401);

    expect(response.body).toMatchObject({ code: 'UNAUTHORIZED', details: null });
  });

  it('links Gateway server and client spans with the Auth server span through W3C context', async () => {
    await request(gatewayApp.getHttpServer())
      .post('/api/v1/auth/login')
      .set('traceparent', TRACEPARENT)
      .send({ email: 'student@example.test', password: 'example-password' })
      .expect(200);
    await telemetry.forceFlush();

    const spans = exporter.getFinishedSpans();
    const externalParentSpanId = TRACEPARENT.split('-')[2];
    const gatewayServerSpan = spans.find(
      (span) =>
        span.kind === SpanKind.SERVER && span.parentSpanContext?.spanId === externalParentSpanId,
    );
    const gatewayClientSpan = spans.find(
      (span) =>
        span.kind === SpanKind.CLIENT &&
        span.instrumentationScope.name === '@aiops-lms/gateway' &&
        span.parentSpanContext?.spanId === gatewayServerSpan?.spanContext().spanId,
    );
    const authServerSpan = spans.find(
      (span) =>
        span.kind === SpanKind.SERVER &&
        span.parentSpanContext?.spanId === gatewayClientSpan?.spanContext().spanId,
    );

    expect(gatewayServerSpan?.spanContext().traceId).toBe('0123456789abcdef0123456789abcdef');
    expect(gatewayClientSpan).toBeDefined();
    expect(authServerSpan).toBeDefined();
  });

  it.each([
    ['expired JWT', createToken('student', Math.floor(Date.now() / 1_000) - 60)],
    [
      'JWT with an invalid signature',
      createToken(
        'student',
        Math.floor(Date.now() / 1_000) + 3_600,
        'wrong-secret-with-at-least-thirty-two-characters',
      ),
    ],
  ])('rejects %s before it reaches Course', async (_description, token) => {
    const response = await request(gatewayApp.getHttpServer())
      .get('/api/v1/courses')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    expect(response.body.code).toBe('UNAUTHORIZED');
    expect(receivedCourseHeaders).toBeUndefined();
  });

  it('rejects a signed role that is not allowed to access Course', async () => {
    const response = await request(gatewayApp.getHttpServer())
      .get('/api/v1/courses')
      .set(
        'Authorization',
        `Bearer ${createToken('admin', Math.floor(Date.now() / 1_000) + 3_600)}`,
      )
      .expect(403);

    expect(response.body.code).toBe('FORBIDDEN');
    expect(receivedCourseHeaders).toBeUndefined();
  });

  it('maps an Auth timeout to the canonical dependency-timeout envelope', async () => {
    shouldTimeoutAuth = true;

    const response = await request(gatewayApp.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'student@example.test', password: 'example-password' })
      .expect(504);

    expect(response.body).toMatchObject({ code: 'DEPENDENCY_TIMEOUT', details: null });
  });
});

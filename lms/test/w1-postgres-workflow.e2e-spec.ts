import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { Test } from '@nestjs/testing';
import request from 'supertest';

import { HttpExceptionFilter as AuthHttpExceptionFilter } from '../services/auth/src/adapters/http/http-exception.filter.js';
import { PostgresAuthRepository } from '../services/auth/src/adapters/persistence/postgres-auth.repository.js';
import { AuthRepository } from '../services/auth/src/application/ports/auth-repository.js';
import { AppModule as AuthAppModule } from '../services/auth/src/app.module.js';
import { HttpExceptionFilter as GatewayHttpExceptionFilter } from '../services/gateway/src/adapters/http/http-exception.filter.js';
import { AppModule as GatewayAppModule } from '../services/gateway/src/app.module.js';
import { ConfigService } from '../services/gateway/node_modules/@nestjs/config/dist/config.service.js';

const JWT_SECRET = 'w1-postgres-workflow-test-secret-with-at-least-thirty-two-characters';

interface TestApplication {
  close(): Promise<void>;
  get<T = unknown>(token: unknown): T;
  getHttpServer(): Server;
  init(): Promise<unknown>;
  listen(port: number, host: string): Promise<unknown>;
  useGlobalFilters(...filters: unknown[]): void;
}

function getDatabaseUrl(): string {
  const databaseUrl = process.env.W1_AUTH_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('W1_AUTH_DATABASE_URL là bắt buộc cho kiểm thử PostgreSQL W1.');
  }
  return databaseUrl;
}

function listen(server: Server): Promise<void> {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
}

describe('W1 Client → Gateway → Auth → PostgreSQL → JWT workflow', () => {
  let authApp: TestApplication;
  let courseServer: Server;
  let gatewayApp: TestApplication;
  let receivedCourseHeaders: IncomingHttpHeaders | undefined;

  beforeAll(async () => {
    const authConfig = {
      AUTH_DATABASE_URL: getDatabaseUrl(),
      AUTH_JWT_SECRET: JWT_SECRET,
      AUTH_JWT_TTL_SECONDS: 3_600,
      AUTH_REFRESH_TTL_SECONDS: 86_400,
    };
    const authModule = await Test.createTestingModule({ imports: [AuthAppModule] })
      .overrideProvider(ConfigService)
      .useValue({
        getOrThrow: <Value>(key: keyof typeof authConfig): Value => authConfig[key] as Value,
      })
      .compile();
    authApp = authModule.createNestApplication();
    authApp.useGlobalFilters(new AuthHttpExceptionFilter());
    await authApp.listen(0, '127.0.0.1');

    expect(authApp.get(AuthRepository)).toBeInstanceOf(PostgresAuthRepository);

    courseServer = createServer((incomingRequest, response) => {
      receivedCourseHeaders = incomingRequest.headers;
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ id: 'course-001', title: 'Kiến trúc phần mềm' }));
    });
    await listen(courseServer);

    const authAddress = authApp.getHttpServer().address() as AddressInfo;
    const courseAddress = courseServer.address() as AddressInfo;
    const gatewayConfig = {
      GATEWAY_AUTH_BASE_URL: `http://127.0.0.1:${authAddress.port}`,
      GATEWAY_COURSE_BASE_URL: `http://127.0.0.1:${courseAddress.port}`,
      GATEWAY_JWT_SECRET: JWT_SECRET,
      GATEWAY_UPSTREAM_TIMEOUT_MS: 500,
    };
    const gatewayModule = await Test.createTestingModule({ imports: [GatewayAppModule] })
      .overrideProvider(ConfigService)
      .useValue({
        getOrThrow: <Value>(key: keyof typeof gatewayConfig): Value => gatewayConfig[key] as Value,
      })
      .compile();
    gatewayApp = gatewayModule.createNestApplication();
    gatewayApp.useGlobalFilters(new GatewayHttpExceptionFilter());
    await gatewayApp.init();
  });

  beforeEach(() => {
    receivedCourseHeaders = undefined;
  });

  afterAll(async () => {
    await gatewayApp?.close();
    await authApp?.close();
    if (courseServer) {
      await new Promise<void>((resolve, reject) =>
        courseServer.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('migrates and seeds a clean PostgreSQL database before Gateway issues a usable JWT', async () => {
    const loginResponse = await request(gatewayApp.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'student@example.test', password: 'example-password' })
      .expect(200);

    expect(loginResponse.body).toMatchObject({
      expires_in_seconds: 3_600,
      principal: { role: 'student' },
      token_type: 'Bearer',
    });
    expect(loginResponse.body.access_token.split('.')).toHaveLength(3);

    await request(gatewayApp.getHttpServer())
      .get('/api/v1/courses')
      .set('Authorization', `Bearer ${loginResponse.body.access_token}`)
      .expect(200)
      .expect({ id: 'course-001', title: 'Kiến trúc phần mềm' });

    expect(receivedCourseHeaders).toMatchObject({
      'x-principal-role': 'student',
    });
  });
});

import { createHmac } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { jest } from '@jest/globals';
import request from 'supertest';

import { GATEWAY_FETCH, type FetchClient } from '../../src/application/gateway-proxy.js';
import { HttpExceptionFilter } from '../../src/adapters/http/http-exception.filter.js';
import { AppModule } from '../../src/app.module.js';

const secret = 'local-development-only-jwt-secret-change-before-production';

function createToken(role = 'student'): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1_000) + 3_600, role, sub: 'student-001' }),
  ).toString('base64url');
  const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

describe('Gateway HTTP contract', () => {
  let app: INestApplication;
  let fetchClient: jest.MockedFunction<FetchClient>;

  beforeAll(async () => {
    fetchClient = jest.fn();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GATEWAY_FETCH)
      .useValue(fetchClient)
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('forwards login without a bearer token and preserves the downstream error envelope', async () => {
    fetchClient.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 'UNAUTHORIZED',
          details: null,
          message: 'Email hoặc mật khẩu không đúng',
          timestamp: '2026-09-16T00:00:00.000Z',
          trace_id: 'trace-auth',
        }),
        { headers: { 'content-type': 'application/json' }, status: 401 },
      ),
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'student@example.test', password: 'wrong-password' })
      .expect(401);

    expect(response.body).toMatchObject({ code: 'UNAUTHORIZED', trace_id: 'trace-auth' });
    expect(fetchClient.mock.calls[0]?.[1]?.headers).not.toHaveProperty('x-principal-id');
  });

  it('rejects missing or malformed JWT before making a Course request', async () => {
    await request(app.getHttpServer()).get('/api/v1/courses').expect(401);
    await request(app.getHttpServer()).get('/api/v1/courses').set('Authorization', 'Bearer invalid').expect(401);

    expect(fetchClient).not.toHaveBeenCalled();
  });

  it('derives trusted principal headers and returns 403 for a signed but unauthorized role', async () => {
    fetchClient.mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: 'course-001' }]), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );

    await request(app.getHttpServer())
      .get('/api/v1/courses')
      .set('Authorization', `Bearer ${createToken()}`)
      .set('x-principal-id', 'spoofed-client')
      .set('x-principal-role', 'admin')
      .expect(200);

    const forwardedHeaders = new Headers(fetchClient.mock.calls[0]?.[1]?.headers);
    expect(forwardedHeaders.get('x-principal-id')).toBe('student-001');
    expect(forwardedHeaders.get('x-principal-role')).toBe('student');

    const forbidden = await request(app.getHttpServer())
      .get('/api/v1/courses')
      .set('Authorization', `Bearer ${createToken('admin')}`)
      .expect(403);
    expect(forbidden.body.code).toBe('FORBIDDEN');
  });
});

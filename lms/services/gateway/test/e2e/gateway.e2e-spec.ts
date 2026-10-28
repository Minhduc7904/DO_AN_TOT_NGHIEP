import { createHash } from 'node:crypto';
import {
  createServer,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';

import {
  generateSigningKey,
  toJwk,
  TokenVerifier,
  StaticKeyProvider,
} from '@aiops-lms/common/auth';
import { mintServiceToken, mintUserToken } from '@aiops-lms/common/auth/testing';
import { AppExceptionFilter, correlationIdMiddleware } from '@aiops-lms/common/http';
import { apiErrorSchema, apiResponseSchema } from '@aiops-lms/contracts';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { z } from 'zod';
import request from 'supertest';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const GATEWAY_SECRET = 'gateway-secret-e2e-0123456789';
const key = generateSigningKey();

function token(role: string): string {
  return mintUserToken(key, { subject: USER_ID, role });
}

interface Seen {
  method: string;
  url: string;
  headers: IncomingHttpHeaders;
  body: Buffer;
}

interface Stub {
  server: Server;
  url: string;
  seen: Seen[];
}

type StubHandler = (seen: Seen, response: ServerResponse) => void;

async function startStub(handler: StubHandler): Promise<Stub> {
  const seen: Seen[] = [];
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const entry: Seen = {
        method: req.method ?? '',
        url: req.url ?? '',
        headers: req.headers,
        body: Buffer.concat(chunks),
      };
      seen.push(entry);
      handler(entry, res);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, seen };
}

function envelope(data: unknown): string {
  return JSON.stringify({
    success: true,
    data,
    error: null,
    meta: { trace_id: 'stub', timestamp: new Date().toISOString(), pagination: null },
  });
}

const json = { 'content-type': 'application/json; charset=utf-8' };

/**
 * Gateway thật (Nest + fetch) trước các upstream HTTP giả: kiểm tra xác thực, role, chuyển tiếp
 * nguyên vẹn (kể cả mã nghiệp vụ 5xx), stream byte/Range và lỗi do chính Gateway sinh.
 */
describe('gateway (upstream HTTP giả)', () => {
  let app: INestApplication;
  const stubs: Stub[] = [];
  let auth: Stub;
  let student: Stub;
  let media: Stub;
  let ai: Stub;
  let scheduler: Stub;

  beforeAll(async () => {
    // Auth giả: JWKS, cấp service token (đếm số lần gọi để kiểm cache) và cửa đăng nhập.
    auth = await startStub((seen, res) => {
      if (seen.url === '/.well-known/jwks.json') {
        res.writeHead(200, json).end(JSON.stringify({ keys: [toJwk(key.publicKey)] }));
        return;
      }
      if (seen.url === '/internal/v1/auth/service-token') {
        const body = JSON.parse(seen.body.toString('utf8')) as {
          audience: string;
          client_id: string;
          client_secret: string;
        };
        if (body.client_id !== 'gateway' || body.client_secret !== GATEWAY_SECRET) {
          res.writeHead(401, json).end('{}');
          return;
        }
        res.writeHead(200, json).end(
          envelope({
            access_token: mintServiceToken(key, {
              subject: 'gateway',
              audience: body.audience,
              scopes: ['gateway:proxy'],
            }),
            token_type: 'Bearer',
            expires_in: 600,
            scope: 'gateway:proxy',
          }),
        );
        return;
      }
      res.writeHead(200, json).end(envelope({ access_token: 'stub' }));
    });
    student = await startStub((_seen, res) => {
      res.writeHead(200, json).end(envelope({ id: USER_ID }));
    });
    media = await startStub((seen, res) => {
      if (seen.url.endsWith('/content')) {
        const range = seen.headers.range;
        res
          .writeHead(range ? 206 : 200, {
            'content-type': 'video/mp4',
            'accept-ranges': 'bytes',
            ...(range ? { 'content-range': 'bytes 0-3/10' } : {}),
            'cache-control': 'no-store',
          })
          .end(Buffer.from([0, 1, 2, 3]));
        return;
      }
      // Echo byte nhận được để kiểm tra body được chuyển nguyên vẹn.
      res.writeHead(201, json).end(
        envelope({
          bytes: seen.body.length,
          sha256: createHash('sha256').update(seen.body).digest('hex'),
          contentType: seen.headers['content-type'],
        }),
      );
    });
    ai = await startStub((_seen, res) => {
      // Mã nghiệp vụ của ai phải đến được client nguyên vẹn dù là 5xx.
      res.writeHead(502, json).end(
        JSON.stringify({
          success: false,
          data: null,
          error: {
            code: 'AI_PROVIDER_ERROR',
            message: 'Provider lỗi',
            details: { retryable: true },
          },
          meta: { trace_id: 'ai-trace', timestamp: '2026-11-02T00:00:00.000Z', pagination: null },
        }),
      );
    });
    scheduler = await startStub((seen, res) => {
      if (seen.url.includes('/slow')) return; // không bao giờ trả lời → gateway phải timeout
      res.writeHead(500, json).end(
        JSON.stringify({
          success: false,
          data: null,
          error: { code: 'INTERNAL_ERROR', message: 'Đã xảy ra lỗi nội bộ', details: null },
          meta: { trace_id: 'sch-trace', timestamp: '2026-11-02T00:00:00.000Z', pagination: null },
        }),
      );
    });
    stubs.push(auth, student, media, ai, scheduler);

    Object.assign(process.env, {
      OTEL_SDK_DISABLED: 'true',
      SERVICE_CLIENT_ID: 'gateway',
      SERVICE_CLIENT_SECRET: GATEWAY_SECRET,
      GATEWAY_UPSTREAM_TIMEOUT_MS: '300',
      GATEWAY_AUTH_BASE_URL: auth.url,
      GATEWAY_STUDENT_BASE_URL: student.url,
      GATEWAY_MEDIA_BASE_URL: media.url,
      GATEWAY_AI_BASE_URL: ai.url,
      GATEWAY_SCHEDULER_BASE_URL: scheduler.url,
      // Cổng không ai nghe: course không kết nối được.
      GATEWAY_COURSE_BASE_URL: 'http://127.0.0.1:9',
    });
    const { AppModule } = await import('../../src/app.module.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bodyParser: false });
    app.use(correlationIdMiddleware);
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    for (const stub of stubs) {
      stub.server.closeAllConnections();
      await new Promise((resolve) => stub.server.close(resolve));
    }
  });

  const bearer = (role: string): { authorization: string } => ({
    authorization: `Bearer ${token(role)}`,
  });

  it('route công khai chuyển tiếp không cần token và giữ nguyên body upstream', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/student/login')
      .send({ email: 'student@example.test', password: 'example-password' })
      .expect(200);

    expect(
      apiResponseSchema(z.object({ access_token: z.string() })).parse(response.body).data,
    ).toEqual({ access_token: 'stub' });
    const seen = auth.seen.at(-1);
    expect(seen?.url).toBe('/api/v1/auth/student/login');
    expect(JSON.parse(seen?.body.toString('utf8') ?? '{}')).toEqual({
      email: 'student@example.test',
      password: 'example-password',
    });
    expect(seen?.headers).not.toHaveProperty('x-principal-id');
  });

  it('đặt danh tính từ JWT, bỏ giả mạo và Authorization, chuyển correlation id và query', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/students?page=2&page_size=5')
      .set({
        ...bearer('student'),
        'x-principal-id': '99999999-9999-4999-8999-999999999999',
        'x-principal-role': 'admin',
        'x-correlation-id': 'corr-e2e-1',
      })
      .expect(200);

    const seen = student.seen.at(-1);
    expect(seen?.url).toBe('/api/v1/students?page=2&page_size=5');
    expect(seen?.headers).toMatchObject({
      'x-principal-id': USER_ID,
      'x-principal-role': 'student',
      'x-correlation-id': 'corr-e2e-1',
    });
    // Authorization của client không đến upstream; thay bằng service token của gateway.
    const upstreamToken = String(seen?.headers.authorization ?? '').replace(/^Bearer /u, '');
    await expect(
      new TokenVerifier(new StaticKeyProvider([key])).verify(upstreamToken, {
        type: 'service',
        audience: 'student',
      }),
    ).resolves.toMatchObject({ subject: 'gateway', scopes: ['gateway:proxy'] });
    expect(seen?.headers.authorization).not.toBe(bearer('student').authorization);
  });

  it('service token được cache: nhiều request cùng upstream chỉ xin token một lần', async () => {
    const tokenRequests = (): number =>
      auth.seen.filter((entry) => entry.url === '/internal/v1/auth/service-token').length;
    await request(app.getHttpServer()).get('/api/v1/students').set(bearer('admin')).expect(200);
    const before = tokenRequests();
    await Promise.all(
      [1, 2, 3, 4].map(() =>
        request(app.getHttpServer()).get('/api/v1/students').set(bearer('admin')).expect(200),
      ),
    );
    expect(tokenRequests()).toBe(before);
  });

  it('service token không dùng được như user token → 401 TOKEN_TYPE_MISMATCH', async () => {
    const service = mintServiceToken(key, {
      subject: 'gateway',
      audience: 'aiops-lms',
      scopes: ['gateway:proxy'],
    });
    const response = await request(app.getHttpServer())
      .get('/api/v1/students')
      .set({ authorization: `Bearer ${service}` })
      .expect(401);
    expect(apiErrorSchema.parse(response.body).error.code).toBe('TOKEN_TYPE_MISMATCH');
  });

  it('thiếu hoặc sai token → 401 envelope; sai role → 403 envelope; không chạm upstream', async () => {
    const before = scheduler.seen.length + ai.seen.length;

    const missing = await request(app.getHttpServer()).get('/api/v1/students').expect(401);
    expect(apiErrorSchema.parse(missing.body).error.code).toBe('UNAUTHORIZED');
    expect(missing.headers['x-correlation-id']).toBeTruthy();
    await request(app.getHttpServer())
      .get('/api/v1/students')
      .set({ authorization: 'Bearer rác' })
      .expect(401);
    // Cửa đăng nhập cũ chung đã bỏ: không public nữa nên cũng cần token.
    await request(app.getHttpServer()).post('/api/v1/auth/login').send({}).expect(401);

    for (const role of ['student', 'instructor']) {
      const denied = await request(app.getHttpServer())
        .get('/api/v1/scheduler/jobs')
        .set(bearer(role))
        .expect(403);
      expect(apiErrorSchema.parse(denied.body).error.code).toBe('FORBIDDEN');
      await request(app.getHttpServer()).get('/api/v1/ai/providers').set(bearer(role)).expect(403);
    }
    expect(scheduler.seen.length + ai.seen.length).toBe(before);
  });

  it('giữ nguyên mã nghiệp vụ 5xx của upstream (status, code, details, meta)', async () => {
    const aiError = await request(app.getHttpServer())
      .get('/api/v1/ai/providers')
      .set(bearer('admin'))
      .expect(502);
    expect(aiError.body).toEqual({
      success: false,
      data: null,
      error: { code: 'AI_PROVIDER_ERROR', message: 'Provider lỗi', details: { retryable: true } },
      meta: { trace_id: 'ai-trace', timestamp: '2026-11-02T00:00:00.000Z', pagination: null },
    });

    const internal = await request(app.getHttpServer())
      .get('/api/v1/scheduler/jobs')
      .set(bearer('admin'))
      .expect(500);
    expect(apiErrorSchema.parse(internal.body).error.code).toBe('INTERNAL_ERROR');
    expect(internal.body.meta.trace_id).toBe('sch-trace');
  });

  it('upstream không kết nối được → 503 envelope, quá hạn → 504 envelope', async () => {
    const down = await request(app.getHttpServer())
      .get('/api/v1/courses')
      .set(bearer('student'))
      .expect(503);
    expect(apiErrorSchema.parse(down.body).error).toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
      details: { dependency: 'gateway-course' },
    });

    const slow = await request(app.getHttpServer())
      .get('/api/v1/scheduler/slow')
      .set(bearer('admin'))
      .expect(504);
    expect(apiErrorSchema.parse(slow.body).error).toMatchObject({
      code: 'DEPENDENCY_TIMEOUT',
      details: { dependency: 'gateway-scheduler' },
    });
  });

  it('chuyển body nhị phân lớn nguyên vẹn (không parse) cùng content-type', async () => {
    const payload = Buffer.alloc(300_000);
    for (let index = 0; index < payload.length; index += 1) payload[index] = index % 251;

    const response = await request(app.getHttpServer())
      .post('/api/v1/media')
      .set({ ...bearer('instructor'), 'content-type': 'multipart/form-data; boundary=xyz' })
      .send(payload)
      .expect(201);

    expect(response.body.data).toEqual({
      bytes: payload.length,
      sha256: createHash('sha256').update(payload).digest('hex'),
      contentType: 'multipart/form-data; boundary=xyz',
    });
  });

  it('media content công khai, stream byte và giữ Range/Content-Range', async () => {
    const full = await request(app.getHttpServer())
      .get('/api/v1/media/abc/content')
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(full.headers['content-type']).toBe('video/mp4');
    expect(full.headers['accept-ranges']).toBe('bytes');
    expect(full.body).toEqual(Buffer.from([0, 1, 2, 3]));
    expect(media.seen.at(-1)?.headers).not.toHaveProperty('x-principal-id');

    const partial = await request(app.getHttpServer())
      .get('/api/v1/media/abc/content')
      .set('range', 'bytes=0-3')
      .expect(206);
    expect(partial.headers['content-range']).toBe('bytes 0-3/10');
    expect(media.seen.at(-1)?.headers.range).toBe('bytes=0-3');
  });

  it('không proxy /internal, dot-segment, route lạ hay route v1 đã gỡ → 404 envelope', async () => {
    const before = stubs.reduce((sum, stub) => sum + stub.seen.length, 0);
    const paths = [
      '/internal/v1/students',
      '/internal/v1/auth/service-token',
      '/.well-known/jwks.json',
      '/api/v1/auth/%2e%2e/%2e%2e/%2e%2e/internal/v1/students',
      '/api/v1/unknown',
      '/api/v1/enrollments',
      '/api/v1/admins/00000000-0000-4000-8000-000000000001',
    ];

    for (const path of paths) {
      const response = await request(app.getHttpServer())
        .get(path)
        .set(bearer('admin'))
        .expect(404);
      expect(apiErrorSchema.parse(response.body).error.code).toBe('NOT_FOUND');
    }
    expect(stubs.reduce((sum, stub) => sum + stub.seen.length, 0)).toBe(before);
  });

  it('/health của gateway trả envelope', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);
    expect(response.body).toMatchObject({ success: true, error: null, data: { status: 'ok' } });
  });
});

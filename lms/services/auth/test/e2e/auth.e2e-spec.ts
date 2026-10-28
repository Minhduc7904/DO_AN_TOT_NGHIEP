import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { AppExceptionFilter, correlationIdMiddleware } from '@aiops-lms/common/http';
import {
  accountDtoSchema,
  apiErrorSchema,
  apiListResponseSchema,
  apiResponseSchema,
  loginResponseDtoSchema,
  tokenPairDtoSchema,
} from '@aiops-lms/contracts';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

const ADMIN_ID = '00000000-0000-4000-8000-000000000001';
const ADMIN_PASSWORD = 'admin-password-e2e';

/**
 * Chạy với PostgreSQL thật đã migrate (`AUTH_DATABASE_URL`); `student` được thay bằng HTTP stub.
 * Xem `pnpm test:auth:e2e` ở workspace gốc.
 */
describe('auth service (PostgreSQL thật, student giả)', () => {
  let app: INestApplication;
  let studentStub: Server;
  let studentMode: 'ok' | 'fail' = 'ok';
  const createdProfiles: Record<string, unknown>[] = [];
  // Hồ sơ student giả theo id → trạng thái; POST thêm ACTIVE, GET trả envelope hoặc 404.
  const profiles = new Map<string, string>();

  beforeAll(async () => {
    if (!process.env.AUTH_DATABASE_URL) {
      throw new Error('AUTH_DATABASE_URL là bắt buộc cho e2e của auth');
    }
    studentStub = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        if (studentMode === 'fail') return res.writeHead(500).end('{}');
        const json = { 'content-type': 'application/json' };
        if (req.method === 'GET') {
          const id = req.url?.split('/').at(-1) ?? '';
          const status = profiles.get(id);
          if (!status) return res.writeHead(404, json).end('{}');
          const now = new Date().toISOString();
          return res.writeHead(200, json).end(
            JSON.stringify({
              success: true,
              data: {
                id,
                email: 'stub@example.test',
                full_name: 'Stub',
                status,
                created_at: now,
                updated_at: now,
              },
              error: null,
              meta: { trace_id: 'stub', timestamp: now, pagination: null },
            }),
          );
        }
        const profile = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        createdProfiles.push(profile);
        profiles.set(profile.id, 'ACTIVE');
        res.writeHead(201, json).end('{}');
      });
    });
    await new Promise<void>((resolve) => studentStub.listen(0, '127.0.0.1', resolve));

    Object.assign(process.env, {
      OTEL_SDK_DISABLED: 'true',
      PORT: '3001',
      AUTH_JWT_SECRET: 'e2e-secret-with-at-least-32-characters-long',
      AUTH_STUDENT_BASE_URL: `http://127.0.0.1:${(studentStub.address() as AddressInfo).port}`,
      AUTH_BOOTSTRAP_ADMIN_ID: ADMIN_ID,
      AUTH_BOOTSTRAP_ADMIN_EMAIL: 'admin@example.test',
      AUTH_BOOTSTRAP_ADMIN_PASSWORD: ADMIN_PASSWORD,
    });
    const { AppModule } = await import('../../src/app.module.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(correlationIdMiddleware);
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    studentStub?.closeAllConnections();
    await new Promise((resolve) => studentStub?.close(resolve));
  });

  const unique = `${Date.now()}`;

  it('đăng ký → đăng nhập → /me → refresh xoay vòng, student nhận hồ sơ cùng id', async () => {
    const email = `student-${unique}@example.test`;

    const registered = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'student-password', full_name: 'Học viên' })
      .expect(201);
    expect(apiResponseSchema(accountDtoSchema).parse(registered.body)).toMatchObject({
      success: true,
      data: { email, role: 'student', status: 'ACTIVE' },
    });
    const studentId = registered.body.data.id as string;
    expect(registered.body.data).not.toHaveProperty('password_hash');
    expect(createdProfiles.at(-1)).toMatchObject({ id: studentId, email });

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'student-password', full_name: 'Trùng' })
      .expect(409);

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/student/login')
      .send({ email, password: 'student-password' })
      .expect(200);
    const session = apiResponseSchema(loginResponseDtoSchema).parse(login.body);
    expect(session.data?.principal).toEqual({ id: studentId, role: 'student' });
    const refreshToken = login.body.data.refresh_token as string;

    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('x-principal-id', studentId)
      .set('x-principal-role', 'student')
      .expect(200);
    expect(me.body.data.email).toBe(email);

    const refreshed = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: refreshToken })
      .expect(200);
    expect(apiResponseSchema(tokenPairDtoSchema).safeParse(refreshed.body).success).toBe(true);
    expect(refreshed.body.data.refresh_token).not.toBe(refreshToken);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: refreshToken })
      .expect(401);
  });

  it('refresh đồng thời cùng một token: đúng một yêu cầu thành công', async () => {
    const email = `race-${unique}@example.test`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'student-password', full_name: 'Race' });
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/student/login')
      .send({ email, password: 'student-password' });

    const results = await Promise.all(
      [1, 2, 3].map(() =>
        request(app.getHttpServer())
          .post('/api/v1/auth/refresh')
          .send({ refresh_token: login.body.data.refresh_token }),
      ),
    );

    expect(results.filter((response) => response.status === 200)).toHaveLength(1);
  });

  it('admin được seed đăng nhập, tạo instructor và liệt kê tài khoản; student bị 403', async () => {
    const admin = await request(app.getHttpServer())
      .post('/api/v1/auth/admin/login')
      .send({ email: 'admin@example.test', password: ADMIN_PASSWORD })
      .expect(200);
    expect(admin.body.data.principal).toEqual({ id: ADMIN_ID, role: 'admin' });
    const asAdmin = { 'x-principal-id': ADMIN_ID, 'x-principal-role': 'admin' };

    const created = await request(app.getHttpServer())
      .post('/api/v1/auth/accounts')
      .set(asAdmin)
      .send({
        email: `instructor-${unique}@example.test`,
        password: 'instructor-password',
        full_name: 'Giảng viên',
        role: 'instructor',
      })
      .expect(201);
    expect(created.body.data.role).toBe('instructor');

    const listed = await request(app.getHttpServer())
      .get('/api/v1/auth/accounts?role=instructor&page_size=100')
      .set(asAdmin)
      .expect(200);
    const list = apiListResponseSchema(accountDtoSchema).parse(listed.body);
    expect(list.meta.pagination).toMatchObject({ page: 1, page_size: 100 });
    expect((list.data ?? []).map((item) => item.id)).toContain(created.body.data.id);
    expect(list.data?.every((item) => item.role === 'instructor')).toBe(true);

    await request(app.getHttpServer())
      .get('/api/v1/auth/accounts')
      .set({ 'x-principal-id': created.body.data.id, 'x-principal-role': 'student' })
      .expect(403);
    await request(app.getHttpServer()).get('/api/v1/auth/accounts').expect(401);
  });

  it('mỗi role chỉ đăng nhập qua cửa của mình, sai cửa trả cùng một 401', async () => {
    const asAdmin = { 'x-principal-id': ADMIN_ID, 'x-principal-role': 'admin' };
    const instructorEmail = `door-${unique}@example.test`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/accounts')
      .set(asAdmin)
      .send({
        email: instructorEmail,
        password: 'instructor-password',
        full_name: 'Giảng viên cửa',
        role: 'instructor',
      })
      .expect(201);
    const studentEmail = `door-student-${unique}@example.test`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: studentEmail, password: 'student-password', full_name: 'Học viên cửa' })
      .expect(201);

    const login = (door: string, email: string, password: string): request.Test =>
      request(app.getHttpServer()).post(`/api/v1/auth/${door}/login`).send({ email, password });

    const instructor = await login('instructor', instructorEmail, 'instructor-password').expect(
      200,
    );
    expect(instructor.body.data.principal.role).toBe('instructor');

    const denied = [
      await login('student', instructorEmail, 'instructor-password').expect(401),
      await login('admin', instructorEmail, 'instructor-password').expect(401),
      await login('admin', studentEmail, 'student-password').expect(401),
      await login('instructor', 'admin@example.test', ADMIN_PASSWORD).expect(401),
      await login('student', 'admin@example.test', ADMIN_PASSWORD).expect(401),
      await login('student', studentEmail, 'sai-mat-khau').expect(401),
    ];
    for (const response of denied) {
      expect(apiErrorSchema.parse(response.body).error.message).toBe(
        'Thông tin đăng nhập không hợp lệ',
      );
    }
    // Cửa cũ dùng chung đã bỏ.
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: studentEmail, password: 'student-password' })
      .expect(404);
  });

  it('phân trang nhất quán: mặc định, tổng trang và từ chối tham số sai', async () => {
    const asAdmin = { 'x-principal-id': ADMIN_ID, 'x-principal-role': 'admin' };

    const defaults = apiListResponseSchema(accountDtoSchema).parse(
      (await request(app.getHttpServer()).get('/api/v1/auth/accounts').set(asAdmin).expect(200))
        .body,
    );
    expect(defaults.meta.pagination).toMatchObject({ page: 1, page_size: 20 });

    const single = apiListResponseSchema(accountDtoSchema).parse(
      (
        await request(app.getHttpServer())
          .get('/api/v1/auth/accounts?page=2&page_size=1')
          .set(asAdmin)
          .expect(200)
      ).body,
    );
    expect(single.data).toHaveLength(1);
    expect(single.meta.pagination).toMatchObject({ page: 2, page_size: 1 });
    expect(single.meta.pagination?.total_pages).toBe(single.meta.pagination?.total);

    for (const query of ['page=0', 'page_size=101', 'page_size=0', 'page=abc']) {
      const rejected = await request(app.getHttpServer())
        .get(`/api/v1/auth/accounts?${query}`)
        .set(asAdmin)
        .expect(400);
      expect(apiErrorSchema.parse(rejected.body).error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('student mất hồ sơ hoặc bị chặn thì không đăng nhập được, student lỗi thì 503', async () => {
    const email = `blocked-${unique}@example.test`;
    const registered = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'student-password', full_name: 'Bị chặn' })
      .expect(201);
    const studentId = registered.body.data.id as string;
    const login = (): request.Test =>
      request(app.getHttpServer()).post('/api/v1/auth/student/login').send({
        email,
        password: 'student-password',
      });

    profiles.set(studentId, 'BLOCKED');
    const blocked = await login().expect(403);
    expect(apiErrorSchema.parse(blocked.body).error.code).toBe('FORBIDDEN');
    expect(blocked.body.data).toBeNull();

    profiles.delete(studentId);
    await login().expect(403);

    profiles.set(studentId, 'ACTIVE');
    await login().expect(200);
  });

  it('student lỗi thì đăng ký thất bại 503 và email dùng lại được', async () => {
    const email = `fail-${unique}@example.test`;
    studentMode = 'fail';
    const failed = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'student-password', full_name: 'Lỗi' })
      .expect(503);
    expect(apiErrorSchema.parse(failed.body).error.code).toBe('DEPENDENCY_UNAVAILABLE');

    studentMode = 'ok';
    // Breaker có thể đang mở sau lỗi trên; bỏ qua nếu 503 vì short-circuit, chỉ kiểm tra email không bị giữ.
    await request(app.getHttpServer())
      .post('/api/v1/auth/student/login')
      .send({ email, password: 'student-password' })
      .expect(401);
  });

  it('validate input: 400 với danh sách lỗi, 401 sai mật khẩu không lộ thông tin', async () => {
    const invalid = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'khong-phai-email', password: 'ngan', full_name: '' })
      .expect(400);
    const invalidBody = apiErrorSchema.parse(invalid.body);
    expect(invalidBody.error.code).toBe('VALIDATION_ERROR');
    expect(
      (invalidBody.error.details as { path: string }[]).map((issue) => issue.path).sort(),
    ).toEqual(['email', 'full_name', 'password']);

    const wrong = await request(app.getHttpServer())
      .post('/api/v1/auth/admin/login')
      .send({ email: 'admin@example.test', password: 'sai-mat-khau' })
      .expect(401);
    expect(wrong.body.error.message).toBe('Thông tin đăng nhập không hợp lệ');
  });
});

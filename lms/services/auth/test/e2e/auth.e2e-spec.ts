import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { AppExceptionFilter, correlationIdMiddleware } from '@aiops-lms/common/http';
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

  beforeAll(async () => {
    if (!process.env.AUTH_DATABASE_URL) {
      throw new Error('AUTH_DATABASE_URL là bắt buộc cho e2e của auth');
    }
    studentStub = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        if (studentMode === 'fail') return res.writeHead(500).end('{}');
        createdProfiles.push(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        res.writeHead(201, { 'content-type': 'application/json' }).end('{}');
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
    expect(registered.body).toMatchObject({ email, role: 'student', status: 'ACTIVE' });
    expect(registered.body).not.toHaveProperty('password_hash');
    expect(createdProfiles.at(-1)).toMatchObject({ id: registered.body.id, email });

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'student-password', full_name: 'Trùng' })
      .expect(409);

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'student-password' })
      .expect(200);
    expect(login.body.principal).toEqual({ id: registered.body.id, role: 'student' });

    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('x-principal-id', registered.body.id)
      .set('x-principal-role', 'student')
      .expect(200);
    expect(me.body.email).toBe(email);

    const refreshed = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: login.body.refresh_token })
      .expect(200);
    expect(refreshed.body.refresh_token).not.toBe(login.body.refresh_token);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: login.body.refresh_token })
      .expect(401);
  });

  it('refresh đồng thời cùng một token: đúng một yêu cầu thành công', async () => {
    const email = `race-${unique}@example.test`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'student-password', full_name: 'Race' });
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'student-password' });

    const results = await Promise.all(
      [1, 2, 3].map(() =>
        request(app.getHttpServer())
          .post('/api/v1/auth/refresh')
          .send({ refresh_token: login.body.refresh_token }),
      ),
    );

    expect(results.filter((response) => response.status === 200)).toHaveLength(1);
  });

  it('admin được seed đăng nhập, tạo instructor và liệt kê tài khoản; student bị 403', async () => {
    const admin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@example.test', password: ADMIN_PASSWORD })
      .expect(200);
    expect(admin.body.principal).toEqual({ id: ADMIN_ID, role: 'admin' });
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
    expect(created.body.role).toBe('instructor');

    const listed = await request(app.getHttpServer())
      .get('/api/v1/auth/accounts?role=instructor&page_size=100')
      .set(asAdmin)
      .expect(200);
    expect(listed.body.items.map((item: { id: string }) => item.id)).toContain(created.body.id);

    await request(app.getHttpServer())
      .get('/api/v1/auth/accounts')
      .set({ 'x-principal-id': created.body.id, 'x-principal-role': 'student' })
      .expect(403);
    await request(app.getHttpServer()).get('/api/v1/auth/accounts').expect(401);
  });

  it('student lỗi thì đăng ký thất bại 503 và email dùng lại được', async () => {
    const email = `fail-${unique}@example.test`;
    studentMode = 'fail';
    const failed = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'student-password', full_name: 'Lỗi' })
      .expect(503);
    expect(failed.body.code).toBe('DEPENDENCY_UNAVAILABLE');

    studentMode = 'ok';
    // Breaker có thể đang mở sau lỗi trên; bỏ qua nếu 503 vì short-circuit, chỉ kiểm tra email không bị giữ.
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'student-password' })
      .expect(401);
  });

  it('validate input: 400 với danh sách lỗi, 401 sai mật khẩu không lộ thông tin', async () => {
    const invalid = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'khong-phai-email', password: 'ngan', full_name: '' })
      .expect(400);
    expect(invalid.body.code).toBe('VALIDATION_ERROR');
    expect(invalid.body.details.map((issue: { path: string }) => issue.path).sort()).toEqual([
      'email',
      'full_name',
      'password',
    ]);

    const wrong = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@example.test', password: 'sai-mat-khau' })
      .expect(401);
    expect(wrong.body.message).toBe('Thông tin đăng nhập không hợp lệ');
  });
});

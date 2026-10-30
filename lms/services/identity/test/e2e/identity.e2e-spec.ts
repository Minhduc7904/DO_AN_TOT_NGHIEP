import { generateKeyPairSync, randomUUID } from 'node:crypto';

import { AppExceptionFilter, correlationIdMiddleware } from '@aiops-lms/common/http';
import {
  accountDtoSchema,
  apiErrorSchema,
  apiListResponseSchema,
  apiResponseSchema,
  loginResponseDtoSchema,
  studentDtoSchema,
  tokenPairDtoSchema,
} from '@aiops-lms/contracts';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { PrismaService } from '../../src/adapters/persistence/prisma.service.js';

const ADMIN_ID = '00000000-0000-4000-8000-000000000001';
const ADMIN_PASSWORD = 'admin-password-e2e';
const SEED_STUDENT_ID = '11111111-1111-4111-8111-111111111111';
const SEED_STUDENT_PASSWORD = 'seed-student-password-e2e';
const GATEWAY_SECRET = 'gateway-secret-e2e-0123456789';
const MEDIA_SECRET = 'media-secret-e2e-0123456789ab';
const COURSE_SECRET = 'course-secret-e2e-0123456789a';

/**
 * Chạy với PostgreSQL thật đã migrate (`IDENTITY_DATABASE_URL`); không còn service nào phải giả.
 * Xem `pnpm test:identity:e2e` ở workspace gốc.
 */
describe('identity service (PostgreSQL thật)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  // Mọi request public đi qua Gateway nên mang service token của gateway (lấy từ endpoint thật).
  let agent: ReturnType<typeof request.agent>;
  // Bề mặt nội bộ: token của media (có scope đọc hồ sơ student) và của course (không có scope này).
  let internal: { authorization: string };
  let withoutScope: { authorization: string };

  const server = (): ReturnType<typeof request> => request(app.getHttpServer());
  const bearer = (token: string): { authorization: string } => ({
    authorization: `Bearer ${token}`,
  });
  const issue = async (clientId: string, clientSecret: string): Promise<string> => {
    const response = await server()
      .post('/internal/v1/auth/service-token')
      .send({ client_id: clientId, client_secret: clientSecret, audience: 'identity' })
      .expect(200);
    return response.body.data.access_token as string;
  };

  beforeAll(async () => {
    if (!process.env.IDENTITY_DATABASE_URL) {
      throw new Error('IDENTITY_DATABASE_URL là bắt buộc cho e2e của identity');
    }
    Object.assign(process.env, {
      OTEL_SDK_DISABLED: 'true',
      PORT: '3001',
      IDENTITY_SIGNING_KEY_PEM: generateKeyPairSync('ed25519')
        .privateKey.export({ type: 'pkcs8', format: 'pem' })
        .toString(),
      SERVICE_CLIENTS_BOOTSTRAP: JSON.stringify([
        {
          client_id: 'gateway',
          client_secret: GATEWAY_SECRET,
          audiences: ['identity'],
          scopes: ['gateway:proxy'],
        },
        {
          client_id: 'media',
          client_secret: MEDIA_SECRET,
          audiences: ['identity'],
          scopes: ['student:profile:read'],
        },
        {
          client_id: 'course',
          client_secret: COURSE_SECRET,
          audiences: ['identity'],
          scopes: ['course:other'],
        },
      ]),
      IDENTITY_BOOTSTRAP_ADMIN_ID: ADMIN_ID,
      IDENTITY_BOOTSTRAP_ADMIN_EMAIL: 'admin@example.test',
      IDENTITY_BOOTSTRAP_ADMIN_PASSWORD: ADMIN_PASSWORD,
      IDENTITY_BOOTSTRAP_STUDENT_ID: SEED_STUDENT_ID,
      IDENTITY_BOOTSTRAP_STUDENT_EMAIL: 'seed-student@example.test',
      IDENTITY_BOOTSTRAP_STUDENT_PASSWORD: SEED_STUDENT_PASSWORD,
    });
    const { AppModule } = await import('../../src/app.module.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(correlationIdMiddleware);
    app.useGlobalFilters(new AppExceptionFilter());
    // `init` chạy `onApplicationBootstrap`: seed client dịch vụ rồi tài khoản, như khi khởi động thật.
    await app.init();
    prisma = app.get(PrismaService);

    agent = request
      .agent(app.getHttpServer())
      .set('authorization', `Bearer ${await issue('gateway', GATEWAY_SECRET)}`);
    internal = bearer(await issue('media', MEDIA_SECRET));
    withoutScope = bearer(await issue('course', COURSE_SECRET));
  });

  afterAll(async () => {
    await app?.close();
  });

  const unique = `${Date.now()}`;
  const asAdmin = { 'x-principal-id': ADMIN_ID, 'x-principal-role': 'admin' };

  async function registerStudent(label: string): Promise<{ id: string; email: string }> {
    const email = `${label}-${unique}@example.test`;
    const registered = await agent
      .post('/api/v1/auth/register')
      .send({ email, password: 'student-password', full_name: `Học viên ${label}` })
      .expect(201);
    return { id: registered.body.data.id as string, email };
  }

  it('đăng ký → đăng nhập → /me → refresh xoay vòng, tạo cả tài khoản và hồ sơ cùng id', async () => {
    const email = `student-${unique}@example.test`;

    const registered = await agent
      .post('/api/v1/auth/register')
      .send({ email, password: 'student-password', full_name: 'Học viên' })
      .expect(201);
    expect(apiResponseSchema(accountDtoSchema).parse(registered.body)).toMatchObject({
      success: true,
      data: { email, role: 'student', status: 'ACTIVE' },
    });
    const studentId = registered.body.data.id as string;
    expect(registered.body.data).not.toHaveProperty('password_hash');

    // Một transaction cục bộ: hồ sơ student xuất hiện ngay cùng tài khoản, không có trạng thái chờ.
    const profile = await prisma.studentProfile.findUnique({ where: { userId: studentId } });
    expect(profile).toMatchObject({ userId: studentId, status: 'ACTIVE' });

    await agent
      .post('/api/v1/auth/register')
      .send({ email, password: 'student-password', full_name: 'Trùng' })
      .expect(409);
    // Đăng ký trùng không để lại tài khoản hay hồ sơ thừa.
    expect(await prisma.user.count({ where: { email } })).toBe(1);
    expect(await prisma.studentProfile.count({ where: { userId: studentId } })).toBe(1);

    const login = await agent
      .post('/api/v1/auth/student/login')
      .send({ email, password: 'student-password' })
      .expect(200);
    const session = apiResponseSchema(loginResponseDtoSchema).parse(login.body);
    expect(session.data?.principal).toEqual({ id: studentId, role: 'student' });
    const refreshToken = login.body.data.refresh_token as string;

    const me = await agent
      .get('/api/v1/auth/me')
      .set('x-principal-id', studentId)
      .set('x-principal-role', 'student')
      .expect(200);
    expect(me.body.data.email).toBe(email);
    // avatar_url dựng thuần từ id (không gọi media), luôn có giá trị.
    expect(me.body.data.avatar_url).toBe(`/api/v1/media/avatars/${studentId}`);

    const refreshed = await agent
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: refreshToken })
      .expect(200);
    expect(apiResponseSchema(tokenPairDtoSchema).safeParse(refreshed.body).success).toBe(true);
    expect(refreshed.body.data.refresh_token).not.toBe(refreshToken);
    await agent.post('/api/v1/auth/refresh').send({ refresh_token: refreshToken }).expect(401);
  });

  it('refresh đồng thời cùng một token: đúng một yêu cầu thành công', async () => {
    const { email } = await registerStudent('race');
    const login = await agent
      .post('/api/v1/auth/student/login')
      .send({ email, password: 'student-password' });

    const results = await Promise.all(
      [1, 2, 3].map(() =>
        agent.post('/api/v1/auth/refresh').send({ refresh_token: login.body.data.refresh_token }),
      ),
    );

    expect(results.filter((response) => response.status === 200)).toHaveLength(1);
  });

  it('seed khi khởi động: admin và student mẫu đăng nhập được, student mẫu có hồ sơ ACTIVE', async () => {
    const admin = await agent
      .post('/api/v1/auth/admin/login')
      .send({ email: 'admin@example.test', password: ADMIN_PASSWORD })
      .expect(200);
    expect(admin.body.data.principal).toEqual({ id: ADMIN_ID, role: 'admin' });

    const seeded = await agent
      .post('/api/v1/auth/student/login')
      .send({ email: 'seed-student@example.test', password: SEED_STUDENT_PASSWORD })
      .expect(200);
    expect(seeded.body.data.principal).toEqual({ id: SEED_STUDENT_ID, role: 'student' });
    expect(
      await prisma.studentProfile.findUnique({ where: { userId: SEED_STUDENT_ID } }),
    ).toMatchObject({ status: 'ACTIVE' });
  });

  it('admin tạo instructor và liệt kê tài khoản; student bị 403', async () => {
    const created = await agent
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
    // Instructor không có hồ sơ student.
    expect(await prisma.studentProfile.count({ where: { userId: created.body.data.id } })).toBe(0);

    const listed = await agent
      .get('/api/v1/auth/accounts?role=instructor&page_size=100')
      .set(asAdmin)
      .expect(200);
    const list = apiListResponseSchema(accountDtoSchema).parse(listed.body);
    expect(list.meta.pagination).toMatchObject({ page: 1, page_size: 100 });
    expect((list.data ?? []).map((item) => item.id)).toContain(created.body.data.id);
    expect(list.data?.every((item) => item.role === 'instructor')).toBe(true);

    await agent
      .get('/api/v1/auth/accounts')
      .set({ 'x-principal-id': created.body.data.id, 'x-principal-role': 'student' })
      .expect(403);
    await agent.get('/api/v1/auth/accounts').expect(401);
  });

  it('mỗi role chỉ đăng nhập qua cửa của mình, sai cửa trả cùng một 401', async () => {
    const instructorEmail = `door-${unique}@example.test`;
    await agent
      .post('/api/v1/auth/accounts')
      .set(asAdmin)
      .send({
        email: instructorEmail,
        password: 'instructor-password',
        full_name: 'Giảng viên cửa',
        role: 'instructor',
      })
      .expect(201);
    const { email: studentEmail } = await registerStudent('door-student');

    const login = (door: string, email: string, password: string): request.Test =>
      agent.post(`/api/v1/auth/${door}/login`).send({ email, password });

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
    await agent
      .post('/api/v1/auth/login')
      .send({ email: studentEmail, password: 'student-password' })
      .expect(404);
  });

  it('phân trang tài khoản nhất quán: mặc định, tổng trang và từ chối tham số sai', async () => {
    const defaults = apiListResponseSchema(accountDtoSchema).parse(
      (await agent.get('/api/v1/auth/accounts').set(asAdmin).expect(200)).body,
    );
    expect(defaults.meta.pagination).toMatchObject({ page: 1, page_size: 20 });

    const single = apiListResponseSchema(accountDtoSchema).parse(
      (await agent.get('/api/v1/auth/accounts?page=2&page_size=1').set(asAdmin).expect(200)).body,
    );
    expect(single.data).toHaveLength(1);
    expect(single.meta.pagination).toMatchObject({ page: 2, page_size: 1 });
    expect(single.meta.pagination?.total_pages).toBe(single.meta.pagination?.total);

    for (const query of ['page=0', 'page_size=101', 'page_size=0', 'page=abc']) {
      const rejected = await agent.get(`/api/v1/auth/accounts?${query}`).set(asAdmin).expect(400);
      expect(apiErrorSchema.parse(rejected.body).error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('student bị chặn hoặc mất hồ sơ thì không đăng nhập được', async () => {
    const { id, email } = await registerStudent('blocked');
    const login = (): request.Test =>
      agent.post('/api/v1/auth/student/login').send({ email, password: 'student-password' });

    await prisma.studentProfile.update({ where: { userId: id }, data: { status: 'BLOCKED' } });
    const blocked = await login().expect(403);
    expect(apiErrorSchema.parse(blocked.body).error.code).toBe('FORBIDDEN');
    expect(blocked.body.data).toBeNull();

    await prisma.studentProfile.update({ where: { userId: id }, data: { status: 'INACTIVE' } });
    await login().expect(403);

    await prisma.studentProfile.delete({ where: { userId: id } });
    await login().expect(403);

    await prisma.studentProfile.create({ data: { userId: id, status: 'ACTIVE' } });
    await login().expect(200);
  });

  it('validate input: 400 với danh sách lỗi, 401 sai mật khẩu không lộ thông tin', async () => {
    const invalid = await agent
      .post('/api/v1/auth/register')
      .send({ email: 'khong-phai-email', password: 'ngan', full_name: '' })
      .expect(400);
    const invalidBody = apiErrorSchema.parse(invalid.body);
    expect(invalidBody.error.code).toBe('VALIDATION_ERROR');
    expect(
      (invalidBody.error.details as { path: string }[]).map((issue) => issue.path).sort(),
    ).toEqual(['email', 'full_name', 'password']);

    const wrong = await agent
      .post('/api/v1/auth/admin/login')
      .send({ email: 'admin@example.test', password: 'sai-mat-khau' })
      .expect(401);
    expect(wrong.body.error.message).toBe('Thông tin đăng nhập không hợp lệ');
  });

  describe('hồ sơ student', () => {
    it('student xem hồ sơ của mình, role khác bị chặn đúng quyền', async () => {
      const { id, email } = await registerStudent('profile');

      const me = await agent
        .get('/api/v1/students/me')
        .set({ 'x-principal-id': id, 'x-principal-role': 'student' })
        .expect(200);
      expect(apiResponseSchema(studentDtoSchema).parse(me.body)).toMatchObject({
        data: { id, email, status: 'ACTIVE', avatar_url: `/api/v1/media/avatars/${id}` },
      });

      await agent.get('/api/v1/students/me').set(asAdmin).expect(403);
      await agent
        .get('/api/v1/students')
        .set({ 'x-principal-id': id, 'x-principal-role': 'student' })
        .expect(403);
    });

    it('danh sách public dùng phân trang chung và từ chối tham số sai', async () => {
      await registerStudent('list-a');
      await registerStudent('list-b');

      const list = apiListResponseSchema(studentDtoSchema).parse(
        (await agent.get('/api/v1/students?page=1&page_size=2').set(asAdmin).expect(200)).body,
      );
      expect(list.data).toHaveLength(2);
      expect(list.meta.pagination).toMatchObject({ page: 1, page_size: 2 });
      expect(list.meta.pagination?.total).toBeGreaterThanOrEqual(3);

      const rejected = await agent.get('/api/v1/students?page_size=1000').set(asAdmin).expect(400);
      expect(apiErrorSchema.parse(rejected.body).error.code).toBe('VALIDATION_ERROR');

      const missing = await agent.get(`/api/v1/students/${randomUUID()}`).set(asAdmin).expect(404);
      expect(apiErrorSchema.parse(missing.body).error.code).toBe('NOT_FOUND');
    });

    it('tra cứu nội bộ theo id trả hồ sơ, id chưa có hoặc sai định dạng thì lỗi envelope', async () => {
      const { id, email } = await registerStudent('lookup');

      const found = await server().get(`/internal/v1/students/${id}`).set(internal).expect(200);
      expect(apiResponseSchema(studentDtoSchema).parse(found.body).data).toMatchObject({
        id,
        email,
        status: 'ACTIVE',
      });

      const missing = await server()
        .get(`/internal/v1/students/${randomUUID()}`)
        .set(internal)
        .expect(404);
      expect(apiErrorSchema.parse(missing.body).error.code).toBe('NOT_FOUND');
      await server().get('/internal/v1/students/khong-phai-uuid').set(internal).expect(400);
      // Tài khoản instructor/admin không phải student nên không có hồ sơ.
      await server().get(`/internal/v1/students/${ADMIN_ID}`).set(internal).expect(404);
    });

    it('danh sách nội bộ chỉ có student ACTIVE theo id tăng dần, page_size tối đa 100', async () => {
      const ids = [
        (await registerStudent('act-1')).id,
        (await registerStudent('act-2')).id,
        (await registerStudent('act-3')).id,
      ];
      const inactive = (await registerStudent('inactive')).id;
      await prisma.studentProfile.update({
        where: { userId: inactive },
        data: { status: 'INACTIVE' },
      });

      const response = await server()
        .get('/internal/v1/students?page=1&page_size=100')
        .set(internal)
        .expect(200);
      const list = apiListResponseSchema(studentDtoSchema).parse(response.body);
      const listed = (list.data ?? []).map((student) => student.id);
      for (const id of ids) expect(listed).toContain(id);
      expect(listed).not.toContain(inactive);
      expect(listed).toEqual([...listed].sort());
      expect((list.data ?? []).every((student) => student.status === 'ACTIVE')).toBe(true);
      expect(list.meta.pagination).toMatchObject({ page: 1, page_size: 100 });

      await server().get('/internal/v1/students?page_size=101').set(internal).expect(400);
    });

    it('không còn route ghi nội bộ: tạo hồ sơ chỉ qua đăng ký', async () => {
      await server()
        .post('/internal/v1/students')
        .set(internal)
        .send({ id: randomUUID(), email: `x-${unique}@example.test`, full_name: 'X' })
        .expect(404);
    });
  });

  it('health và ready dùng envelope, ready chỉ cần PostgreSQL', async () => {
    const health = await server().get('/health').expect(200);
    expect(health.body).toMatchObject({ success: true, data: { status: 'ok' } });
    const ready = await server().get('/ready').expect(200);
    expect(ready.body.data.checks).toEqual({ postgres: 'ok' });
  });

  describe('xác thực service-to-service', () => {
    const serviceToken = (body: Record<string, unknown>): request.Test =>
      server().post('/internal/v1/auth/service-token').send(body);

    it('JWKS công khai không bọc envelope và không lộ khóa riêng', async () => {
      const response = await server().get('/.well-known/jwks.json').expect(200);
      expect(response.body.keys).toHaveLength(1);
      expect(response.body.keys[0]).toMatchObject({ kty: 'OKP', crv: 'Ed25519', alg: 'EdDSA' });
      expect(response.body.keys[0]).not.toHaveProperty('d');
    });

    it('cấp service token đúng scope; sai secret 401, audience/scope ngoài quyền 403', async () => {
      const ok = await serviceToken({
        client_id: 'gateway',
        client_secret: GATEWAY_SECRET,
        audience: 'identity',
      }).expect(200);
      expect(ok.body.data).toMatchObject({ token_type: 'Bearer', scope: 'gateway:proxy' });

      const wrongSecret = await serviceToken({
        client_id: 'gateway',
        client_secret: 'sai-secret-0123456789',
        audience: 'identity',
      }).expect(401);
      expect(apiErrorSchema.parse(wrongSecret.body).error.code).toBe('SERVICE_CLIENT_INVALID');

      const wrongAudience = await serviceToken({
        client_id: 'gateway',
        client_secret: GATEWAY_SECRET,
        audience: 'media',
      }).expect(403);
      expect(wrongAudience.body.error.code).toBe('SERVICE_SCOPE_FORBIDDEN');
      await serviceToken({ client_id: 'gateway' }).expect(400);
      // Client `auth` của kiến trúc cũ không còn trong registry.
      await serviceToken({
        client_id: 'auth',
        client_secret: 'auth-secret-e2e-0123456789abc',
        audience: 'identity',
      }).expect(401);
    });

    it('tách bề mặt: mỗi loại token chỉ dùng được ở bề mặt của nó', async () => {
      const { id } = await registerStudent('surface');
      const code = (response: { body: unknown }): string =>
        apiErrorSchema.parse(response.body).error.code;
      const principal = { 'x-principal-id': id, 'x-principal-role': 'admin' };

      // Không token: cả public lẫn internal đều bị từ chối.
      expect(code(await server().get(`/internal/v1/students/${id}`).expect(401))).toBe(
        'SERVICE_TOKEN_MISSING',
      );
      expect(code(await server().post('/api/v1/auth/student/login').send({}).expect(401))).toBe(
        'SERVICE_TOKEN_MISSING',
      );
      // Giả danh tính nhưng không có token gateway.
      expect(code(await server().get('/api/v1/students').set(principal).expect(401))).toBe(
        'SERVICE_TOKEN_MISSING',
      );

      // Token gateway không có quyền internal; token của service khác không đi được qua bề mặt public.
      const gatewayToken = bearer(await issue('gateway', GATEWAY_SECRET));
      expect(
        code(await server().get(`/internal/v1/students/${id}`).set(gatewayToken).expect(403)),
      ).toBe('SERVICE_SCOPE_FORBIDDEN');
      expect(
        code(
          await server()
            .get('/api/v1/students')
            .set({ ...internal, ...principal })
            .expect(403),
        ),
      ).toBe('SERVICE_SCOPE_FORBIDDEN');
      // Token hợp lệ nhưng thiếu scope đọc hồ sơ student.
      await server().get(`/internal/v1/students/${id}`).set(withoutScope).expect(403);

      // Token người dùng không thay được token dịch vụ.
      const user = await agent
        .post('/api/v1/auth/admin/login')
        .send({ email: 'admin@example.test', password: ADMIN_PASSWORD })
        .expect(200);
      const userToken = await server()
        .get('/api/v1/auth/me')
        .set('authorization', `Bearer ${user.body.data.access_token}`)
        .set(asAdmin)
        .expect(401);
      expect(userToken.body.error.code).toBe('TOKEN_TYPE_MISMATCH');

      // Health không cần token.
      await server().get('/health').expect(200);
    });
  });
});

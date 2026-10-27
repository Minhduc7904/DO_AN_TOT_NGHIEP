import { randomUUID } from 'node:crypto';

import { AppExceptionFilter, correlationIdMiddleware } from '@aiops-lms/common/http';
import {
  apiErrorSchema,
  apiListResponseSchema,
  apiResponseSchema,
  studentDtoSchema,
} from '@aiops-lms/contracts';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

/** Chạy với PostgreSQL thật đã migrate (`STUDENT_DATABASE_URL`); xem `pnpm test:student:e2e`. */
describe('student service (PostgreSQL thật)', () => {
  let app: INestApplication;
  const admin = { 'x-principal-id': randomUUID(), 'x-principal-role': 'admin' };

  beforeAll(async () => {
    if (!process.env.STUDENT_DATABASE_URL) {
      throw new Error('STUDENT_DATABASE_URL là bắt buộc cho e2e của student');
    }
    process.env.OTEL_SDK_DISABLED = 'true';
    const { AppModule } = await import('../../src/app.module.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(correlationIdMiddleware);
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  const unique = `${Date.now()}`;

  async function createStudent(index: number): Promise<string> {
    const id = randomUUID();
    await request(app.getHttpServer())
      .post('/internal/v1/students')
      .send({ id, email: `s${index}-${unique}@example.test`, full_name: `Học viên ${index}` })
      .expect(201);
    return id;
  }

  it('tra cứu nội bộ theo id trả hồ sơ, id chưa có hoặc sai định dạng thì lỗi envelope', async () => {
    const id = await createStudent(900);

    const found = await request(app.getHttpServer()).get(`/internal/v1/students/${id}`).expect(200);
    expect(apiResponseSchema(studentDtoSchema).parse(found.body).data).toMatchObject({
      id,
      status: 'ACTIVE',
    });

    const missing = await request(app.getHttpServer())
      .get(`/internal/v1/students/${randomUUID()}`)
      .expect(404);
    expect(apiErrorSchema.parse(missing.body).error.code).toBe('NOT_FOUND');
    await request(app.getHttpServer()).get('/internal/v1/students/khong-phai-uuid').expect(400);
  });

  it('tạo nội bộ trả envelope success, trùng thì 409 envelope lỗi', async () => {
    const id = randomUUID();
    const body = { id, email: `dup-${unique}@example.test`, full_name: 'Học viên' };

    const created = await request(app.getHttpServer())
      .post('/internal/v1/students')
      .send(body)
      .expect(201);
    expect(apiResponseSchema(studentDtoSchema).parse(created.body)).toMatchObject({
      success: true,
      data: { id, status: 'ACTIVE' },
      error: null,
      meta: { pagination: null },
    });

    const duplicate = await request(app.getHttpServer())
      .post('/internal/v1/students')
      .send(body)
      .expect(409);
    expect(apiErrorSchema.parse(duplicate.body)).toMatchObject({
      success: false,
      data: null,
      error: { code: 'CONFLICT' },
    });
  });

  it('student xem hồ sơ của mình, role khác bị chặn đúng quyền', async () => {
    const id = await createStudent(1);

    const me = await request(app.getHttpServer())
      .get('/api/v1/students/me')
      .set({ 'x-principal-id': id, 'x-principal-role': 'student' })
      .expect(200);
    expect(apiResponseSchema(studentDtoSchema).parse(me.body)).toMatchObject({ data: { id } });

    await request(app.getHttpServer()).get('/api/v1/students/me').set(admin).expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/students')
      .set({ 'x-principal-id': id, 'x-principal-role': 'student' })
      .expect(403);
  });

  it('danh sách dùng phân trang chung và từ chối tham số sai', async () => {
    await createStudent(2);
    await createStudent(3);

    const list = apiListResponseSchema(studentDtoSchema).parse(
      (
        await request(app.getHttpServer())
          .get('/api/v1/students?page=1&page_size=2')
          .set(admin)
          .expect(200)
      ).body,
    );
    expect(list.data).toHaveLength(2);
    expect(list.meta.pagination).toMatchObject({ page: 1, page_size: 2 });
    expect(list.meta.pagination?.total).toBeGreaterThanOrEqual(3);

    const rejected = await request(app.getHttpServer())
      .get('/api/v1/students?page_size=1000')
      .set(admin)
      .expect(400);
    expect(apiErrorSchema.parse(rejected.body).error.code).toBe('VALIDATION_ERROR');

    const missing = await request(app.getHttpServer())
      .get(`/api/v1/students/${randomUUID()}`)
      .set(admin)
      .expect(404);
    expect(apiErrorSchema.parse(missing.body).error.code).toBe('NOT_FOUND');
  });

  it('health và ready cũng dùng envelope', async () => {
    const health = await request(app.getHttpServer()).get('/health').expect(200);
    expect(health.body).toMatchObject({ success: true, data: { status: 'ok' } });
    const ready = await request(app.getHttpServer()).get('/ready').expect(200);
    expect(ready.body.data.checks).toEqual({ postgres: 'ok' });
  });
});

import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { generateSigningKey, toJwk } from '@aiops-lms/common/auth';
import { mintGatewayToken, mintServiceToken } from '@aiops-lms/common/auth/testing';
import { AppExceptionFilter, correlationIdMiddleware } from '@aiops-lms/common/http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { PrismaService } from '../../src/adapters/persistence/prisma.service.js';

/**
 * Chạy với PostgreSQL thật; xem README. API và hai instance worker chạy cùng process nhưng là các
 * Nest app riêng (đúng hai module triển khai). `auth` và `media` được giả bằng một stub HTTP: stub
 * media ghi lại token/body để chứng minh worker gọi đúng audience, scope và payload.
 */
describe('scheduler + scheduler-worker (PostgreSQL thật, media giả bằng HTTP stub)', () => {
  const signingKey = generateSigningKey();
  const gatewayToken = mintGatewayToken(signingKey, 'scheduler');
  const asRole = (role: string, id: string): Record<string, string> => ({
    authorization: `Bearer ${gatewayToken}`,
    'x-principal-id': id,
    'x-principal-role': role,
  });
  const adminId = randomUUID();
  const admin = asRole('admin', adminId);
  const suffix = randomUUID().slice(0, 8);

  const SUMMARY = {
    retention_hours: 2,
    pending_grace_minutes: 15,
    limit: 50,
    unused_deleted: 4,
    thumbnails_deleted: 2,
    objects_removed: 6,
    pending_recovered: 1,
    pending_orphan_objects_removed: 1,
    skipped: 0,
    failed: 0,
    has_more: false,
  };

  /** Phần thân phản hồi mà test đọc; khóa lạ truy cập bằng chỉ mục. */
  interface Body {
    id: string;
    [key: string]: unknown;
  }

  type MediaMode = 'ok' | 'partial' | 'down' | 'reject';
  const media = {
    mode: 'ok' as MediaMode,
    delayMs: 0,
    calls: [] as { authorization: string | undefined; body: unknown }[],
    active: 0,
    maxActive: 0,
  };
  const resetMedia = (): void => {
    media.mode = 'ok';
    media.delayMs = 0;
    media.calls = [];
    media.active = 0;
    media.maxActive = 0;
  };

  let stub: Server;
  let api: INestApplication;
  const workers: INestApplication[] = [];
  let prisma: PrismaService;

  const envelope = (data: unknown): unknown => ({
    success: true,
    data,
    error: null,
    meta: { trace_id: 'stub', timestamp: new Date().toISOString(), pagination: null },
  });
  const failure = (code: string): unknown => ({
    success: false,
    data: null,
    error: { code, message: 'x', details: null },
    meta: { trace_id: 'stub', timestamp: new Date().toISOString(), pagination: null },
  });

  async function startWorker(): Promise<INestApplication> {
    const { WorkerModule } = await import('../../src/worker.module.js');
    const app = (
      await Test.createTestingModule({ imports: [WorkerModule] }).compile()
    ).createNestApplication();
    await app.init();
    workers.push(app);
    return app;
  }

  beforeAll(async () => {
    if (!process.env['SCHEDULER_DATABASE_URL']) {
      throw new Error('SCHEDULER_DATABASE_URL là bắt buộc cho e2e của scheduler');
    }
    stub = createServer((req, res) => {
      const send = (status: number, body: unknown): void => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(body));
      };
      if (req.url === '/.well-known/jwks.json') {
        return send(200, { keys: [toJwk(signingKey.publicKey)] });
      }
      let raw = '';
      req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
      req.on('end', () => {
        if (req.method === 'POST' && req.url === '/internal/v1/auth/service-token') {
          const { audience } = JSON.parse(raw) as { audience: string };
          return send(
            200,
            envelope({
              access_token: mintServiceToken(signingKey, {
                subject: 'scheduler-worker',
                audience,
                scopes: audience === 'media' ? ['media:cleanup'] : [],
              }),
              token_type: 'Bearer',
              expires_in: 600,
              scope: 'media:cleanup',
            }),
          );
        }
        if (req.method === 'POST' && req.url === '/internal/v1/media/cleanup') {
          media.calls.push({
            authorization: req.headers.authorization,
            body: raw ? JSON.parse(raw) : null,
          });
          media.active += 1;
          media.maxActive = Math.max(media.maxActive, media.active);
          setTimeout(() => {
            media.active -= 1;
            if (media.mode === 'down') return send(503, failure('DEPENDENCY_UNAVAILABLE'));
            if (media.mode === 'reject') return send(403, failure('SERVICE_SCOPE_FORBIDDEN'));
            send(200, envelope(media.mode === 'partial' ? { ...SUMMARY, failed: 2 } : SUMMARY));
          }, media.delayMs);
          return;
        }
        send(404, failure('NOT_FOUND'));
      });
    });
    await new Promise<void>((resolve) => stub.listen(0, '127.0.0.1', resolve));
    const stubUrl = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`;

    Object.assign(process.env, {
      OTEL_SDK_DISABLED: 'true',
      HTTP_ACCESS_LOG_ENABLED: 'false',
      IDENTITY_BASE_URL: stubUrl,
      SCHEDULER_MEDIA_BASE_URL: stubUrl,
      SCHEDULER_MEDIA_TIMEOUT_MS: '3000',
      SCHEDULER_MEDIA_BREAKER_THRESHOLD: '100',
      SERVICE_CLIENT_ID: 'scheduler-worker',
      SERVICE_CLIENT_SECRET: 'scheduler-worker-secret-local-only',
      SCHEDULER_WORKER_POLL_MS: '100',
      SCHEDULER_CRON_TICK_MS: '150',
      SCHEDULER_WORKER_CONCURRENCY: '2',
      SCHEDULER_RUN_LEASE_MS: '5000',
      SCHEDULER_RUN_MAX_ATTEMPTS: '2',
    });
    const { AppModule } = await import('../../src/app.module.js');
    api = (
      await Test.createTestingModule({ imports: [AppModule] }).compile()
    ).createNestApplication();
    api.use(correlationIdMiddleware);
    api.useGlobalFilters(new AppExceptionFilter());
    await api.init();
    prisma = api.get(PrismaService);
    // Prisma nạp trình biên dịch truy vấn bằng import động ở lần dùng đầu tiên; làm việc đó trước khi
    // vòng nền của worker chạy để lần nạp không rơi vào lúc Jest đang ở giữa hai test.
    await prisma.$queryRaw`SELECT 1`;
    // DB e2e dành riêng cho test: dọn run/job còn sót từ lần chạy trước để worker không xử lý chúng.
    await prisma.backgroundJob.deleteMany();
    await startWorker();
  });

  afterAll(async () => {
    await Promise.all(workers.map((worker) => worker.close()));
    await api?.close();
    await new Promise<void>((resolve) => {
      stub?.closeAllConnections();
      stub?.close(() => resolve());
    });
  });

  beforeEach(resetMedia);

  const http = (): ReturnType<typeof request> => request(api.getHttpServer());

  async function waitFor<T>(read: () => Promise<T | undefined>, timeoutMs = 15_000): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const value = await read();
      if (value !== undefined) return value;
      if (Date.now() > deadline) throw new Error('Hết thời gian chờ điều kiện');
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

  /** Lịch hằng năm: test tự đặt `next_run_at` về quá khứ để job "đến hạn", sau đó không bao giờ tự chạy lại. */
  const YEARLY = '0 0 1 1 *';
  let sequence = 0;
  const jobName = (label: string): string => `${label}-${suffix}-${(sequence += 1)}`;

  async function createJob(body: Record<string, unknown> = {}): Promise<Body> {
    const response = await http()
      .post('/api/v1/scheduler/jobs')
      .set(admin)
      .send({
        name: jobName('job'),
        type: 'MEDIA_UNUSED_CLEANUP',
        schedule_type: 'MANUAL',
        payload: { retention_hours: 2, limit: 50 },
        ...body,
      })
      .expect(201);
    return response.body.data as Body;
  }
  const trigger = (jobId: string, key: string): request.Test =>
    http().post(`/api/v1/scheduler/jobs/${jobId}/runs`).set(admin).send({ idempotency_key: key });
  const getRun = async (jobId: string, runId: string): Promise<Body | undefined> => {
    const runs = await http().get(`/api/v1/scheduler/jobs/${jobId}/runs?page_size=100`).set(admin);
    return (runs.body.data as Body[]).find((run) => run['id'] === runId);
  };
  const waitRun = (jobId: string, runId: string, statuses: string[]): Promise<Body> =>
    waitFor(async () => {
      const run = await getRun(jobId, runId);
      return run && statuses.includes(run['status'] as string) ? run : undefined;
    });

  describe('xác thực và phân quyền', () => {
    it('thiếu service token → 401; sai role → 403; không phải gateway → 403; /health mở', async () => {
      const missing = await http().get('/api/v1/scheduler/jobs');
      expect(missing.status).toBe(401);
      expect(missing.body.error.code).toBe('SERVICE_TOKEN_MISSING');

      for (const role of ['student', 'instructor']) {
        const response = await http().get('/api/v1/scheduler/jobs').set(asRole(role, randomUUID()));
        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      }
      // Gateway token nhưng thiếu danh tính user.
      await http()
        .get('/api/v1/scheduler/jobs')
        .set({ authorization: `Bearer ${gatewayToken}` })
        .expect(401);
      // Token của service khác (không phải gateway) không dùng được ở route public, kể cả giả principal.
      const other = mintServiceToken(signingKey, {
        subject: 'course',
        audience: 'scheduler',
        scopes: ['media:usage:read'],
      });
      const forged = await http()
        .get('/api/v1/scheduler/jobs')
        .set({
          authorization: `Bearer ${other}`,
          'x-principal-id': adminId,
          'x-principal-role': 'admin',
        });
      expect(forged.status).toBe(403);
      expect(forged.body.error.code).toBe('SERVICE_SCOPE_FORBIDDEN');
      // Token đúng gateway nhưng aud khác scheduler bị từ chối.
      const wrongAudience = mintGatewayToken(signingKey, 'media');
      expect(
        (
          await http()
            .get('/api/v1/scheduler/jobs')
            .set({ ...admin, authorization: `Bearer ${wrongAudience}` })
        ).status,
      ).toBe(401);

      // Mọi route đều chỉ admin.
      const jobId = randomUUID();
      const student = asRole('student', randomUUID());
      const calls: (() => request.Test)[] = [
        () => http().post('/api/v1/scheduler/jobs').send({}),
        () => http().get(`/api/v1/scheduler/jobs/${jobId}`),
        () => http().patch(`/api/v1/scheduler/jobs/${jobId}`).send({ status: 'PAUSED' }),
        () => http().post(`/api/v1/scheduler/jobs/${jobId}/runs`).send({ idempotency_key: 'k' }),
        () => http().get(`/api/v1/scheduler/jobs/${jobId}/runs`),
      ];
      for (const call of calls) expect((await call().set(student)).status).toBe(403);
      await http().get('/health').expect(200);
      await http().get('/ready').expect(200);
    });
  });

  describe('quản lý job', () => {
    it('validate create-job: cron, loại job, payload, trùng tên', async () => {
      const post = (body: Record<string, unknown>): request.Test =>
        http()
          .post('/api/v1/scheduler/jobs')
          .set(admin)
          .send({ type: 'MEDIA_UNUSED_CLEANUP', ...body });
      const name = jobName('validate');

      const badCron = await post({ name, schedule_type: 'CRON', cron_expression: '99 * * * *' });
      expect(badCron.status).toBe(400);
      expect(badCron.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        details: [{ path: 'cron_expression' }],
      });
      expect((await post({ name, schedule_type: 'CRON' })).status).toBe(400);
      expect((await post({ name, schedule_type: 'MANUAL', cron_expression: YEARLY })).status).toBe(
        400,
      );
      expect((await post({ name, schedule_type: 'WEEKLY' })).status).toBe(400);
      expect((await post({ name, type: 'DROP_TABLE', schedule_type: 'MANUAL' })).status).toBe(400);
      expect(
        (await post({ name, schedule_type: 'MANUAL', payload: { retention_hours: -1 } })).status,
      ).toBe(400);
      expect((await post({ name: '', schedule_type: 'MANUAL' })).status).toBe(400);
      expect(
        (await post({ name, schedule_type: 'MANUAL', payload: { limit: 5_000 } })).status,
      ).toBe(400);

      const created = await post({ name, schedule_type: 'MANUAL' }).expect(201);
      expect(created.body.data).toMatchObject({
        name,
        type: 'MEDIA_UNUSED_CLEANUP',
        schedule_type: 'MANUAL',
        cron_expression: null,
        status: 'ACTIVE',
        allow_concurrent: false,
        next_run_at: null,
        created_by: adminId,
      });
      const duplicate = await post({ name, schedule_type: 'MANUAL' });
      expect(duplicate.status).toBe(409);
      expect(duplicate.body.error.code).toBe('CONFLICT');
    });

    it('create CRON tính next_run_at UTC; get/list/update-status', async () => {
      const cronJob = await createJob({ schedule_type: 'CRON', cron_expression: '0 3 * * *' });
      const nextRun = new Date(cronJob['next_run_at'] as string);
      expect(nextRun.getUTCHours()).toBe(3);
      expect(nextRun.getUTCMinutes()).toBe(0);
      expect(nextRun.getTime()).toBeGreaterThan(Date.now());

      const fetched = await http()
        .get(`/api/v1/scheduler/jobs/${cronJob['id']}`)
        .set(admin)
        .expect(200);
      expect(fetched.body.data).toMatchObject({ id: cronJob['id'], cron_expression: '0 3 * * *' });
      await http().get(`/api/v1/scheduler/jobs/${randomUUID()}`).set(admin).expect(404);
      await http().get('/api/v1/scheduler/jobs/khong-phai-uuid').set(admin).expect(400);

      const paused = await http()
        .patch(`/api/v1/scheduler/jobs/${cronJob['id']}`)
        .set(admin)
        .send({ status: 'PAUSED' })
        .expect(200);
      expect(paused.body.data).toMatchObject({ status: 'PAUSED', next_run_at: null });
      const resumed = await http()
        .patch(`/api/v1/scheduler/jobs/${cronJob['id']}`)
        .set(admin)
        .send({ status: 'ACTIVE' })
        .expect(200);
      expect(resumed.body.data.next_run_at).not.toBeNull();
      await http()
        .patch(`/api/v1/scheduler/jobs/${cronJob['id']}`)
        .set(admin)
        .send({ status: 'DELETED' })
        .expect(400);
      await http()
        .patch(`/api/v1/scheduler/jobs/${randomUUID()}`)
        .set(admin)
        .send({ status: 'PAUSED' })
        .expect(404);

      const listed = await http()
        .get('/api/v1/scheduler/jobs?status=ACTIVE&type=MEDIA_UNUSED_CLEANUP&page=1&page_size=2')
        .set(admin)
        .expect(200);
      expect(listed.body.meta.pagination).toMatchObject({ page: 1, page_size: 2 });
      expect(listed.body.data.length).toBeLessThanOrEqual(2);
      expect(
        (listed.body.data as { status: string }[]).every((item) => item.status === 'ACTIVE'),
      ).toBe(true);
      await http().get('/api/v1/scheduler/jobs?page_size=500').set(admin).expect(400);
      await http().get('/api/v1/scheduler/jobs?status=UNKNOWN').set(admin).expect(400);
    });
  });

  describe('job MEDIA_UNUSED_CLEANUP thủ công', () => {
    it('trigger → worker gọi media đúng audience/scope/payload → SUCCEEDED + output_json; trigger lặp trả cùng run', async () => {
      const job = await createJob();

      const created = await trigger(job['id'], 'lan-1').expect(201);
      expect(created.body.data).toMatchObject({
        job_id: job['id'],
        trigger_type: 'MANUAL',
        idempotency_key: 'lan-1',
        status: 'PENDING',
        created_by: adminId,
      });
      const runId = created.body.data.id as string;

      const done = await waitRun(job['id'], runId, ['SUCCEEDED', 'FAILED']);
      expect(done).toMatchObject({
        status: 'SUCCEEDED',
        attempts: 1,
        error_code: null,
        output: SUMMARY,
      });
      expect(done['worker_instance']).toMatch(/^scheduler-worker@/u);
      expect(done['started_at']).not.toBeNull();
      expect(done['finished_at']).not.toBeNull();

      // Worker dùng service token audience `media` với scope `media:cleanup` và đúng payload của job.
      expect(media.calls).toHaveLength(1);
      const claims = JSON.parse(
        Buffer.from(
          String(media.calls[0]?.authorization).split('.')[1] as string,
          'base64url',
        ).toString(),
      ) as Record<string, string>;
      expect(claims).toMatchObject({ typ: 'service', sub: 'scheduler-worker', aud: 'media' });
      expect(claims['scope']).toContain('media:cleanup');
      expect(media.calls[0]?.body).toEqual({ retention_hours: 2, limit: 50 });

      // Trigger lặp cùng khóa: 200, cùng run, không gọi media lần nữa.
      const replay = await trigger(job['id'], 'lan-1').expect(200);
      expect(replay.body.data.id).toBe(runId);
      expect(replay.body.data.status).toBe('SUCCEEDED');
      await sleep(400);
      expect(media.calls).toHaveLength(1);
      const runs = await http()
        .get(`/api/v1/scheduler/jobs/${job['id']}/runs`)
        .set(admin)
        .expect(200);
      expect(runs.body.meta.pagination.total).toBe(1);

      // Khóa mới → run mới; khóa thiếu/rỗng → 400.
      const second = await trigger(job['id'], 'lan-2').expect(201);
      expect(second.body.data.id).not.toBe(runId);
      await waitRun(job['id'], second.body.data.id as string, ['SUCCEEDED']);
      expect(media.calls).toHaveLength(2);
      await http().post(`/api/v1/scheduler/jobs/${job['id']}/runs`).set(admin).send({}).expect(400);
      await http()
        .post(`/api/v1/scheduler/jobs/${job['id']}/runs`)
        .set(admin)
        .send({ idempotency_key: '' })
        .expect(400);
      await trigger(randomUUID(), 'k').expect(404);

      // Lọc theo status và phân trang.
      const filtered = await http()
        .get(`/api/v1/scheduler/jobs/${job['id']}/runs?status=SUCCEEDED&page_size=1`)
        .set(admin)
        .expect(200);
      expect(filtered.body.meta.pagination).toMatchObject({ total: 2, total_pages: 2 });
      expect(
        (await http().get(`/api/v1/scheduler/jobs/${job['id']}/runs?status=FAILED`).set(admin)).body
          .data,
      ).toEqual([]);
      await http().get(`/api/v1/scheduler/jobs/${randomUUID()}/runs`).set(admin).expect(404);
    });

    it('trigger đồng thời cùng khóa chỉ tạo một run (ON CONFLICT DO NOTHING)', async () => {
      const job = await createJob();

      const responses = await Promise.all(
        Array.from({ length: 6 }, () => trigger(job['id'], 'dong-thoi')),
      );

      expect(responses.map((response) => response.status).sort()).toEqual([
        200, 200, 200, 200, 200, 201,
      ]);
      expect(new Set(responses.map((response) => response.body.data.id as string)).size).toBe(1);
      expect(await prisma.backgroundJobRun.count({ where: { jobId: job['id'] as string } })).toBe(
        1,
      );
      await waitRun(job['id'], responses[0]?.body.data.id as string, ['SUCCEEDED']);
      expect(media.calls).toHaveLength(1);
    });

    it('media lỗi → run FAILED với mã lỗi an toàn; không lộ token hay chi tiết nội bộ', async () => {
      const job = await createJob();
      const cases: [MediaMode, string][] = [
        ['partial', 'MEDIA_CLEANUP_INCOMPLETE'],
        ['down', 'DEPENDENCY_UNAVAILABLE'],
        ['reject', 'MEDIA_CLEANUP_REJECTED'],
      ];
      for (const [mode, code] of cases) {
        media.mode = mode;
        const created = await trigger(job['id'], `loi-${mode}`).expect(201);
        const run = await waitRun(job['id'], created.body.data.id as string, [
          'SUCCEEDED',
          'FAILED',
        ]);
        expect(run).toMatchObject({ status: 'FAILED', error_code: code });
        expect(run['error_message']).toEqual(expect.any(String));
        expect(JSON.stringify(run)).not.toMatch(/Bearer|eyJ|secret|authorization/iu);
        if (mode === 'partial')
          expect(run['output']).toMatchObject({ failed: 2, unused_deleted: 4 });
      }
    });

    it('job PAUSED/DISABLED không chạy: trigger bị từ chối, run PENDING chờ, DISABLED đóng run', async () => {
      const job = await createJob();
      // Giữ worker bận ở job khác không cần thiết: chỉ cần tạm dừng trước khi worker kịp nhận.
      await prisma.backgroundJob.update({ where: { id: job['id'] }, data: { status: 'PAUSED' } });
      const waiting = await prisma.backgroundJobRun.create({
        data: {
          id: randomUUID(),
          jobId: job['id'],
          triggerType: 'MANUAL',
          idempotencyKey: 'cho-san',
          scheduledAt: new Date(Date.now() - 1_000),
        },
      });

      const refused = await trigger(job['id'], 'moi');
      expect(refused.status).toBe(409);
      expect(refused.body.error).toMatchObject({
        code: 'SCHEDULER_JOB_NOT_ACTIVE',
        details: { status: 'PAUSED' },
      });
      await sleep(600);
      expect(media.calls).toHaveLength(0);
      expect((await getRun(job['id'], waiting.id))?.['status']).toBe('PENDING');

      // Tiếp tục thì run đang chờ được chạy.
      await http()
        .patch(`/api/v1/scheduler/jobs/${job['id']}`)
        .set(admin)
        .send({ status: 'ACTIVE' })
        .expect(200);
      expect((await waitRun(job['id'], waiting.id, ['SUCCEEDED', 'FAILED']))['status']).toBe(
        'SUCCEEDED',
      );

      // DISABLED: run chưa chạy bị đóng bằng JOB_DISABLED, không gọi media.
      await http()
        .patch(`/api/v1/scheduler/jobs/${job['id']}`)
        .set(admin)
        .send({ status: 'PAUSED' })
        .expect(200);
      const pending = await prisma.backgroundJobRun.create({
        data: {
          id: randomUUID(),
          jobId: job['id'],
          triggerType: 'MANUAL',
          idempotencyKey: 'bi-huy',
          scheduledAt: new Date(Date.now() - 1_000),
        },
      });
      const callsBefore = media.calls.length;
      await http()
        .patch(`/api/v1/scheduler/jobs/${job['id']}`)
        .set(admin)
        .send({ status: 'DISABLED' })
        .expect(200);
      expect(await getRun(job['id'], pending.id)).toMatchObject({
        status: 'FAILED',
        error_code: 'JOB_DISABLED',
      });
      expect((await trigger(job['id'], 'sau-disabled')).body.error.code).toBe(
        'SCHEDULER_JOB_NOT_ACTIVE',
      );
      await sleep(400);
      expect(media.calls).toHaveLength(callsBefore);
    });
  });

  describe('lịch CRON và nhiều instance', () => {
    it('đến hạn → một run CRON với khóa lũy đẳng; next_run_at dời sang mốc sau; lặp không tạo trùng', async () => {
      const job = await createJob({ schedule_type: 'CRON', cron_expression: YEARLY });
      const due = new Date(Math.floor(Date.now() / 60_000) * 60_000 - 60_000);
      await prisma.backgroundJob.update({ where: { id: job['id'] }, data: { nextRunAt: due } });

      const run = await waitFor(async () => {
        const runs = await http().get(`/api/v1/scheduler/jobs/${job['id']}/runs`).set(admin);
        const first = (runs.body.data as Body[])[0];
        return first && first['status'] === 'SUCCEEDED' ? first : undefined;
      });
      expect(run).toMatchObject({
        trigger_type: 'CRON',
        idempotency_key: `cron:${job['id']}:${due.toISOString()}`,
        scheduled_at: due.toISOString(),
        created_by: null,
      });
      const after = await http().get(`/api/v1/scheduler/jobs/${job['id']}`).set(admin).expect(200);
      const next = new Date(after.body.data.next_run_at as string);
      expect(next.getTime()).toBeGreaterThan(Date.now());
      expect(next.getUTCSeconds()).toBe(0);

      await sleep(700); // nhiều lượt tick nữa: không thêm run
      expect(await prisma.backgroundJobRun.count({ where: { jobId: job['id'] as string } })).toBe(
        1,
      );

      // Đặt lại đúng mốc cũ (giả lập sự cố) cũng không tạo run trùng nhờ khóa lũy đẳng.
      await prisma.backgroundJob.update({ where: { id: job['id'] }, data: { nextRunAt: due } });
      await sleep(700);
      expect(await prisma.backgroundJobRun.count({ where: { jobId: job['id'] as string } })).toBe(
        1,
      );
      expect(media.calls).toHaveLength(1);
    });

    it('nhiều instance: mỗi mốc CRON một run; job không allow_concurrent không bao giờ chạy chồng', async () => {
      await startWorker(); // instance thứ hai (đủ 2 instance × 2 vòng nhận run)

      const cronJob = await createJob({ schedule_type: 'CRON', cron_expression: YEARLY });
      const due = new Date(Math.floor(Date.now() / 60_000) * 60_000 - 60_000);
      await prisma.backgroundJob.update({ where: { id: cronJob['id'] }, data: { nextRunAt: due } });
      await waitFor(async () =>
        (await prisma.backgroundJobRun.count({
          where: { jobId: cronJob['id'] as string, status: 'SUCCEEDED' },
        })) === 1
          ? true
          : undefined,
      );
      await sleep(600);
      expect(
        await prisma.backgroundJobRun.count({ where: { jobId: cronJob['id'] as string } }),
      ).toBe(1);

      resetMedia();
      media.delayMs = 250;
      const serial = await createJob({ allow_concurrent: false });
      const ids: string[] = [];
      for (let i = 0; i < 5; i += 1) {
        ids.push((await trigger(serial['id'], `s${i}`).expect(201)).body.data.id as string);
      }
      for (const id of ids) await waitRun(serial['id'], id, ['SUCCEEDED']);
      expect(media.calls).toHaveLength(5);
      expect(media.maxActive).toBe(1);

      resetMedia();
      media.delayMs = 400;
      const parallel = await createJob({ allow_concurrent: true });
      const parallelIds: string[] = [];
      for (let i = 0; i < 4; i += 1) {
        parallelIds.push(
          (await trigger(parallel['id'], `p${i}`).expect(201)).body.data.id as string,
        );
      }
      for (const id of parallelIds) await waitRun(parallel['id'], id, ['SUCCEEDED']);
      expect(media.maxActive).toBeGreaterThan(1);
      // Mỗi run được nhận đúng một lần.
      const runs = await prisma.backgroundJobRun.findMany({
        where: { jobId: parallel['id'] as string },
      });
      expect(runs.map((run) => run.attempts)).toEqual([1, 1, 1, 1]);
    });

    it('worker chết giữa chừng: lease hết hạn thì run được nhận lại; hết lượt thì FAILED/RUN_LEASE_EXPIRED', async () => {
      const job = await createJob();
      const expired = new Date(Date.now() - 10_000);
      const make = (key: string, attempts: number): Promise<{ id: string }> =>
        prisma.backgroundJobRun.create({
          data: {
            id: randomUUID(),
            jobId: job['id'],
            triggerType: 'MANUAL',
            idempotencyKey: key,
            scheduledAt: new Date(Date.now() - 20_000),
            status: 'RUNNING',
            attempts,
            leaseToken: randomUUID(),
            leaseExpiresAt: expired,
            workerInstance: 'scheduler-worker@da-chet',
          },
        });
      const recoverable = await make('chet-1', 1);
      const exhausted = await make('chet-2', 2); // SCHEDULER_RUN_MAX_ATTEMPTS=2

      const recovered = await waitRun(job['id'], recoverable.id, ['SUCCEEDED', 'FAILED']);
      expect(recovered).toMatchObject({ status: 'SUCCEEDED', attempts: 2 });
      expect(recovered['worker_instance']).not.toBe('scheduler-worker@da-chet');
      expect(await getRun(job['id'], exhausted.id)).toMatchObject({
        status: 'FAILED',
        error_code: 'RUN_LEASE_EXPIRED',
        attempts: 2,
      });
      expect(media.calls).toHaveLength(1);
    });
  });
});

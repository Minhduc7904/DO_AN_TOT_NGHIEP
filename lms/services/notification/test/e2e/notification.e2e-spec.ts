import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { generateSigningKey, toJwk } from '@aiops-lms/common/auth';
import { mintGatewayToken, mintServiceToken } from '@aiops-lms/common/auth/testing';
import { AppExceptionFilter, correlationIdMiddleware } from '@aiops-lms/common/http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { SmtpEmailSender } from '../../src/adapters/mail/smtp-email.sender.js';
import { PrismaService } from '../../src/adapters/persistence/prisma.service.js';
import {
  EMAIL_SENDER,
  type Email,
  type EmailSender,
} from '../../src/application/ports/email-sender.js';

/**
 * Chạy với PostgreSQL, RabbitMQ và Mailpit (SMTP) thật; xem `pnpm test:notification:e2e`. API và
 * worker chạy cùng process nhưng là hai Nest app riêng (đúng hai module triển khai) và nói chuyện
 * qua RabbitMQ thật. Chỉ `student`/`auth` được giả bằng stub HTTP.
 */
describe('notification + notification-worker (PostgreSQL, RabbitMQ, Mailpit thật)', () => {
  const signingKey = generateSigningKey();
  const gatewayToken = mintGatewayToken(signingKey, 'notification');
  const asRole = (role: string, id: string): Record<string, string> => ({
    authorization: `Bearer ${gatewayToken}`,
    'x-principal-id': id,
    'x-principal-role': role,
  });
  const mailpit = `http://127.0.0.1:${process.env['MAILPIT_API_PORT'] ?? '58025'}`;
  const admin = asRole('admin', randomUUID());
  const mediaId = randomUUID();

  const run = randomUUID().slice(0, 8);
  const students = [
    { id: randomUUID(), email: `ok1-${run}@lms.test`, status: 'ACTIVE' },
    { id: randomUUID(), email: `ok2-${run}@lms.test`, status: 'ACTIVE' },
    { id: randomUUID(), email: `bad-${run}@lms.test`, status: 'ACTIVE' },
  ];
  const [ok1, ok2, bad] = students as [
    (typeof students)[0],
    (typeof students)[0],
    (typeof students)[0],
  ];
  /** Địa chỉ mà "SMTP" từ chối (bọc ngoài SMTP thật để tạo lỗi gửi có chủ đích). */
  const rejected = new Set<string>();

  let stub: Server;
  let api: INestApplication;
  let worker: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    if (!process.env['NOTIFICATION_DATABASE_URL']) {
      throw new Error('NOTIFICATION_DATABASE_URL là bắt buộc cho e2e của notification');
    }
    stub = createServer((req, res) => {
      const send = (status: number, body: unknown, pagination: unknown = null): void => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            success: status < 400,
            data: status < 400 ? body : null,
            error: status < 400 ? null : body,
            meta: { trace_id: 'stub', timestamp: new Date().toISOString(), pagination },
          }),
        );
      };
      const url = new URL(req.url ?? '/', 'http://stub');
      const dto = (student: (typeof students)[0]): unknown => ({
        ...student,
        full_name: 'Học viên',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (url.pathname === '/.well-known/jwks.json') {
        res.writeHead(200, { 'content-type': 'application/json' });
        return void res.end(JSON.stringify({ keys: [toJwk(signingKey.publicKey)] }));
      }
      if (req.method === 'POST' && url.pathname === '/internal/v1/auth/service-token') {
        return send(200, {
          access_token: mintServiceToken(signingKey, {
            subject: 'notification-worker',
            audience: 'identity',
            scopes: ['student:profile:read'],
          }),
          token_type: 'Bearer',
          expires_in: 600,
          scope: 'student:profile:read',
        });
      }
      if (url.pathname === '/internal/v1/students') {
        const pageSize = Number(url.searchParams.get('page_size') ?? 20);
        const page = Number(url.searchParams.get('page') ?? 1);
        return send(200, students.slice((page - 1) * pageSize, page * pageSize).map(dto), {
          page,
          page_size: pageSize,
          total: students.length,
          total_pages: Math.ceil(students.length / pageSize),
        });
      }
      const match = /^\/internal\/v1\/students\/([^/]+)$/u.exec(url.pathname);
      const found = students.find((student) => student.id === match?.[1]);
      if (found) return send(200, dto(found));
      return send(404, { code: 'NOT_FOUND', message: 'x', details: null });
    });
    await new Promise<void>((resolve) => stub.listen(0, '127.0.0.1', resolve));
    const stubUrl = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`;

    Object.assign(process.env, {
      OTEL_SDK_DISABLED: 'true',
      IDENTITY_BASE_URL: stubUrl,
      NOTIFICATION_IDENTITY_BASE_URL: stubUrl,
      SERVICE_CLIENT_ID: 'notification-worker',
      SERVICE_CLIENT_SECRET: 'notification-worker-secret-local-only',
      NOTIFICATION_RABBITMQ_URL:
        process.env['NOTIFICATION_RABBITMQ_URL'] ?? 'amqp://lms:lms-local-only@127.0.0.1:55672',
      NOTIFICATION_SMTP_HOST: process.env['NOTIFICATION_SMTP_HOST'] ?? '127.0.0.1',
      NOTIFICATION_SMTP_PORT: process.env['NOTIFICATION_SMTP_PORT'] ?? '51025',
      NOTIFICATION_OUTBOX_POLL_MS: '100',
      NOTIFICATION_WORKER_RETRY_DELAY_MS: '100',
      NOTIFICATION_WORKER_MAX_ATTEMPTS: '2',
      NOTIFICATION_ITEM_MAX_ATTEMPTS: '2',
      NOTIFICATION_ITEM_RETRY_DELAY_MS: '100',
      NOTIFICATION_DISPATCH_IDLE_WAIT_MS: '300',
    });
    const { AppModule } = await import('../../src/app.module.js');
    const { WorkerModule } = await import('../../src/worker.module.js');
    api = (
      await Test.createTestingModule({ imports: [AppModule] }).compile()
    ).createNestApplication();
    api.use(correlationIdMiddleware);
    api.useGlobalFilters(new AppExceptionFilter());
    await api.init();
    prisma = api.get(PrismaService);

    const smtp = new SmtpEmailSender({
      host: process.env['NOTIFICATION_SMTP_HOST'] as string,
      port: Number(process.env['NOTIFICATION_SMTP_PORT']),
      secure: false,
      from: 'LMS <no-reply@lms.local>',
      timeoutMs: 5_000,
    });
    const flaky: EmailSender = {
      send: (email: Email) =>
        rejected.has(email.to)
          ? Promise.reject(new Error('550 mailbox unavailable'))
          : smtp.send(email),
    };
    worker = (
      await Test.createTestingModule({ imports: [WorkerModule] })
        .overrideProvider(EMAIL_SENDER)
        .useValue(flaky)
        .compile()
    ).createNestApplication();
    await worker.init();
  });

  afterAll(async () => {
    await worker?.close();
    await api?.close();
    await new Promise<void>((resolve) => {
      stub?.closeAllConnections();
      stub?.close(() => resolve());
    });
  });

  const http = (): ReturnType<typeof request> => request(api.getHttpServer());

  async function waitFor<T>(read: () => Promise<T | undefined>, timeoutMs = 20_000): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const value = await read();
      if (value !== undefined) return value;
      if (Date.now() > deadline) throw new Error('Hết thời gian chờ điều kiện');
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  /** Thư Mailpit gửi tới `to` (Mailpit thật; không mock). */
  async function mailsTo(to: string): Promise<{ Subject: string; Snippet: string }[]> {
    const response = await fetch(
      `${mailpit}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`,
    );
    const body = (await response.json()) as { messages: { Subject: string; Snippet: string }[] };
    return body.messages;
  }

  const batchStatus = async (batchId: string): Promise<string> =>
    (await http().get(`/api/v1/notification-batches/${batchId}`).set(admin).expect(200)).body.data
      .status;

  async function waitForBatch(
    batchId: string,
    statuses: string[],
  ): Promise<Record<string, unknown>> {
    return waitFor(async () => {
      const response = await http().get(`/api/v1/notification-batches/${batchId}`).set(admin);
      return statuses.includes(response.body.data.status) ? response.body.data : undefined;
    });
  }

  describe('phân quyền', () => {
    it('thiếu service token của gateway → 401; sai role → 403', async () => {
      await http().get('/api/v1/notification-batches').expect(401);
      await http().get('/api/v1/notification-batches').set(asRole('student', ok1.id)).expect(403);
      await http().get('/api/v1/notifications/me').set(admin).expect(403);
      await http()
        .post('/api/v1/notifications')
        .set(asRole('instructor', randomUUID()))
        .send({ student_id: ok1.id, title: 't', content_markdown: 'c' })
        .expect(403);
    });

    it('dữ liệu sai → 400, mã lỗi nghiệp vụ không đổi', async () => {
      const response = await http()
        .post('/api/v1/notifications')
        .set(admin)
        .send({ student_id: 'x', title: '', content_markdown: '' })
        .expect(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('route /health không cần xác thực', async () => {
      await http().get('/health').expect(200);
    });
  });

  describe('thông báo đơn', () => {
    it('ghi inbox, gửi email thật qua Mailpit và student tự đọc/đánh dấu đã đọc', async () => {
      const created = await http()
        .post('/api/v1/notifications')
        .set(admin)
        .send({
          student_id: ok1.id,
          title: `Chào ${run}`,
          content_markdown: `Nội dung ![ảnh](/api/v1/media/${mediaId}/content)`,
        })
        .expect(201);
      const id = created.body.data.id as string;
      expect(created.body.data).toMatchObject({
        status: 'UNREAD',
        email_status: 'PENDING',
        source_type: 'SINGLE',
        batch_id: null,
      });

      await waitFor(async () =>
        (await mailsTo(ok1.email)).some((m) => m.Subject === `Chào ${run}`) ? true : undefined,
      );
      await waitFor(async () => {
        const read = await http().get(`/api/v1/notifications/${id}`).set(admin);
        return read.body.data.email_status === 'SENT' ? true : undefined;
      });

      const mine = await http()
        .get('/api/v1/notifications/me?status=UNREAD')
        .set(asRole('student', ok1.id))
        .expect(200);
      expect(mine.body.data.map((n: { id: string }) => n.id)).toContain(id);
      expect(mine.body.meta.pagination.total).toBeGreaterThanOrEqual(1);

      await http()
        .patch(`/api/v1/notifications/${id}/read`)
        .set(asRole('student', ok2.id))
        .expect(404);
      const read = await http()
        .patch(`/api/v1/notifications/${id}/read`)
        .set(asRole('student', ok1.id))
        .expect(200);
      expect(read.body.data.status).toBe('READ');

      const rows = await prisma.$queryRawUnsafe<{ name: string }[]>(
        `SELECT envelope->>'command_name' AS name FROM outbox_messages WHERE envelope->'payload'->>'notification_id' = $1`,
        id,
      );
      expect(rows.map((row) => row.name).sort()).toEqual([
        'media.notification-usage.register',
        'notification.single.dispatch',
      ]);
    });

    it('send_email=false: chỉ vào inbox, không phát command gửi email', async () => {
      const created = await http()
        .post('/api/v1/notifications')
        .set(admin)
        .send({ student_id: ok2.id, title: 'Chỉ inbox', content_markdown: 'x', send_email: false })
        .expect(201);

      expect(created.body.data.email_status).toBe('NOT_REQUESTED');
      const all = await http()
        .post('/api/v1/notifications/read-all')
        .set(asRole('student', ok2.id))
        .expect(200);
      expect(all.body.data.updated_count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('batch', () => {
    it('gửi cho mọi student ACTIVE: email thật, inbox riêng, job usage media đóng đủ; lỗi một người → PARTIAL_FAILED rồi retry-failed', async () => {
      rejected.add(bad.email);
      const created = await http()
        .post('/api/v1/notification-batches')
        .set(admin)
        .send({
          title: `Batch ${run}`,
          content_markdown: `Ảnh ![x](/api/v1/media/${mediaId}/content)`,
          batch_size: 2,
        })
        .expect(201);
      const batchId = created.body.data.id as string;
      expect(created.body.data.status).toBe('PENDING');

      const finished = await waitForBatch(batchId, ['COMPLETED', 'PARTIAL_FAILED', 'FAILED']);
      expect(finished).toMatchObject({
        status: 'PARTIAL_FAILED',
        requested_count: 3,
        success_count: 2,
        failed_count: 1,
      });

      for (const student of [ok1, ok2]) {
        await waitFor(async () =>
          (await mailsTo(student.email)).some((m) => m.Subject === `Batch ${run}`)
            ? true
            : undefined,
        );
      }
      expect((await mailsTo(bad.email)).some((m) => m.Subject === `Batch ${run}`)).toBe(false);

      const inbox = await http()
        .get('/api/v1/notifications/me')
        .set(asRole('student', ok1.id))
        .expect(200);
      expect(
        inbox.body.data.find((n: { batch_id: string }) => n.batch_id === batchId),
      ).toMatchObject({
        source_type: 'BULK',
        email_status: 'SENT',
      });

      const snapshot = await http()
        .get(`/api/v1/notification-batches/${batchId}/snapshot-status`)
        .set(admin)
        .expect(200);
      expect(snapshot.body.data).toMatchObject({ snapshotted_count: 3, snapshot_finished: true });
      const delivery = await http()
        .get(`/api/v1/notification-batches/${batchId}/delivery-status`)
        .set(admin)
        .expect(200);
      expect(delivery.body.data).toMatchObject({
        total: 3,
        success: 2,
        failed: 1,
        pending: 0,
        retry: 0,
        processing: 0,
      });
      const failed = await http()
        .get(`/api/v1/notification-batches/${batchId}/failed-items`)
        .set(admin)
        .expect(200);
      expect(failed.body.data).toHaveLength(1);
      expect(failed.body.data[0]).toMatchObject({
        student_id: bad.id,
        email: bad.email,
        attempts: 2,
      });

      const [job] = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `SELECT media_usage_job_id::text AS id FROM notification_batches WHERE id = $1::uuid`,
        batchId,
      );
      const jobId = job?.id;
      // Các command cùng transaction có cùng created_at nên kiểm tra theo nội dung, không theo thứ tự.
      const commands = await prisma.$queryRawUnsafe<
        { name: string; payload: Record<string, unknown> }[]
      >(
        `SELECT envelope->>'command_name' AS name, envelope->'payload' AS payload
           FROM outbox_messages
          WHERE envelope->>'command_name' LIKE 'media.%'
            AND (envelope->'payload'->>'batch_id' = $1 OR envelope->'payload'->>'job_id' = $2)`,
        batchId,
        jobId,
      );
      const named = (name: string): { payload: Record<string, unknown> }[] =>
        commands.filter((c) => c.name === name);
      expect(named('media.notification-usage.start-job')).toHaveLength(1);
      expect(named('media.notification-usage.complete-job')).toHaveLength(1);
      // Chỉ recipient gửi thành công (2 người) mới đăng ký usage, bất kể chia thành mấy lô.
      const registered = named('media.notification-usage.register-batch').flatMap(
        (c) => c.payload['items'] as unknown[],
      );
      expect(registered).toHaveLength(2);
      expect(named('media.notification-usage.complete-job')[0]?.payload).toMatchObject({
        job_id: jobId,
        expected_usage_count: 2,
      });

      // Retry: chỉ chạy lại recipient lỗi; mỗi batch nguồn chỉ có một retry.
      rejected.clear();
      const retry = await http()
        .post(`/api/v1/notification-batches/${batchId}/retry-failed`)
        .set(admin)
        .expect(201);
      expect(retry.body.data).toMatchObject({
        target_scope: 'FAILED_RECIPIENTS',
        source_batch_id: batchId,
      });
      const again = await http()
        .post(`/api/v1/notification-batches/${batchId}/retry-failed`)
        .set(admin)
        .expect(409);
      expect(again.body.error).toMatchObject({
        code: 'NOTIFICATION_BATCH_RETRY_EXISTS',
        details: { retry_batch_id: retry.body.data.id },
      });

      const retried = await waitForBatch(retry.body.data.id, [
        'COMPLETED',
        'PARTIAL_FAILED',
        'FAILED',
      ]);
      expect(retried).toMatchObject({ status: 'COMPLETED', requested_count: 1, success_count: 1 });
      await waitFor(async () =>
        (await mailsTo(bad.email)).some((m) => m.Subject === `Batch ${run}`) ? true : undefined,
      );
      // Hai recipient đã nhận ở batch đầu không nhận lại.
      expect((await mailsTo(ok1.email)).filter((m) => m.Subject === `Batch ${run}`)).toHaveLength(
        1,
      );
    });

    it('batch đang chạy hoặc không có lỗi không retry được; batch lạ → 404', async () => {
      const created = await http()
        .post('/api/v1/notification-batches')
        .set(admin)
        .send({ title: `Sạch ${run}`, content_markdown: 'ok' })
        .expect(201);
      const batchId = created.body.data.id as string;
      await waitForBatch(batchId, ['COMPLETED']);

      const response = await http()
        .post(`/api/v1/notification-batches/${batchId}/retry-failed`)
        .set(admin)
        .expect(409);
      expect(response.body.error.code).toBe('NOTIFICATION_BATCH_NOT_RETRYABLE');
      await http().get(`/api/v1/notification-batches/${randomUUID()}`).set(admin).expect(404);
      expect(await batchStatus(batchId)).toBe('COMPLETED');
    });

    it('danh sách batch phân trang và lọc theo trạng thái', async () => {
      const response = await http()
        .get('/api/v1/notification-batches?status=COMPLETED&page_size=1')
        .set(admin)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.meta.pagination).toMatchObject({ page: 1, page_size: 1 });
      await http().get('/api/v1/notification-batches?page_size=101').set(admin).expect(400);
    });
  });
});

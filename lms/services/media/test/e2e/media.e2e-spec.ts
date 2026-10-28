import { createHash, randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { generateSigningKey, toJwk } from '@aiops-lms/common/auth';
import { mintGatewayToken, mintServiceToken } from '@aiops-lms/common/auth/testing';
import { AppExceptionFilter, correlationIdMiddleware } from '@aiops-lms/common/http';
import {
  buildCommandEnvelope,
  RabbitMqCommandPublisher,
  RabbitMqSession,
} from '@aiops-lms/common/messaging';
import { MEDIA_COMMANDS, mediaCommandFixtures } from '@aiops-lms/contracts/commands';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import sharp from 'sharp';
import request from 'supertest';

/**
 * Chạy với PostgreSQL, MinIO và RabbitMQ thật; xem `pnpm test:media:e2e`. API và worker chạy cùng
 * process nhưng là hai Nest app riêng (đúng hai module triển khai), nói chuyện qua RabbitMQ thật.
 */
describe('media + media-worker (PostgreSQL, MinIO, RabbitMQ thật)', () => {
  const signingKey = generateSigningKey();
  const gatewayToken = mintGatewayToken(signingKey, 'media');
  const asRole = (role: string, id: string): Record<string, string> => ({
    authorization: `Bearer ${gatewayToken}`,
    'x-principal-id': id,
    'x-principal-role': role,
  });
  const instructorId = randomUUID();
  const otherInstructorId = randomUUID();
  const studentId = randomUUID();
  const inactiveStudentId = randomUUID();
  const instructor = asRole('instructor', instructorId);
  const otherInstructor = asRole('instructor', otherInstructorId);
  const student = asRole('student', studentId);
  const admin = asRole('admin', randomUUID());
  // Route anonymous (content, thumbnail, url) chỉ cần service token của Gateway.
  const gatewayOnly = { authorization: `Bearer ${gatewayToken}` };
  const courseToken = mintServiceToken(signingKey, {
    subject: 'course',
    audience: 'media',
    scopes: ['media:usage:read', 'media:content:read'],
  });

  let stub: Server;
  let api: INestApplication;
  let worker: INestApplication;
  let publisher: RabbitMqCommandPublisher;
  let session: RabbitMqSession;

  beforeAll(async () => {
    for (const name of ['MEDIA_DATABASE_URL'] as const) {
      if (!process.env[name]) throw new Error(`${name} là bắt buộc cho e2e của media`);
    }
    // Stub của auth (JWKS + service-token) và student (hồ sơ) trong một server.
    stub = createServer((req, res) => {
      const send = (status: number, body: unknown): void => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(body));
      };
      if (req.url === '/.well-known/jwks.json') {
        return send(200, { keys: [toJwk(signingKey.publicKey)] });
      }
      if (req.method === 'POST' && req.url === '/internal/v1/auth/service-token') {
        const token = mintServiceToken(signingKey, {
          subject: 'media',
          audience: 'student',
          scopes: ['student:profile:read'],
        });
        return send(200, {
          success: true,
          data: {
            access_token: token,
            token_type: 'Bearer',
            expires_in: 600,
            scope: 'student:profile:read',
          },
          error: null,
          meta: { trace_id: 'stub', timestamp: new Date().toISOString(), pagination: null },
        });
      }
      const match = /^\/internal\/v1\/students\/([^/]+)$/u.exec(req.url ?? '');
      if (match?.[1] === studentId || match?.[1] === inactiveStudentId) {
        const now = new Date().toISOString();
        return send(200, {
          success: true,
          data: {
            id: match[1],
            email: 's@example.com',
            full_name: 'Học viên',
            status: match[1] === studentId ? 'ACTIVE' : 'INACTIVE',
            created_at: now,
            updated_at: now,
          },
          error: null,
          meta: { trace_id: 'stub', timestamp: now, pagination: null },
        });
      }
      return send(404, {
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: 'x', details: null },
        meta: null,
      });
    });
    await new Promise<void>((resolve) => stub.listen(0, '127.0.0.1', resolve));
    const stubUrl = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`;

    Object.assign(process.env, {
      OTEL_SDK_DISABLED: 'true',
      AUTH_BASE_URL: stubUrl,
      MEDIA_STUDENT_BASE_URL: stubUrl,
      SERVICE_CLIENT_ID: 'media',
      SERVICE_CLIENT_SECRET: 'media-client-secret-local-only',
      MEDIA_RABBITMQ_URL:
        process.env['MEDIA_RABBITMQ_URL'] ?? 'amqp://lms:lms-local-only@127.0.0.1:55672',
      MINIO_ENDPOINT: process.env['MINIO_ENDPOINT'] ?? '127.0.0.1',
      MINIO_PORT: process.env['MINIO_PORT'] ?? '59000',
      MINIO_PUBLIC_URL: `http://${process.env['MINIO_ENDPOINT'] ?? '127.0.0.1'}:${process.env['MINIO_PORT'] ?? '59000'}`,
      MEDIA_OUTBOX_POLL_MS: '100',
      MEDIA_WORKER_RETRY_DELAY_MS: '100',
      MEDIA_WORKER_MAX_ATTEMPTS: '2',
    });
    const { AppModule } = await import('../../src/app.module.js');
    const { WorkerModule } = await import('../../src/worker.module.js');
    api = (
      await Test.createTestingModule({ imports: [AppModule] }).compile()
    ).createNestApplication();
    api.use(correlationIdMiddleware);
    api.useGlobalFilters(new AppExceptionFilter());
    await api.init();
    worker = (
      await Test.createTestingModule({ imports: [WorkerModule] }).compile()
    ).createNestApplication();
    await worker.init();

    session = new RabbitMqSession({
      url: process.env['MEDIA_RABBITMQ_URL'] as string,
      connectTimeoutMs: 5_000,
    });
    publisher = new RabbitMqCommandPublisher(session, { confirmTimeoutMs: 3_000 });
  });

  afterAll(async () => {
    await session?.close();
    await worker?.close();
    await api?.close();
    await new Promise<void>((resolve) => {
      stub?.closeAllConnections();
      stub?.close(() => resolve());
    });
  });

  const http = (): ReturnType<typeof request> => request(api.getHttpServer());

  async function waitFor<T>(read: () => Promise<T | undefined>, timeoutMs = 15_000): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const value = await read();
      if (value !== undefined) return value;
      if (Date.now() > deadline) throw new Error('Hết thời gian chờ điều kiện');
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  const png = (width = 64, height = 48): Promise<Buffer> =>
    sharp({ create: { width, height, channels: 3, background: '#2266cc' } })
      .png()
      .toBuffer();

  /** upload-intent → POST thẳng lên MinIO → upload-complete. */
  async function uploadDirect(
    headers: Record<string, string>,
    content: Buffer,
    fileName: string,
    mimeType: string,
    checksum = createHash('sha256').update(content).digest('hex'),
  ): Promise<{ mediaId: string; complete: request.Response }> {
    const intent = await http()
      .post('/api/v1/media/upload-intents')
      .set(headers)
      .send({
        file_name: fileName,
        mime_type: mimeType,
        size_bytes: content.length,
        checksum_sha256: checksum,
      })
      .expect(201);
    const { media_id: mediaId, upload } = intent.body.data as {
      media_id: string;
      upload: { method: string; url: string; fields: Record<string, string> };
    };
    const form = new FormData();
    for (const [key, value] of Object.entries(upload.fields)) form.append(key, value);
    form.append('file', new Blob([new Uint8Array(content)], { type: mimeType }), fileName);
    const stored = await fetch(upload.url, { method: 'POST', body: form });
    expect(stored.status).toBeLessThan(300);
    const complete = await http().post(`/api/v1/media/${mediaId}/upload-complete`).set(headers);
    return { mediaId, complete };
  }

  const getMedia = async (
    headers: Record<string, string>,
    id: string,
  ): Promise<Record<string, unknown>> => {
    const library = await http()
      .get('/api/v1/media/library?page_size=100')
      .set(headers)
      .expect(200);
    return (library.body.data as Record<string, unknown>[]).find(
      (item) => item['id'] === id,
    ) as Record<string, unknown>;
  };

  it('upload trực tiếp lên MinIO → READY → stream nội dung và thumbnail', async () => {
    const content = await png();
    const { mediaId, complete } = await uploadDirect(
      instructor,
      content,
      'ảnh bìa.PNG',
      'image/png',
    );
    expect(complete.status).toBe(200);
    expect(complete.body.data).toMatchObject({
      id: mediaId,
      type: 'IMAGE',
      status: 'READY',
      thumbnail_status: 'PENDING',
      content_url: `/api/v1/media/${mediaId}/content`,
      uploaded_by: instructorId,
    });
    // Client không bao giờ thấy bucket hay object key.
    expect(JSON.stringify(complete.body)).not.toMatch(/bucket|object_key|tmp\//u);

    // Route công khai: chỉ cần service token của Gateway, không cần danh tính user.
    const full = await http().get(`/api/v1/media/${mediaId}/content`).set(gatewayOnly).expect(200);
    expect(full.headers['content-type']).toContain('image/png');
    expect(Buffer.from(full.body as Buffer).equals(content)).toBe(true);

    const partial = await http()
      .get(`/api/v1/media/${mediaId}/content`)
      .set({ ...gatewayOnly, range: 'bytes=0-9' })
      .expect(206);
    expect(partial.headers['content-range']).toBe(`bytes 0-9/${content.length}`);
    await http()
      .get(`/api/v1/media/${mediaId}/content`)
      .set({ ...gatewayOnly, range: `bytes=${content.length + 5}-` })
      .expect(416);

    // Thumbnail chưa có thì MEDIA_NOT_READY; worker sinh xong thì stream được WebP.
    const ready = await waitFor(async () => {
      const item = await getMedia(instructor, mediaId);
      return item['thumbnail_status'] === 'READY' ? item : undefined;
    });
    expect(ready['thumbnail_url']).toBe(`/api/v1/media/${mediaId}/thumbnail`);
    const thumb = await http()
      .get(`/api/v1/media/${mediaId}/thumbnail`)
      .set(gatewayOnly)
      .expect(200);
    expect(thumb.headers['content-type']).toContain('image/webp');
    const meta = await sharp(Buffer.from(thumb.body as Buffer)).metadata();
    expect(meta.format).toBe('webp');
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(480);

    // Thumbnail không xuất hiện trong thư viện như một file riêng.
    const library = await http()
      .get('/api/v1/media/library?page_size=100')
      .set(instructor)
      .expect(200);
    expect((library.body.data as unknown[]).length).toBe(
      (library.body.meta.pagination as { total: number }).total,
    );
  });

  it('checksum sai → MEDIA_CHECKSUM_MISMATCH, media FAILED, không còn object tạm', async () => {
    const content = await png(10, 10);
    const { mediaId, complete } = await uploadDirect(
      instructor,
      content,
      'sai.png',
      'image/png',
      'a'.repeat(64),
    );
    expect(complete.status).toBe(400);
    expect(complete.body.error.code).toBe('MEDIA_CHECKSUM_MISMATCH');
    expect(await getMedia(instructor, mediaId)).toMatchObject({
      status: 'FAILED',
      content_url: null,
    });
    await http().get(`/api/v1/media/${mediaId}/content`).set(gatewayOnly).expect(409);
    // Hoàn tất lại sau khi FAILED không phục hồi được.
    await http().post(`/api/v1/media/${mediaId}/upload-complete`).set(instructor).expect(409);
  });

  it('upload-complete khi chưa upload → MEDIA_UPLOAD_NOT_COMPLETED; chỉ chủ sở hữu hoặc admin', async () => {
    const content = await png(8, 8);
    const intent = await http()
      .post('/api/v1/media/upload-intents')
      .set(instructor)
      .send({
        file_name: 'chua-upload.png',
        mime_type: 'image/png',
        size_bytes: content.length,
        checksum_sha256: createHash('sha256').update(content).digest('hex'),
      })
      .expect(201);
    const mediaId = intent.body.data.media_id as string;
    const missing = await http().post(`/api/v1/media/${mediaId}/upload-complete`).set(instructor);
    expect(missing.status).toBe(409);
    expect(missing.body.error.code).toBe('MEDIA_UPLOAD_NOT_COMPLETED');
    await http().post(`/api/v1/media/${mediaId}/upload-complete`).set(otherInstructor).expect(403);
  });

  it('giới hạn dung lượng theo loại và validate body', async () => {
    const tooLarge = await http()
      .post('/api/v1/media/upload-intents')
      .set(instructor)
      .send({
        file_name: 'lon.png',
        mime_type: 'image/png',
        size_bytes: 10 * 1024 * 1024 + 1,
        checksum_sha256: 'b'.repeat(64),
      });
    expect(tooLarge.status).toBe(413);
    expect(tooLarge.body.error).toMatchObject({
      code: 'MEDIA_TOO_LARGE',
      details: { max_size_bytes: 10 * 1024 * 1024 },
    });
    await http()
      .post('/api/v1/media/upload-intents')
      .set(instructor)
      .send({ file_name: 'x.png', mime_type: 'khong-hop-le', size_bytes: 1, checksum_sha256: 'zz' })
      .expect(400);
  });

  it('upload multipart qua media; tài liệu không có thumbnail; thư viện cô lập theo chủ sở hữu', async () => {
    const pdf = Buffer.from('%PDF-1.4 e2e document');
    const uploaded = await http()
      .post('/api/v1/media')
      .set(instructor)
      .attach('file', pdf, { filename: 'bai-giang.pdf', contentType: 'application/pdf' })
      .expect(201);
    expect(uploaded.body.data).toMatchObject({
      type: 'DOCUMENT',
      status: 'READY',
      thumbnail_status: 'NOT_APPLICABLE',
      thumbnail_url: null,
    });
    const id = uploaded.body.data.id as string;
    const missingThumb = await http().get(`/api/v1/media/${id}/thumbnail`).set(gatewayOnly);
    expect(missingThumb.status).toBe(409);
    expect(missingThumb.body.error).toMatchObject({
      code: 'MEDIA_NOT_READY',
      details: { thumbnail_status: 'NOT_APPLICABLE' },
    });
    await http().post('/api/v1/media').set(instructor).expect(400);

    expect(await getMedia(instructor, id)).toBeDefined();
    expect(await getMedia(otherInstructor, id)).toBeUndefined();
    expect(await getMedia(admin, id)).toBeDefined();
    const filtered = await http()
      .get('/api/v1/media/library?type=DOCUMENT')
      .set(instructor)
      .expect(200);
    expect(
      (filtered.body.data as { type: string }[]).every((item) => item.type === 'DOCUMENT'),
    ).toBe(true);
  });

  it('usage: quy tắc owner/type, thay thế singleton, sắp xếp, xóa và URL công khai', async () => {
    const image = await (async () => {
      const { mediaId } = await uploadDirect(instructor, await png(), 'a.png', 'image/png');
      return mediaId;
    })();
    const docId = (
      await http()
        .post('/api/v1/media')
        .set(instructor)
        .attach('file', Buffer.from('doc'), { filename: 'a.txt', contentType: 'text/plain' })
        .expect(201)
    ).body.data.id as string;
    const courseId = randomUUID();

    // Tài liệu không làm thumbnail; usage_type phải khớp owner_kind.
    const notImage = await http().post('/api/v1/media/usages').set(instructor).send({
      media_id: docId,
      owner_kind: 'COURSE',
      owner_id: courseId,
      usage_type: 'COURSE_THUMBNAIL',
    });
    expect(notImage.status).toBe(409);
    expect(notImage.body.error.code).toBe('MEDIA_USAGE_CONFLICT');
    await http()
      .post('/api/v1/media/usages')
      .set(instructor)
      .send({
        media_id: image,
        owner_kind: 'STUDENT',
        owner_id: courseId,
        usage_type: 'COURSE_THUMBNAIL',
      })
      .expect(400);
    // Media của người khác không gắn được; học viên không gắn vào course.
    await http()
      .post('/api/v1/media/usages')
      .set(otherInstructor)
      .send({
        media_id: image,
        owner_kind: 'COURSE',
        owner_id: courseId,
        usage_type: 'COURSE_GALLERY',
      })
      .expect(403);
    await http()
      .post('/api/v1/media/usages')
      .set(student)
      .send({
        media_id: image,
        owner_kind: 'COURSE',
        owner_id: courseId,
        usage_type: 'COURSE_GALLERY',
      })
      .expect(403);

    const first = await http()
      .post('/api/v1/media/usages')
      .set(instructor)
      .send({
        media_id: image,
        owner_kind: 'COURSE',
        owner_id: courseId,
        usage_type: 'COURSE_THUMBNAIL',
      })
      .expect(201);
    expect(first.body.data).toMatchObject({ usage_type: 'COURSE_THUMBNAIL', owner_id: courseId });

    // Đặt lại thumbnail bằng ảnh khác thay bản cũ (mỗi course một thumbnail).
    const second = (await uploadDirect(instructor, await png(20, 20), 'b.png', 'image/png'))
      .mediaId;
    const replaced = await http()
      .post('/api/v1/media/usages')
      .set(instructor)
      .send({
        media_id: second,
        owner_kind: 'COURSE',
        owner_id: courseId,
        usage_type: 'COURSE_THUMBNAIL',
      })
      .expect(201);
    const internalIds = await http()
      .post('/internal/v1/media/usages/ids:query')
      .set({ authorization: `Bearer ${courseToken}` })
      .send({ owner_kind: 'COURSE', owner_ids: [courseId] })
      .expect(200);
    expect(internalIds.body.data.items).toEqual([
      { owner_id: courseId, usage_ids: [replaced.body.data.id] },
    ]);

    // Gallery: tạo theo lô, sắp xếp lại, xóa.
    const batch = await http()
      .post('/api/v1/media/usages/batch')
      .set(instructor)
      .send({
        usages: [
          {
            media_id: image,
            owner_kind: 'COURSE',
            owner_id: courseId,
            usage_type: 'COURSE_GALLERY',
          },
          {
            media_id: second,
            owner_kind: 'COURSE',
            owner_id: courseId,
            usage_type: 'COURSE_GALLERY',
          },
        ],
      })
      .expect(201);
    const [a, b] = (batch.body.data as { id: string; position: number }[]).map((usage) => usage.id);
    expect((batch.body.data as { position: number }[]).map((usage) => usage.position)).toEqual([
      0, 1,
    ]);
    const reordered = await http()
      .post('/api/v1/media/usages/reorder')
      .set(instructor)
      .send({
        owner_kind: 'COURSE',
        owner_id: courseId,
        usage_type: 'COURSE_GALLERY',
        usage_ids: [b, a],
      })
      .expect(200);
    expect((reordered.body.data as { id: string }[]).map((usage) => usage.id)).toEqual([b, a]);
    await http()
      .post('/api/v1/media/usages/reorder')
      .set(instructor)
      .send({
        owner_kind: 'COURSE',
        owner_id: courseId,
        usage_type: 'COURSE_GALLERY',
        usage_ids: [a],
      })
      .expect(400);

    // URL công khai không lộ bucket/key.
    const urls = await http()
      .get(`/api/v1/media/usages/urls?usage_ids=${a},${b}`)
      .set(gatewayOnly)
      .expect(200);
    expect(urls.body.data).toHaveLength(2);
    expect(JSON.stringify(urls.body)).not.toMatch(/bucket|object_key/u);
    const one = await http()
      .get(`/api/v1/media/usages/${a as string}/url`)
      .set(gatewayOnly)
      .expect(200);
    expect(one.body.data.url).toBe(`/api/v1/media/${image}/content`);

    await http()
      .delete(`/api/v1/media/usages/${a as string}`)
      .set(otherInstructor)
      .expect(403);
    await http()
      .delete(`/api/v1/media/usages/${a as string}`)
      .set(instructor)
      .expect(204);
    await http()
      .get(`/api/v1/media/usages/${a as string}/url`)
      .set(gatewayOnly)
      .expect(404);
  });

  it('avatar student: chỉ chủ hồ sơ ACTIVE, qua cạnh media → student', async () => {
    const { mediaId } = await uploadDirect(student, await png(), 'avatar.png', 'image/png');
    const attach = (headers: Record<string, string>, ownerId: string): request.Test =>
      http().post('/api/v1/media/usages').set(headers).send({
        media_id: mediaId,
        owner_kind: 'STUDENT',
        owner_id: ownerId,
        usage_type: 'STUDENT_AVATAR',
      });
    const ok = await attach(student, studentId);
    expect(ok.status).toBe(201);
    expect((await attach(student, randomUUID())).status).toBe(403);
    // Hồ sơ không còn ACTIVE (do admin gắn thay) bị từ chối; hồ sơ không tồn tại → 404.
    expect((await attach(admin, inactiveStudentId)).status).toBe(403);
    expect((await attach(admin, randomUUID())).status).toBe(404);
  });

  it('retry thumbnail: chỉ khi chưa READY; loại không có thumbnail bị từ chối', async () => {
    const docId = (
      await http()
        .post('/api/v1/media')
        .set(instructor)
        .attach('file', Buffer.from('x'), { filename: 'x.txt', contentType: 'text/plain' })
        .expect(201)
    ).body.data.id as string;
    await http().post(`/api/v1/media/${docId}/thumbnail/retry`).set(instructor).expect(400);
    const { mediaId } = await uploadDirect(instructor, await png(), 'r.png', 'image/png');
    await waitFor(async () =>
      (await getMedia(instructor, mediaId))['thumbnail_status'] === 'READY' ? true : undefined,
    );
    const again = await http()
      .post(`/api/v1/media/${mediaId}/thumbnail/retry`)
      .set(instructor)
      .expect(200);
    expect(again.body.data.thumbnail_status).toBe('READY');
  });

  it('command: đồng bộ usage từ markdown, xóa theo id, idempotent theo message_id', async () => {
    const image = (await uploadDirect(instructor, await png(), 'md.png', 'image/png')).mediaId;
    const other = (await uploadDirect(instructor, await png(12, 12), 'md2.png', 'image/png'))
      .mediaId;
    const ownerId = randomUUID();
    const command = MEDIA_COMMANDS.markdownUsageSynchronize;
    const send = async (markdown: string, messageId = randomUUID()): Promise<void> => {
      await publisher.publish(
        command.queue,
        buildCommandEnvelope({
          commandName: command.name,
          schemaVersion: command.version,
          messageId,
          producer: { serviceName: 'course', serviceVersion: '0.1.0' },
          payload: {
            ...mediaCommandFixtures.markdownUsageSynchronize,
            owner_id: ownerId,
            markdown,
            actor_id: instructorId,
          },
        }),
      );
    };
    const usagesOf = async (): Promise<string[]> => {
      const response = await http()
        .post('/internal/v1/media/usages/ids:query')
        .set({ authorization: `Bearer ${courseToken}` })
        .send({ owner_kind: 'COURSE', owner_ids: [ownerId] })
        .expect(200);
      return response.body.data.items[0].usage_ids as string[];
    };

    const messageId = randomUUID();
    await send(
      `![a](/api/v1/media/${image}/content)\n[b](/api/v1/media/${randomUUID()}/content)`,
      messageId,
    );
    const afterFirst = await waitFor(async () => {
      const ids = await usagesOf();
      return ids.length === 1 ? ids : undefined;
    });
    // Giao lại cùng message_id không tạo trùng; markdown mới bỏ ảnh cũ, thêm ảnh khác.
    await send('đã đổi', messageId);
    await send(`![b](/api/v1/media/${other}/thumbnail)`);
    const afterSecond = await waitFor(async () => {
      const ids = await usagesOf();
      return ids.length === 1 && ids[0] !== afterFirst[0] ? ids : undefined;
    });
    const jobs = await http()
      .get('/api/v1/media/jobs?type=MARKDOWN_USAGE_SYNC')
      .set(admin)
      .expect(200);
    expect(
      (jobs.body.data as { status: string }[]).some((job) => job.status === 'PARTIAL_FAILED'),
    ).toBe(true);

    const del = MEDIA_COMMANDS.usagesDeleteByIds;
    await publisher.publish(
      del.queue,
      buildCommandEnvelope({
        commandName: del.name,
        schemaVersion: del.version,
        producer: { serviceName: 'course', serviceVersion: '0.1.0' },
        payload: { usage_ids: afterSecond },
      }),
    );
    await waitFor(async () => ((await usagesOf()).length === 0 ? true : undefined));
  });

  it('command notification-usage: register + start/complete job theo thứ tự bất kỳ', async () => {
    const image = (await uploadDirect(admin, await png(), 'n.png', 'image/png')).mediaId;
    const jobId = randomUUID();
    const publish = async (
      entry: (typeof MEDIA_COMMANDS)[keyof typeof MEDIA_COMMANDS],
      payload: unknown,
    ): Promise<void> =>
      publisher.publish(
        entry.queue,
        buildCommandEnvelope({
          commandName: entry.name,
          schemaVersion: entry.version,
          producer: { serviceName: 'notification', serviceVersion: '0.1.0' },
          payload,
        }),
      );
    // complete đến trước register: job vẫn chốt đúng khi đủ số kỳ vọng.
    await publish(MEDIA_COMMANDS.notificationUsageCompleteJob, {
      job_id: jobId,
      expected_usage_count: 2,
    });
    await publish(MEDIA_COMMANDS.notificationUsageStartJob, {
      job_id: jobId,
      batch_id: randomUUID(),
    });
    await publish(MEDIA_COMMANDS.notificationUsageRegisterBatch, {
      job_id: jobId,
      actor_id: instructorId,
      items: [
        { notification_id: randomUUID(), media_ids: [image] },
        { notification_id: randomUUID(), media_ids: [image] },
      ],
    });
    const done = await waitFor(async () => {
      const response = await http()
        .get(`/api/v1/media/usage-jobs/${jobId}/status`)
        .set(gatewayOnly);
      return response.status === 200 && response.body.data.status === 'COMPLETED'
        ? response.body.data
        : undefined;
    });
    expect(done).toMatchObject({ type: 'NOTIFICATION_USAGE', processed_count: 2, failed_count: 0 });
    await http()
      .get(`/api/v1/media/usage-jobs/${randomUUID()}/status`)
      .set(gatewayOnly)
      .expect(404);
  });

  it('bề mặt internal và xác thực: scope, token, danh tính', async () => {
    const docId = (
      await http()
        .post('/api/v1/media')
        .set(instructor)
        .attach('file', Buffer.from('noi dung tai lieu'), {
          filename: 'tl.txt',
          contentType: 'text/plain',
        })
        .expect(201)
    ).body.data.id as string;
    const bytes = await http()
      .get(`/internal/v1/media/${docId}/content`)
      .set({ authorization: `Bearer ${courseToken}` })
      .expect(200);
    expect(bytes.text).toBe('noi dung tai lieu');

    // Thiếu token, token gateway ở route internal, scope thiếu, giả principal đều bị chặn.
    const missing = await http().get(`/api/v1/media/${docId}/content`);
    expect(missing.status).toBe(401);
    expect(missing.body.error.code).toBe('SERVICE_TOKEN_MISSING');
    expect((await http().get(`/internal/v1/media/${docId}/content`).set(gatewayOnly)).status).toBe(
      403,
    );
    const noScope = mintServiceToken(signingKey, {
      subject: 'course',
      audience: 'media',
      scopes: ['media:usage:read'],
    });
    const forbidden = await http()
      .get(`/internal/v1/media/${docId}/content`)
      .set({ authorization: `Bearer ${noScope}` });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('SERVICE_SCOPE_FORBIDDEN');
    expect(
      (
        await http()
          .get('/api/v1/media/library')
          .set({
            authorization: `Bearer ${courseToken}`,
            'x-principal-id': instructorId,
            'x-principal-role': 'admin',
          })
      ).status,
    ).toBe(403);
    expect((await http().get('/api/v1/media/summary').set(student)).status).toBe(403);

    const summary = await http().get('/api/v1/media/summary').set(admin).expect(200);
    expect(summary.body.data.total).toBeGreaterThan(0);
    expect(summary.body.data.by_status).toHaveProperty('READY');
    expect((await http().get('/ready')).status).toBe(200);
  });
});

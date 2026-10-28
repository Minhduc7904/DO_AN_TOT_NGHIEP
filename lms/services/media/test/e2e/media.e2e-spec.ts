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

import { PrismaService } from '../../src/adapters/persistence/prisma.service.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../../src/application/ports/object-storage.js';

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

  describe('cờ extract_text → ai.document.extract', () => {
    interface OutboxRow {
      routing_key: string;
      envelope: { command_name: string; producer: { service_name: string }; payload: unknown };
    }
    const extractCommands = (mediaId: string): Promise<OutboxRow[]> =>
      api.get(PrismaService).$queryRawUnsafe<OutboxRow[]>(
        `SELECT routing_key, envelope FROM outbox_messages
            WHERE envelope->>'command_name' = 'ai.document.extract'
              AND envelope->'payload'->>'media_id' = $1`,
        mediaId,
      );
    const intentBody = (
      content: Buffer,
      fileName: string,
      mimeType: string,
      extra: Record<string, unknown> = {},
    ): Record<string, unknown> => ({
      file_name: fileName,
      mime_type: mimeType,
      size_bytes: content.length,
      checksum_sha256: createHash('sha256').update(content).digest('hex'),
      ...extra,
    });

    it('multipart có extract_text=true: lưu cờ và ghi command vào outbox cùng lúc media READY; không cờ thì không có command', async () => {
      const pdf = Buffer.from('%PDF-1.4 tài liệu cần trích xuất');
      const flagged = await http()
        .post('/api/v1/media')
        .set(instructor)
        .field('extract_text', 'true')
        .attach('file', pdf, { filename: 'giao-trinh.pdf', contentType: 'application/pdf' })
        .expect(201);
      const id = flagged.body.data.id as string;
      expect(flagged.body.data).toMatchObject({ status: 'READY', extract_text: true });

      const commands = await extractCommands(id);
      expect(commands).toHaveLength(1);
      expect(commands[0]).toMatchObject({
        routing_key: 'ai-worker--extract-ai-document-v1',
        envelope: {
          command_name: 'ai.document.extract',
          producer: { service_name: 'media' },
          payload: {
            media_id: id,
            file_name: 'giao-trinh.pdf',
            content_type: 'application/pdf',
            media_type: 'DOCUMENT',
          },
        },
      });

      for (const extra of [{}, { extract_text: 'false' }]) {
        const plain = http().post('/api/v1/media').set(instructor);
        for (const [key, value] of Object.entries(extra)) plain.field(key, value as string);
        const response = await plain
          .attach('file', pdf, { filename: 'khong-co.pdf', contentType: 'application/pdf' })
          .expect(201);
        expect(response.body.data).toMatchObject({ status: 'READY', extract_text: false });
        expect(await extractCommands(response.body.data.id as string)).toEqual([]);
      }
    });

    it('upload trực tiếp: cờ nằm ở upload-intent, command chỉ được ghi khi upload-complete làm media READY', async () => {
      const txt = Buffer.from('Ghi chú bài giảng');
      const intent = await http()
        .post('/api/v1/media/upload-intents')
        .set(instructor)
        .send(intentBody(txt, 'ghi-chu.txt', 'text/plain', { extract_text: true }))
        .expect(201);
      const id = intent.body.data.media_id as string;
      expect(
        (await api.get(PrismaService).mediaObject.findUnique({ where: { id } }))?.extractText,
      ).toBe(true);
      expect(await extractCommands(id)).toEqual([]);

      const { upload } = intent.body.data as {
        upload: { url: string; fields: Record<string, string> };
      };
      const form = new FormData();
      for (const [key, value] of Object.entries(upload.fields)) form.append(key, value);
      form.append('file', new Blob([new Uint8Array(txt)], { type: 'text/plain' }), 'ghi-chu.txt');
      expect((await fetch(upload.url, { method: 'POST', body: form })).status).toBeLessThan(300);
      const complete = await http().post(`/api/v1/media/${id}/upload-complete`).set(instructor);
      expect(complete.status).toBe(200);
      expect(complete.body.data).toMatchObject({ status: 'READY', extract_text: true });

      // Hoàn tất lặp lại không phát thêm command.
      await http().post(`/api/v1/media/${id}/upload-complete`).set(instructor);
      expect(await extractCommands(id)).toHaveLength(1);
    });

    it('checksum sai làm media FAILED thì không có command trích xuất', async () => {
      const txt = Buffer.from('Nội dung');
      const intent = await http()
        .post('/api/v1/media/upload-intents')
        .set(instructor)
        .send(
          intentBody(txt, 'sai.txt', 'text/plain', {
            extract_text: true,
            checksum_sha256: 'c'.repeat(64),
          }),
        )
        .expect(201);
      const id = intent.body.data.media_id as string;
      const { upload } = intent.body.data as {
        upload: { url: string; fields: Record<string, string> };
      };
      const form = new FormData();
      for (const [key, value] of Object.entries(upload.fields)) form.append(key, value);
      form.append('file', new Blob([new Uint8Array(txt)], { type: 'text/plain' }), 'sai.txt');
      await fetch(upload.url, { method: 'POST', body: form });

      const complete = await http().post(`/api/v1/media/${id}/upload-complete`).set(instructor);
      expect(complete.body.error.code).toBe('MEDIA_CHECKSUM_MISMATCH');
      expect(await extractCommands(id)).toEqual([]);
    });

    it('ma trận validate: chỉ tài liệu/ảnh ai hỗ trợ và <= 15 MB; giá trị không phải boolean bị từ chối', async () => {
      const intent = (body: Record<string, unknown>): request.Test =>
        http().post('/api/v1/media/upload-intents').set(instructor).send(body);
      const base = (fileName: string, mimeType: string, size = 100): Record<string, unknown> => ({
        file_name: fileName,
        mime_type: mimeType,
        size_bytes: size,
        checksum_sha256: 'd'.repeat(64),
      });

      // Loại ai không đọc được: video, âm thanh, tệp nhị phân lạ.
      for (const [name, type] of [
        ['phim.mp4', 'video/mp4'],
        ['nhac.mp3', 'audio/mpeg'],
      ] as const) {
        const response = await intent({ ...base(name, type), extract_text: true }).expect(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      }
      // > 15 MB (ảnh cho phép tới 10 MB nên dùng tài liệu 15 MB + 1 byte).
      const tooBig = await intent({
        ...base('lon.pdf', 'application/pdf', 15 * 1024 * 1024 + 1),
        extract_text: true,
      });
      expect([400, 413]).toContain(tooBig.status);
      // extract_text phải là boolean.
      for (const bad of ['true', 1, null, 'yes']) {
        await intent({ ...base('a.pdf', 'application/pdf'), extract_text: bad }).expect(400);
      }
      // Ảnh và tài liệu hỗ trợ được chấp nhận.
      for (const [name, type] of [
        ['a.pdf', 'application/pdf'],
        ['b.png', 'image/png'],
        ['c.md', 'text/markdown'],
      ] as const) {
        await intent({ ...base(name, type), extract_text: true }).expect(201);
      }
      await intent(base('phim.mp4', 'video/mp4')).expect(201);

      // Multipart: giá trị không phải 'true'/'false' và video có cờ đều bị từ chối.
      const upload = (extra: string, name = 'x.pdf', type = 'application/pdf'): request.Test =>
        http()
          .post('/api/v1/media')
          .set(instructor)
          .field('extract_text', extra)
          .attach('file', Buffer.from('%PDF-1.4'), { filename: name, contentType: type });
      await upload('maybe').expect(400);
      await upload('1').expect(400);
      await upload('true', 'phim.mp4', 'video/mp4').expect(400);
    });
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
  describe('cleanup (scheduler-worker → media)', () => {
    const cleanupToken = (): string =>
      mintServiceToken(signingKey, {
        subject: 'scheduler-worker',
        audience: 'media',
        scopes: ['media:cleanup'],
      });
    const runCleanup = (body: unknown = {}): request.Test =>
      http()
        .post('/internal/v1/media/cleanup')
        .set({ authorization: `Bearer ${cleanupToken()}` })
        .send(body as object);
    const HOUR = 3_600_000;

    /** Đẩy mốc thời gian của media về quá khứ để vượt thời gian lưu giữ (chỉ đúng các id truyền vào). */
    const backdate = async (ids: string[], hours: number): Promise<void> => {
      const when = new Date(Date.now() - hours * HOUR);
      await api.get(PrismaService).$executeRawUnsafe(
        `UPDATE media_objects SET created_at = $1::timestamptz, updated_at = $1::timestamptz
           WHERE id = ANY($2::uuid[])`,
        when,
        ids,
      );
    };
    const row = (id: string): Promise<Record<string, unknown> | null> =>
      api.get(PrismaService).mediaObject.findUnique({ where: { id } }) as Promise<Record<
        string,
        unknown
      > | null>;
    const objectExists = async (
      id: string,
      which: 'objectKey' | 'tmpObjectKey',
    ): Promise<boolean> => {
      const media = await row(id);
      const key = media?.[which];
      if (typeof key !== 'string') return false;
      const stat = await api
        .get<ObjectStorage>(OBJECT_STORAGE)
        .stat(media?.['bucket'] as string, key);
      return stat !== null;
    };
    const readyWithThumbnail = async (headers: Record<string, string>): Promise<string> => {
      const { mediaId } = await uploadDirect(headers, await png(), 'cleanup.png', 'image/png');
      await waitFor(async () =>
        (await getMedia(headers, mediaId))['thumbnail_status'] === 'READY' ? true : undefined,
      );
      return mediaId;
    };
    const attachThumbnail = (mediaId: string, courseId: string): request.Test =>
      http().post('/api/v1/media/usages').set(instructor).send({
        media_id: mediaId,
        owner_kind: 'COURSE',
        owner_id: courseId,
        usage_type: 'COURSE_THUMBNAIL',
      });

    it('dọn media không dùng quá hạn cùng thumbnail, giữ media còn usage, singleton và media mới', async () => {
      const unused = await readyWithThumbnail(instructor);
      const thumbnailRow = await api
        .get(PrismaService)
        .mediaObject.findFirst({ where: { sourceMediaId: unused } });
      expect(thumbnailRow).not.toBeNull();
      const used = await readyWithThumbnail(instructor);
      const recent = await readyWithThumbnail(instructor);
      const replaced = await readyWithThumbnail(instructor);
      const courseId = randomUUID();
      await attachThumbnail(used, courseId).expect(201);
      await attachThumbnail(replaced, courseId).expect(201); // used bị thay → hết usage
      // `replaced` đang là thumbnail của khóa học; `used` mất usage nên thành ứng viên sau khi quá hạn.
      const avatar = (await uploadDirect(student, await png(), 'av.png', 'image/png')).mediaId;
      await http()
        .post('/api/v1/media/usages')
        .set(student)
        .send({
          media_id: avatar,
          owner_kind: 'STUDENT',
          owner_id: studentId,
          usage_type: 'STUDENT_AVATAR',
        })
        .expect(201);
      await backdate([unused, used, replaced, avatar], 3);

      const response = await runCleanup({ retention_hours: 1 }).expect(200);
      expect(response.body.data).toMatchObject({
        retention_hours: 1,
        pending_grace_minutes: 15,
        failed: 0,
      });
      expect(response.body.data.unused_deleted).toBeGreaterThanOrEqual(2);
      expect(response.body.data.thumbnails_deleted).toBeGreaterThanOrEqual(2);
      // Tóm tắt chỉ có số lượng, không lộ bucket/object key/credential.
      expect(JSON.stringify(response.body)).not.toMatch(/bucket|key|secret|tmp\/|\.png|\.webp/iu);

      // Media không dùng và `used` (đã bị thay) bị xóa mềm; object và thumbnail biến mất.
      for (const id of [unused, used]) {
        expect((await row(id))?.['deletedAt']).not.toBeNull();
        expect(await objectExists(id, 'objectKey')).toBe(false);
        await http().get(`/api/v1/media/${id}/content`).set(gatewayOnly).expect(404);
      }
      const deletedThumb = await row(thumbnailRow?.id as string);
      expect(deletedThumb?.['deletedAt']).not.toBeNull();
      expect(
        await api
          .get(PrismaService)
          .mediaUsage.count({ where: { mediaId: thumbnailRow?.id as string } }),
      ).toBe(0);
      expect(
        await api
          .get<ObjectStorage>(OBJECT_STORAGE)
          .stat(deletedThumb?.['bucket'] as string, deletedThumb?.['objectKey'] as string),
      ).toBeNull();

      // Media còn usage (thumbnail khóa học, avatar) và media còn mới giữ nguyên, kể cả thumbnail của chúng.
      for (const id of [replaced, avatar, recent]) {
        expect((await row(id))?.['deletedAt']).toBeNull();
        expect(await objectExists(id, 'objectKey')).toBe(true);
        await http().get(`/api/v1/media/${id}/content`).set(gatewayOnly).expect(200);
      }
      const keptThumbnail = await api
        .get(PrismaService)
        .mediaObject.findFirst({ where: { sourceMediaId: replaced } });
      expect(keptThumbnail?.deletedAt).toBeNull();
      await http().get(`/api/v1/media/${replaced}/thumbnail`).set(gatewayOnly).expect(200);

      // Chạy lặp: không còn gì để dọn cho các media này, không lỗi.
      const again = await runCleanup({ retention_hours: 1 }).expect(200);
      expect(again.body.data.failed).toBe(0);
      expect((await row(replaced))?.['deletedAt']).toBeNull();
      expect((await row(unused))?.['deletedAt']).not.toBeNull();
    });

    it('thiếu object trong MinIO không phải lỗi: media vẫn được đánh dấu đã xóa', async () => {
      const id = (
        await http()
          .post('/api/v1/media')
          .set(instructor)
          .attach('file', Buffer.from('mat object'), {
            filename: 'mat.txt',
            contentType: 'text/plain',
          })
          .expect(201)
      ).body.data.id as string;
      const media = await row(id);
      await api
        .get<ObjectStorage>(OBJECT_STORAGE)
        .remove(media?.['bucket'] as string, media?.['objectKey'] as string);
      await backdate([id], 3);

      const response = await runCleanup({ retention_hours: 1 }).expect(200);

      expect(response.body.data.failed).toBe(0);
      expect((await row(id))?.['deletedAt']).not.toBeNull();
    });

    it('phục hồi upload PENDING stale: xóa object mồ côi, chuyển FAILED; upload còn hạn giữ nguyên', async () => {
      const intent = async (name: string): Promise<{ mediaId: string; content: Buffer }> => {
        const content = await png(9, 9);
        const response = await http()
          .post('/api/v1/media/upload-intents')
          .set(instructor)
          .send({
            file_name: name,
            mime_type: 'image/png',
            size_bytes: content.length,
            checksum_sha256: createHash('sha256').update(content).digest('hex'),
          })
          .expect(201);
        return { mediaId: response.body.data.media_id as string, content };
      };
      const uploadTmp = async (mediaId: string, content: Buffer): Promise<void> => {
        const media = await row(mediaId);
        await api
          .get<ObjectStorage>(OBJECT_STORAGE)
          .put(
            media?.['bucket'] as string,
            media?.['tmpObjectKey'] as string,
            content,
            'image/png',
          );
      };
      const expireUpload = (ids: string[]): Promise<number> =>
        api
          .get(PrismaService)
          .$executeRawUnsafe(
            `UPDATE media_objects SET upload_expires_at = now() - interval '2 hours' WHERE id = ANY($1::uuid[])`,
            ids,
          );

      const uploadedNotCompleted = await intent('da-upload.png');
      await uploadTmp(uploadedNotCompleted.mediaId, uploadedNotCompleted.content);
      const crashedAfterCopy = await intent('crash-sau-copy.png');
      await uploadTmp(crashedAfterCopy.mediaId, crashedAfterCopy.content);
      const crashedRow = await row(crashedAfterCopy.mediaId);
      await api
        .get<ObjectStorage>(OBJECT_STORAGE)
        .copy(
          crashedRow?.['bucket'] as string,
          crashedRow?.['tmpObjectKey'] as string,
          crashedRow?.['objectKey'] as string,
        );
      const neverUploaded = await intent('khong-upload.png');
      const fresh = await intent('con-han.png');
      await uploadTmp(fresh.mediaId, fresh.content);
      await expireUpload([
        uploadedNotCompleted.mediaId,
        crashedAfterCopy.mediaId,
        neverUploaded.mediaId,
      ]);

      const response = await runCleanup({ pending_grace_minutes: 0 }).expect(200);

      expect(response.body.data.pending_recovered).toBeGreaterThanOrEqual(3);
      expect(response.body.data.pending_orphan_objects_removed).toBeGreaterThanOrEqual(3);
      for (const { mediaId } of [uploadedNotCompleted, crashedAfterCopy, neverUploaded]) {
        expect(await row(mediaId)).toMatchObject({
          status: 'FAILED',
          tmpObjectKey: null,
          failureReason: 'UPLOAD_ABANDONED',
        });
        expect(await getMedia(instructor, mediaId)).toMatchObject({ status: 'FAILED' });
        await http().post(`/api/v1/media/${mediaId}/upload-complete`).set(instructor).expect(409);
      }
      expect(await objectExists(crashedAfterCopy.mediaId, 'objectKey')).toBe(false);
      const storage = api.get<ObjectStorage>(OBJECT_STORAGE);
      const recovered = await row(uploadedNotCompleted.mediaId);
      expect(recovered?.['tmpObjectKey']).toBeNull();
      expect(
        await storage.stat(
          recovered?.['bucket'] as string,
          `tmp/${uploadedNotCompleted.mediaId}.png`,
        ),
      ).toBeNull();

      // Upload còn hạn không bị đụng tới và vẫn hoàn tất được.
      expect(await row(fresh.mediaId)).toMatchObject({ status: 'PENDING' });
      await http()
        .post(`/api/v1/media/${fresh.mediaId}/upload-complete`)
        .set(instructor)
        .expect(200);

      // Chạy lặp không còn gì để phục hồi cho các media này.
      const again = await runCleanup({ pending_grace_minutes: 0 }).expect(200);
      expect(again.body.data.failed).toBe(0);
      expect(await row(uploadedNotCompleted.mediaId)).toMatchObject({ status: 'FAILED' });
    });

    it('ma trận xác thực và validate: 401/403/400', async () => {
      const missing = await http().post('/internal/v1/media/cleanup').send({});
      expect(missing.status).toBe(401);
      expect(missing.body.error.code).toBe('SERVICE_TOKEN_MISSING');

      // Token của gateway (scope gateway:proxy) và token course (thiếu media:cleanup) bị từ chối.
      const gateway = await http().post('/internal/v1/media/cleanup').set(gatewayOnly).send({});
      expect(gateway.status).toBe(403);
      const wrongScope = await http()
        .post('/internal/v1/media/cleanup')
        .set({ authorization: `Bearer ${courseToken}` })
        .send({});
      expect(wrongScope.status).toBe(403);
      expect(wrongScope.body.error.code).toBe('SERVICE_SCOPE_FORBIDDEN');

      // Sai audience → token không hợp lệ cho media.
      const wrongAudience = mintServiceToken(signingKey, {
        subject: 'scheduler-worker',
        audience: 'student',
        scopes: ['media:cleanup'],
      });
      const audience = await http()
        .post('/internal/v1/media/cleanup')
        .set({ authorization: `Bearer ${wrongAudience}` })
        .send({});
      expect(audience.status).toBe(401);
      expect(audience.body.error.code).toBe('SERVICE_TOKEN_INVALID');

      // Danh tính user (x-principal-*) không có hiệu lực ở route internal.
      const principal = await http()
        .post('/internal/v1/media/cleanup')
        .set({
          authorization: `Bearer ${courseToken}`,
          'x-principal-id': instructorId,
          'x-principal-role': 'admin',
        })
        .send({});
      expect(principal.status).toBe(403);

      // Không được gọi qua bề mặt public.
      expect((await http().post('/api/v1/media/cleanup').set(admin).send({})).status).toBe(404);

      const invalid = await runCleanup({ retention_hours: -1 });
      expect(invalid.status).toBe(400);
      expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
      // Dưới ngưỡng tối thiểu của media (env, mặc định 1 giờ) cũng là 400.
      expect((await runCleanup({ retention_hours: 0 })).status).toBe(400);
      expect((await runCleanup({ limit: 5_000 })).status).toBe(400);
      expect((await runCleanup({ unknown_field: 1 })).status).toBe(200);
      // Không gửi body vẫn dùng mặc định.
      const noBody = await http()
        .post('/internal/v1/media/cleanup')
        .set({ authorization: `Bearer ${cleanupToken()}` });
      expect(noBody.status).toBe(200);
      expect(noBody.body.data).toMatchObject({ retention_hours: 168, pending_grace_minutes: 15 });
    });
  });
});

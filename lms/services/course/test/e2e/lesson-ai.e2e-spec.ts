import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { generateSigningKey, toJwk } from '@aiops-lms/common/auth';
import { mintGatewayToken, mintServiceToken } from '@aiops-lms/common/auth/testing';
import { AppExceptionFilter, correlationIdMiddleware } from '@aiops-lms/common/http';
import {
  apiErrorSchema,
  apiResponseSchema,
  appliedLessonAiContentDtoSchema,
  createdLessonAiQuizDtoSchema,
  lessonAiContextDtoSchema,
  lessonAiDocumentDtoSchema,
  lessonAiJobDetailDtoSchema,
  lessonAiJobDtoSchema,
  lessonDtoSchema,
  quizDtoSchema,
} from '@aiops-lms/contracts';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { z } from 'zod';

interface AiCall {
  method: string;
  path: string;
  query: Record<string, string>;
  body: Record<string, unknown> | null;
  token: { aud: string; scope: string; sub: string };
}

interface StubAiState {
  status: string;
  error_code: string | null;
  error_message: string | null;
  text_length: number;
  updated_at: string | null;
}

/**
 * Chạy với PostgreSQL thật đã migrate (`COURSE_DATABASE_URL`); `auth`, `media` và `ai` là HTTP stub do
 * test dựng. `course` chỉ là facade: kiểm quyền/quan hệ, ghép tệp đính kèm của media với trạng thái do `ai` trả,
 * và phục vụ bề mặt nội bộ cho `ai-worker` (ai-context, ai-content, ai-quizzes).
 */
describe('course service: facade AI và bề mặt nội bộ cho ai-worker (PostgreSQL thật, ai/media giả)', () => {
  let app: INestApplication;
  let stub: Server;
  const signingKey = generateSigningKey();
  const gatewayToken = mintGatewayToken(signingKey, 'course');
  const asRole = (role: string, id: string): Record<string, string> => ({
    authorization: `Bearer ${gatewayToken}`,
    'x-principal-id': id,
    'x-principal-role': role,
  });
  const instructorId = randomUUID();
  const instructor = asRole('instructor', instructorId);
  const otherInstructor = asRole('instructor', randomUUID());
  const student = asRole('student', randomUUID());
  const admin = asRole('admin', randomUUID());
  const unique = `${Date.now()}`;

  // ---- Trạng thái stub ------------------------------------------------------------------------
  const attachmentsByLesson = new Map<
    string,
    {
      usage_id: string;
      media_id: string;
      position: number;
      original_name: string;
      mime_type: string;
      media_type: string;
      size_bytes: number;
    }[]
  >();
  const aiStates = new Map<string, StubAiState>();
  const aiCalls: AiCall[] = [];
  const mediaTokens: { aud: string; scope: string }[] = [];
  let aiJobs: Record<string, unknown>[] = [];
  /** Lỗi ai trả cho lần gọi tạo job kế tiếp (kiểm tra chuyển tiếp mã lỗi). */
  let aiJobError: { status: number; code: string; details?: unknown } | null = null;
  let aiDown = false;

  const decodeToken = (header: string | undefined): { aud: string; scope: string; sub: string } => {
    const payload = (header ?? '').replace('Bearer ', '').split('.')[1] ?? '';
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      aud: string;
      scope: string;
      sub: string;
    };
  };
  const meta = (): unknown => ({
    trace_id: 'stub',
    timestamp: new Date().toISOString(),
    pagination: null,
  });
  const sendJson = (res: ServerResponse, status: number, body: unknown): void => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  const envelope = (data: unknown): unknown => ({ success: true, data, error: null, meta: meta() });
  const failure = (code: string, details: unknown = null): unknown => ({
    success: false,
    data: null,
    error: { code, message: code, details },
    meta: meta(),
  });
  const readBody = (req: IncomingMessage): Promise<string> =>
    new Promise((resolve) => {
      let raw = '';
      req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
      req.on('end', () => resolve(raw));
    });

  beforeAll(async () => {
    if (!process.env.COURSE_DATABASE_URL) {
      throw new Error('COURSE_DATABASE_URL là bắt buộc cho e2e của course');
    }
    process.env.OTEL_SDK_DISABLED = 'true';
    stub = createServer((req, res) => {
      void (async (): Promise<void> => {
        const url = new URL(req.url ?? '/', 'http://stub');
        if (url.pathname === '/.well-known/jwks.json') {
          return sendJson(res, 200, { keys: [toJwk(signingKey.publicKey)] });
        }
        if (req.method === 'POST' && url.pathname === '/internal/v1/auth/service-token') {
          const { audience } = JSON.parse(await readBody(req)) as { audience: string };
          const scope =
            audience === 'ai'
              ? 'ai:document:read ai:document:write ai:job:read ai:job:write'
              : 'media:usage:read';
          const token = mintServiceToken(signingKey, {
            subject: 'course',
            audience,
            scopes: scope.split(' '),
          });
          return sendJson(
            res,
            200,
            envelope({ access_token: token, token_type: 'Bearer', expires_in: 600, scope }),
          );
        }
        if (req.method === 'GET' && url.pathname === '/internal/v1/media/usages/by-owner') {
          mediaTokens.push(decodeToken(req.headers.authorization));
          const ownerId = url.searchParams.get('owner_id') ?? '';
          if (url.searchParams.get('usage_type') !== 'LESSON_ATTACHMENT')
            return sendJson(res, 400, {});
          return sendJson(res, 200, envelope(attachmentsByLesson.get(ownerId) ?? []));
        }
        if (url.pathname.startsWith('/internal/v1/ai/')) {
          const raw = req.method === 'GET' ? '' : await readBody(req);
          const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
          aiCalls.push({
            method: req.method ?? 'GET',
            path: url.pathname,
            query: Object.fromEntries(url.searchParams),
            body,
            token: decodeToken(req.headers.authorization),
          });
          if (aiDown) return sendJson(res, 503, {});
          const state = (mediaId: string): StubAiState | null => aiStates.get(mediaId) ?? null;
          const docDto = (mediaId: string): unknown => {
            const found = state(mediaId);
            return {
              media_id: mediaId,
              status: found?.status ?? 'NOT_QUEUED',
              error_code: found?.error_code ?? null,
              error_message: found?.error_message ?? null,
              text_length: found?.text_length ?? 0,
              updated_at: found?.updated_at ?? null,
            };
          };
          const documents = (body?.documents ?? []) as { media_id: string }[];
          if (url.pathname === '/internal/v1/ai/documents/sync') {
            for (const doc of documents) {
              if (!aiStates.has(doc.media_id)) {
                aiStates.set(doc.media_id, {
                  status: 'PENDING',
                  error_code: null,
                  error_message: null,
                  text_length: 0,
                  updated_at: new Date().toISOString(),
                });
              }
            }
            return sendJson(res, 200, envelope(documents.map((doc) => docDto(doc.media_id))));
          }
          if (url.pathname === '/internal/v1/ai/documents/query') {
            return sendJson(res, 200, envelope(documents.map((doc) => docDto(doc.media_id))));
          }
          if (req.method === 'POST' && url.pathname === '/internal/v1/ai/jobs') {
            if (aiJobError) {
              const { status, code, details } = aiJobError;
              return sendJson(res, status, failure(code, details ?? null));
            }
            const now = new Date().toISOString();
            const job = {
              id: randomUUID(),
              lesson_id: body?.lesson_id,
              course_id: body?.course_id,
              job_type: body?.job_type,
              status: 'PENDING',
              media_ids: body?.media_ids,
              question_count: body?.question_count ?? null,
              overwrite_content: body?.overwrite_content,
              has_previous_content: false,
              result_quiz_id: null,
              step_count: 0,
              error_code: null,
              error_message: null,
              created_at: now,
              updated_at: now,
              started_at: null,
              finished_at: null,
            };
            aiJobs.unshift(job);
            return sendJson(res, 202, envelope(job));
          }
          if (req.method === 'GET' && url.pathname === '/internal/v1/ai/jobs') {
            return sendJson(
              res,
              200,
              envelope(aiJobs.filter((job) => job.lesson_id === url.searchParams.get('lesson_id'))),
            );
          }
          const one = /^\/internal\/v1\/ai\/jobs\/([0-9a-f-]{36})$/u.exec(url.pathname);
          if (req.method === 'GET' && one?.[1]) {
            const job = aiJobs.find((item) => item.id === one[1]);
            return job
              ? sendJson(res, 200, envelope({ job, previous_content_markdown: 'bản cũ' }))
              : sendJson(res, 404, failure('NOT_FOUND'));
          }
        }
        return sendJson(res, 404, { success: false, data: null, error: null, meta: null });
      })();
    });
    await new Promise<void>((resolve) => stub.listen(0, '127.0.0.1', resolve));
    const stubUrl = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`;
    Object.assign(process.env, {
      IDENTITY_BASE_URL: stubUrl,
      COURSE_MEDIA_BASE_URL: stubUrl,
      COURSE_AI_BASE_URL: stubUrl,
      COURSE_AI_BREAKER_COOLDOWN_MS: '50',
      SERVICE_CLIENT_ID: 'course',
      SERVICE_CLIENT_SECRET: 'course-client-secret-local-only',
      COURSE_RABBITMQ_URL: 'amqp://lms:lms-local-only@127.0.0.1:1',
      COURSE_OUTBOX_POLL_MS: '60000',
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
    stub?.closeAllConnections();
    await new Promise<void>((resolve) => (stub ? stub.close(() => resolve()) : resolve()));
  });

  beforeEach(() => {
    aiCalls.length = 0;
    mediaTokens.length = 0;
    aiJobError = null;
    aiDown = false;
    aiJobs = [];
  });

  const http = (): ReturnType<typeof request> => request(app.getHttpServer());
  const base = (courseId: string, lessonId: string): string =>
    `/api/v1/courses/${courseId}/lessons/${lessonId}`;
  const internal = (courseId: string, lessonId: string): string =>
    `/internal/v1/courses/${courseId}/lessons/${lessonId}`;
  const serviceHeader = (...scopes: string[]): Record<string, string> => ({
    authorization: `Bearer ${mintServiceToken(signingKey, {
      subject: 'ai-worker',
      audience: 'course',
      scopes,
    })}`,
  });

  async function createLesson(
    content: string | null,
  ): Promise<{ courseId: string; lessonId: string }> {
    const course = await http()
      .post('/api/v1/courses')
      .set(instructor)
      .send({ name: `Khóa AI ${unique} ${randomUUID().slice(0, 6)}` })
      .expect(201);
    const courseId = (course.body as { data: { id: string } }).data.id;
    const lesson = await http()
      .post(`/api/v1/courses/${courseId}/lessons`)
      .set(instructor)
      .send({ title: 'Bài về thuật toán', content_markdown: content })
      .expect(201);
    return { courseId, lessonId: (lesson.body as { data: { id: string } }).data.id };
  }

  function attach(lessonId: string, files: { name: string; type: string }[]): string[] {
    const items = files.map((file, position) => ({
      usage_id: randomUUID(),
      media_id: randomUUID(),
      position,
      original_name: file.name,
      mime_type: file.type,
      media_type: file.type.startsWith('video/') ? 'VIDEO' : 'DOCUMENT',
      size_bytes: 100,
    }));
    attachmentsByLesson.set(lessonId, items);
    return items.map((item) => item.media_id);
  }

  const documentsSchema = apiResponseSchema(z.array(lessonAiDocumentDtoSchema));
  const jobSchema = apiResponseSchema(lessonAiJobDtoSchema);
  const jobsSchema = apiResponseSchema(z.array(lessonAiJobDtoSchema));
  const jobDetailSchema = apiResponseSchema(lessonAiJobDetailDtoSchema);

  const createJobRequest = (
    courseId: string,
    lessonId: string,
    body: object,
    who = instructor,
  ): request.Test =>
    http()
      .post(`${base(courseId, lessonId)}/ai-jobs`)
      .set(who)
      .send(body);

  const quizBody = (
    questions: unknown[],
    title = 'Quiz AI',
  ): {
    requested_by: object;
    title: string;
    description_markdown: string;
    questions: unknown[];
  } => ({
    requested_by: { id: instructorId, role: 'instructor' },
    title,
    description_markdown: 'Quiz do AI soạn',
    questions,
  });
  const question = (text: string, correctIndex: number): object => ({
    question_markdown: text,
    question_type: 'SINGLE_CHOICE',
    points: 1,
    options: ['A', 'B', 'C'].map((label, index) => ({
      option_markdown: label,
      is_correct: index === correctIndex,
    })),
  });

  it('ai-documents: ghép tệp đính kèm của media với trạng thái do ai trả (PROCESSING hiển thị EXTRACTING), không lộ văn bản', async () => {
    const { courseId, lessonId } = await createLesson(null);
    const [txt, pdf, video, fresh] = attach(lessonId, [
      { name: 'a.txt', type: 'text/plain' },
      { name: 'b.pdf', type: 'application/pdf' },
      { name: 'c.mp4', type: 'video/mp4' },
      {
        name: 'd.docx',
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
    ]) as [string, string, string, string];
    aiStates.set(txt, {
      status: 'EXTRACTED',
      error_code: null,
      error_message: null,
      text_length: 42,
      updated_at: new Date().toISOString(),
    });
    aiStates.set(pdf, {
      status: 'PROCESSING',
      error_code: null,
      error_message: null,
      text_length: 0,
      updated_at: new Date().toISOString(),
    });

    const response = await http()
      .get(`${base(courseId, lessonId)}/ai-documents`)
      .set(instructor)
      .expect(200);
    const docs = documentsSchema.parse(response.body).data ?? [];

    expect(docs.map((doc) => [doc.media_id, doc.file_name, doc.status, doc.text_length])).toEqual([
      [txt, 'a.txt', 'EXTRACTED', 42],
      [pdf, 'b.pdf', 'EXTRACTING', 0],
      [video, 'c.mp4', 'NOT_QUEUED', 0],
      [fresh, 'd.docx', 'NOT_QUEUED', 0],
    ]);
    expect(JSON.stringify(response.body)).not.toContain('"text"');
    // `course` hỏi media bằng token audience media, hỏi ai bằng token audience ai + scope đọc.
    expect(mediaTokens[0]).toMatchObject({ aud: 'media', scope: 'media:usage:read' });
    const query = aiCalls.find((call) => call.path.endsWith('/documents/query'));
    expect(query?.token).toMatchObject({ aud: 'ai', sub: 'course' });
    expect(query?.body?.documents).toHaveLength(4);
  });

  it('ai-documents/sync: chuyển tệp và retry_failed sang ai; admin được phép; bài học không có tệp thì không gọi ai', async () => {
    const { courseId, lessonId } = await createLesson(null);
    const empty = await http()
      .post(`${base(courseId, lessonId)}/ai-documents/sync`)
      .set(instructor)
      .expect(200);
    expect(documentsSchema.parse(empty.body).data).toEqual([]);
    expect(aiCalls).toEqual([]);

    const [docId] = attach(lessonId, [{ name: 'a.txt', type: 'text/plain' }]) as [string];
    const response = await http()
      .post(`${base(courseId, lessonId)}/ai-documents/sync?retry_failed=true`)
      .set(admin)
      .expect(200);

    expect((documentsSchema.parse(response.body).data ?? [])[0]).toMatchObject({
      media_id: docId,
      status: 'PENDING',
    });
    const sync = aiCalls.find((call) => call.path.endsWith('/documents/sync'));
    expect(sync?.token.scope).toContain('ai:document:write');
    expect(sync?.body).toMatchObject({
      retry_failed: true,
      documents: [{ media_id: docId, file_name: 'a.txt', content_type: 'text/plain' }],
    });
  });

  it('ai-jobs: tạo job (202) gửi người yêu cầu tường minh; danh sách và chi tiết đi qua ai', async () => {
    const { courseId, lessonId } = await createLesson(null);
    const [docId] = attach(lessonId, [{ name: 'a.txt', type: 'text/plain' }]) as [string];

    const created = await createJobRequest(courseId, lessonId, {
      job_type: 'GENERATE_QUIZ',
      media_ids: [docId, docId],
      question_count: 4,
    }).expect(202);
    const job = jobSchema.parse(created.body).data;
    expect(job).toMatchObject({ status: 'PENDING', media_ids: [docId], question_count: 4 });

    const call = aiCalls.find((item) => item.path === '/internal/v1/ai/jobs');
    expect(call?.token.scope).toContain('ai:job:write');
    expect(call?.body).toMatchObject({
      job_type: 'GENERATE_QUIZ',
      course_id: courseId,
      lesson_id: lessonId,
      media_ids: [docId],
      overwrite_content: false,
      requested_by: { id: instructorId, role: 'instructor' },
    });

    const list = await http()
      .get(`${base(courseId, lessonId)}/ai-jobs`)
      .set(instructor)
      .expect(200);
    expect(jobsSchema.parse(list.body).data?.map((item) => item.id)).toEqual([job?.id]);
    const detail = await http()
      .get(`${base(courseId, lessonId)}/ai-jobs/${job?.id}`)
      .set(instructor)
      .expect(200);
    expect(jobDetailSchema.parse(detail.body).data).toMatchObject({
      job: { id: job?.id },
      previous_content_markdown: 'bản cũ',
    });
    await http()
      .get(`${base(courseId, lessonId)}/ai-jobs/${randomUUID()}`)
      .set(instructor)
      .expect(404);
  });

  it('tạo job: SYNTHESIZE_LESSON trên bài đã có nội dung cần overwrite_content (409) và không gọi ai', async () => {
    const { courseId, lessonId } = await createLesson('# Đã có nội dung');
    const [docId] = attach(lessonId, [{ name: 'a.txt', type: 'text/plain' }]) as [string];

    const blocked = await createJobRequest(courseId, lessonId, {
      job_type: 'SYNTHESIZE_LESSON',
      media_ids: [docId],
    }).expect(409);
    expect(apiErrorSchema.parse(blocked.body).error.code).toBe('LESSON_CONTENT_EXISTS');
    expect(aiCalls).toEqual([]);

    await createJobRequest(courseId, lessonId, {
      job_type: 'SYNTHESIZE_LESSON',
      media_ids: [docId],
      overwrite_content: true,
    }).expect(202);
  });

  it('tạo job: media_ids không thuộc bài học 422 AI_DOCUMENTS_NOT_EXTRACTED, body sai 400, lỗi nghiệp vụ của ai được chuyển nguyên mã', async () => {
    const { courseId, lessonId } = await createLesson(null);
    const [docId] = attach(lessonId, [{ name: 'a.txt', type: 'text/plain' }]) as [string];
    const stranger = randomUUID();

    const notOwned = await createJobRequest(courseId, lessonId, {
      job_type: 'GENERATE_QUIZ',
      media_ids: [stranger],
    }).expect(422);
    expect(apiErrorSchema.parse(notOwned.body).error).toMatchObject({
      code: 'AI_DOCUMENTS_NOT_EXTRACTED',
      details: { media_ids: [stranger] },
    });
    for (const bad of [
      {},
      { job_type: 'KHAC', media_ids: [docId] },
      { job_type: 'GENERATE_QUIZ', media_ids: [] },
      { job_type: 'GENERATE_QUIZ', media_ids: ['khong-phai-uuid'] },
      { job_type: 'GENERATE_QUIZ', media_ids: [docId], question_count: 31 },
    ]) {
      const response = await createJobRequest(courseId, lessonId, bad).expect(400);
      expect(apiErrorSchema.parse(response.body).error.code).toBe('VALIDATION_ERROR');
    }

    aiJobError = { status: 409, code: 'AI_JOB_ALREADY_ACTIVE' };
    const active = await createJobRequest(courseId, lessonId, {
      job_type: 'GENERATE_QUIZ',
      media_ids: [docId],
    }).expect(409);
    expect(apiErrorSchema.parse(active.body).error.code).toBe('AI_JOB_ALREADY_ACTIVE');

    aiJobError = {
      status: 422,
      code: 'AI_DOCUMENTS_NOT_EXTRACTED',
      details: { media_ids: [docId] },
    };
    const notExtracted = await createJobRequest(courseId, lessonId, {
      job_type: 'GENERATE_QUIZ',
      media_ids: [docId],
    }).expect(422);
    expect(apiErrorSchema.parse(notExtracted.body).error).toMatchObject({
      code: 'AI_DOCUMENTS_NOT_EXTRACTED',
      details: { media_ids: [docId] },
    });
  });

  it('quyền A/I*: giảng viên khác, học viên 403; thiếu bài học 404; id sai 400; thiếu token 401; ai không bị gọi', async () => {
    const { courseId, lessonId } = await createLesson(null);
    const [docId] = attach(lessonId, [{ name: 'a.txt', type: 'text/plain' }]) as [string];

    for (const who of [otherInstructor, student]) {
      await createJobRequest(
        courseId,
        lessonId,
        { job_type: 'GENERATE_QUIZ', media_ids: [docId] },
        who,
      ).expect(403);
      await http()
        .get(`${base(courseId, lessonId)}/ai-documents`)
        .set(who)
        .expect(403);
      await http()
        .post(`${base(courseId, lessonId)}/ai-documents/sync`)
        .set(who)
        .expect(403);
      await http()
        .get(`${base(courseId, lessonId)}/ai-jobs`)
        .set(who)
        .expect(403);
      await http()
        .get(`${base(courseId, lessonId)}/ai-jobs/${randomUUID()}`)
        .set(who)
        .expect(403);
    }
    await http()
      .get(`${base(courseId, randomUUID())}/ai-documents`)
      .set(instructor)
      .expect(404);
    await http()
      .get(`${base(courseId, lessonId)}/ai-jobs/khong-phai-uuid`)
      .set(instructor)
      .expect(400);
    await http()
      .get(`${base(courseId, lessonId)}/ai-documents`)
      .expect(401);
    expect(aiCalls).toEqual([]);
  });

  it('ai chết thì facade trả DEPENDENCY_UNAVAILABLE/5xx mã rõ ràng, không 200 giả', async () => {
    const { courseId, lessonId } = await createLesson(null);
    attach(lessonId, [{ name: 'a.txt', type: 'text/plain' }]);
    aiDown = true;

    const response = await http()
      .get(`${base(courseId, lessonId)}/ai-documents`)
      .set(instructor);

    expect(response.status).toBeGreaterThanOrEqual(502);
    expect(apiErrorSchema.parse(response.body).error.code).toMatch(/^DEPENDENCY_/u);
  });

  describe('bề mặt nội bộ cho ai-worker', () => {
    it('ai-context: trả tiêu đề và nội dung hiện có; 401 không token, 403 sai scope, 404 sai khóa học', async () => {
      const { courseId, lessonId } = await createLesson('# Nội dung cũ');

      const ok = await http()
        .get(`${internal(courseId, lessonId)}/ai-context`)
        .set(serviceHeader('course:lesson-ai:read'))
        .expect(200);
      expect(apiResponseSchema(lessonAiContextDtoSchema).parse(ok.body).data).toEqual({
        course_id: courseId,
        lesson_id: lessonId,
        title: 'Bài về thuật toán',
        content_markdown: '# Nội dung cũ',
      });
      await http()
        .get(`${internal(courseId, lessonId)}/ai-context`)
        .expect(401);
      await http()
        .get(`${internal(courseId, lessonId)}/ai-context`)
        .set(serviceHeader('course:lesson-ai:write'))
        .expect(403);
      await http()
        .get(`${internal(courseId, lessonId)}/ai-context`)
        .set(instructor)
        .expect(403);
      const other = await createLesson(null);
      await http()
        .get(`${internal(other.courseId, lessonId)}/ai-context`)
        .set(serviceHeader('course:lesson-ai:read'))
        .expect(404);
    });

    it('ai-content: 409 LESSON_CONTENT_EXISTS khi chưa overwrite; ghi đè trả bản cũ và cập nhật bài học; người không sở hữu 403', async () => {
      const { courseId, lessonId } = await createLesson('# Bản cũ');
      const write = (body: object, scopes = ['course:lesson-ai:write']): request.Test =>
        http()
          .put(`${internal(courseId, lessonId)}/ai-content`)
          .set(serviceHeader(...scopes))
          .send(body);
      const requestedBy = { id: instructorId, role: 'instructor' };

      const blocked = await write({
        requested_by: requestedBy,
        content_markdown: '# Bài AI',
        overwrite_content: false,
      }).expect(409);
      expect(apiErrorSchema.parse(blocked.body).error.code).toBe('LESSON_CONTENT_EXISTS');

      await write({ requested_by: requestedBy, content_markdown: 'x', overwrite_content: true }, [
        'course:lesson-ai:read',
      ]).expect(403);
      await write({
        requested_by: { id: randomUUID(), role: 'instructor' },
        content_markdown: 'x',
        overwrite_content: true,
      }).expect(403);
      await write({
        requested_by: requestedBy,
        content_markdown: '',
        overwrite_content: true,
      }).expect(400);

      const applied = await write({
        requested_by: requestedBy,
        content_markdown: '# Bài AI',
        overwrite_content: true,
      }).expect(200);
      expect(apiResponseSchema(appliedLessonAiContentDtoSchema).parse(applied.body).data).toEqual({
        previous_content_markdown: '# Bản cũ',
      });
      const lesson = await http()
        .get(`${base(courseId, lessonId)}`)
        .set(instructor)
        .expect(200);
      expect(apiResponseSchema(lessonDtoSchema).parse(lesson.body).data?.content_markdown).toBe(
        '# Bài AI',
      );
    });

    it('ai-quizzes: tạo quiz DRAFT (201); dữ liệu sai 400 để model sửa; thiếu scope 403; quiz hiện ở danh sách quiz của bài học', async () => {
      const { courseId, lessonId } = await createLesson(null);
      const post = (body: object, scopes = ['course:lesson-ai:write']): request.Test =>
        http()
          .post(`${internal(courseId, lessonId)}/ai-quizzes`)
          .set(serviceHeader(...scopes))
          .send(body);

      const bad = await post(
        quizBody([
          {
            question_markdown: 'Không có đáp án đúng?',
            question_type: 'SINGLE_CHOICE',
            points: 1,
            options: [
              { option_markdown: 'A', is_correct: false },
              { option_markdown: 'B', is_correct: false },
            ],
          },
        ]),
      ).expect(400);
      expect(apiErrorSchema.parse(bad.body).error.code).toBe('VALIDATION_ERROR');
      await post(quizBody([question('Câu hỏi?', 0)]), ['course:lesson-ai:read']).expect(403);
      await http()
        .post(`${internal(courseId, lessonId)}/ai-quizzes`)
        .send(quizBody([]))
        .expect(401);

      const created = await post(quizBody([question('Thuật toán nào nhanh nhất?', 1)])).expect(201);
      const { quiz_id: quizId } = createdLessonAiQuizDtoSchema.parse(
        (created.body as { data: unknown }).data,
      );
      const quiz = await http()
        .get(`${base(courseId, lessonId)}/quizzes/${quizId}`)
        .set(instructor)
        .expect(200);
      expect(apiResponseSchema(quizDtoSchema).parse(quiz.body).data).toMatchObject({
        id: quizId,
        title: 'Quiz AI',
        status: 'DRAFT',
      });
    });
  });
});

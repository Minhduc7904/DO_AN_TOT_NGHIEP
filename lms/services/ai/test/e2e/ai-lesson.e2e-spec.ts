import { randomBytes, randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { generateSigningKey, toJwk } from '@aiops-lms/common/auth';
import { mintGatewayToken, mintServiceToken } from '@aiops-lms/common/auth/testing';
import { AppExceptionFilter, correlationIdMiddleware } from '@aiops-lms/common/http';
import {
  buildCommandEnvelope,
  RabbitMqCommandPublisher,
  RabbitMqSession,
} from '@aiops-lms/common/messaging';
import {
  aiDocumentDtoSchema,
  aiModelDtoSchema,
  aiProviderDtoSchema,
  apiErrorSchema,
  apiResponseSchema,
  lessonAiJobDetailDtoSchema,
  lessonAiJobDtoSchema,
} from '@aiops-lms/contracts';
import { AI_COMMANDS } from '@aiops-lms/contracts/commands';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { z } from 'zod';

import { applyBodyParsers } from '../../src/adapters/http/http-defaults.js';
import { PrismaService } from '../../src/adapters/persistence/prisma.service.js';
import { zipWithDocument } from '../support/docx.js';

interface Peer {
  method: string;
  path: string;
  body: Record<string, unknown> | null;
  token: { aud: string; scope: string; sub: string };
}

type ProviderReply =
  | { kind: 'tool'; name: string; args: unknown }
  | { kind: 'text'; text: string }
  | { kind: 'http'; status: number };

/**
 * Chạy với PostgreSQL + RabbitMQ thật (`AI_DATABASE_URL`, `AI_RABBITMQ_URL`). Hai process Nest chạy trong
 * test: API (`AppModule`, outbox relay) và worker (`WorkerModule`, consumer RabbitMQ). `auth`, `course`, `media`
 * và provider LLM là HTTP stub do test dựng.
 */
describe('ai: tài liệu và job AI qua ai-worker (PostgreSQL + RabbitMQ thật; course/media/provider giả)', () => {
  const signingKey = generateSigningKey();
  const run = randomUUID().slice(0, 8);
  const rabbitUrl = process.env['AI_RABBITMQ_URL'] ?? 'amqp://lms:lms-local-only@127.0.0.1:55672';
  const gatewayToken = mintGatewayToken(signingKey, 'ai');
  const admin = {
    authorization: `Bearer ${gatewayToken}`,
    'x-principal-id': randomUUID(),
    'x-principal-role': 'admin',
  };
  const service = (...scopes: string[]): Record<string, string> => ({
    authorization: `Bearer ${mintServiceToken(signingKey, { subject: 'course', audience: 'ai', scopes })}`,
  });
  const instructorId = randomUUID();
  const requestedBy = { id: instructorId, role: 'instructor' };

  let api: INestApplication;
  let worker: INestApplication;
  let prisma: PrismaService;
  let peers: Server;
  let provider: Server;
  let session: RabbitMqSession;
  let publisher: RabbitMqCommandPublisher;

  // ---- Trạng thái stub ------------------------------------------------------------------------
  const peerCalls: Peer[] = [];
  const providerBodies: Record<string, unknown>[] = [];
  const contents = new Map<string, Buffer>();
  let providerReplies: ProviderReply[] = [];
  let providerGate: Promise<void> | null = null;
  let lessonContent: string | null = null;
  let quizStatuses: number[] = [];

  const decode = (header: string | undefined): Peer['token'] => {
    const payload = (header ?? '').replace('Bearer ', '').split('.')[1] ?? '';
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Peer['token'];
  };
  const meta = (): unknown => ({
    trace_id: 'stub',
    timestamp: new Date().toISOString(),
    pagination: null,
  });
  const json = (res: ServerResponse, status: number, body: unknown): void => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  const ok = (data: unknown): unknown => ({ success: true, data, error: null, meta: meta() });
  const fail = (code: string, message = code): unknown => ({
    success: false,
    data: null,
    error: {
      code,
      message,
      details: [{ path: 'questions.0', message: 'Phải có đúng một đáp án' }],
    },
    meta: meta(),
  });
  const readBody = (req: IncomingMessage): Promise<string> =>
    new Promise((resolve) => {
      let raw = '';
      req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
      req.on('end', () => resolve(raw));
    });
  const listen = async (server: Server): Promise<string> => {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  };

  beforeAll(async () => {
    if (!process.env['AI_DATABASE_URL']) {
      throw new Error('AI_DATABASE_URL là bắt buộc cho e2e của ai');
    }
    peers = createServer((req, res) => {
      void (async (): Promise<void> => {
        const url = new URL(req.url ?? '/', 'http://stub');
        if (url.pathname === '/.well-known/jwks.json') {
          return json(res, 200, { keys: [toJwk(signingKey.publicKey)] });
        }
        if (req.method === 'POST' && url.pathname === '/internal/v1/auth/service-token') {
          const { audience } = JSON.parse(await readBody(req)) as { audience: string };
          const scope =
            audience === 'media'
              ? 'media:content:read'
              : 'course:lesson-ai:read course:lesson-ai:write';
          const token = mintServiceToken(signingKey, {
            subject: 'ai-worker',
            audience,
            scopes: scope.split(' '),
          });
          return json(
            res,
            200,
            ok({ access_token: token, token_type: 'Bearer', expires_in: 600, scope }),
          );
        }
        const raw = req.method === 'GET' ? '' : await readBody(req);
        const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
        peerCalls.push({
          method: req.method ?? 'GET',
          path: url.pathname,
          body,
          token: decode(req.headers.authorization),
        });
        const content = /^\/internal\/v1\/media\/([0-9a-f-]{36})\/content$/u.exec(url.pathname);
        if (content?.[1]) {
          const bytes = contents.get(content[1]);
          if (!bytes) return json(res, 404, fail('NOT_FOUND', 'Không tìm thấy media'));
          res.writeHead(200, { 'content-type': 'application/octet-stream' });
          return void res.end(bytes);
        }
        const lesson =
          /^\/internal\/v1\/courses\/([0-9a-f-]{36})\/lessons\/([0-9a-f-]{36})\/(.+)$/u.exec(
            url.pathname,
          );
        if (lesson?.[1] && lesson[2]) {
          const [, courseId, lessonId, action] = lesson;
          if (req.method === 'GET' && action === 'ai-context') {
            return json(
              res,
              200,
              ok({
                course_id: courseId,
                lesson_id: lessonId,
                title: 'Bài về thuật toán',
                content_markdown: lessonContent,
              }),
            );
          }
          if (req.method === 'PUT' && action === 'ai-content') {
            const previous = lessonContent;
            lessonContent = String(body?.['content_markdown']);
            return json(res, 200, ok({ previous_content_markdown: previous }));
          }
          if (req.method === 'POST' && action === 'ai-quizzes') {
            const status = quizStatuses.shift() ?? 201;
            if (status === 400)
              return json(res, 400, fail('VALIDATION_ERROR', 'Dữ liệu quiz không hợp lệ'));
            return json(res, 201, ok({ quiz_id: randomUUID() }));
          }
        }
        return json(res, 404, { success: false, data: null, error: null, meta: null });
      })();
    });
    const peersUrl = await listen(peers);

    provider = createServer((req, res) => {
      void (async (): Promise<void> => {
        providerBodies.push(JSON.parse(await readBody(req)) as Record<string, unknown>);
        if (providerGate) await providerGate;
        const reply = providerReplies.shift();
        if (!reply || (reply.kind === 'http' && reply.status !== 200)) {
          res.writeHead(reply?.kind === 'http' ? reply.status : 500).end();
          return;
        }
        const message =
          reply.kind === 'tool'
            ? {
                role: 'assistant',
                content: null,
                tool_calls: [
                  {
                    id: 'call_1',
                    type: 'function',
                    function: { name: reply.name, arguments: JSON.stringify(reply.args) },
                  },
                ],
              }
            : { role: 'assistant', content: reply.kind === 'text' ? reply.text : '' };
        json(res, 200, {
          choices: [{ finish_reason: reply.kind === 'tool' ? 'tool_calls' : 'stop', message }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        });
      })();
    });
    const providerUrl = await listen(provider);

    Object.assign(process.env, {
      OTEL_SDK_DISABLED: 'true',
      IDENTITY_BASE_URL: peersUrl,
      AI_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
      AI_COMPLETION_TIMEOUT_MS: '5000',
      AI_RABBITMQ_URL: rabbitUrl,
      AI_OUTBOX_POLL_MS: '100',
      AI_WORKER_RETRY_DELAY_MS: '100',
      AI_WORKER_MAX_ATTEMPTS: '2',
      AI_WORKER_LEASE_MS: '60000',
      AI_COURSE_BASE_URL: peersUrl,
      AI_MEDIA_BASE_URL: peersUrl,
      SERVICE_CLIENT_ID: 'ai-worker',
      SERVICE_CLIENT_SECRET: 'ai-worker-client-secret-local-only',
    });
    const { AppModule } = await import('../../src/app.module.js');
    const { WorkerModule } = await import('../../src/worker.module.js');
    const apiModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    api = apiModule.createNestApplication<NestExpressApplication>({ bodyParser: false });
    applyBodyParsers(api as NestExpressApplication);
    api.use(correlationIdMiddleware);
    api.useGlobalFilters(new AppExceptionFilter());
    await api.init();
    prisma = apiModule.get(PrismaService);
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE ai_jobs, ai_documents, ai_invocations, ai_service_bindings, ai_models, ai_providers, outbox_messages, inbox_states CASCADE',
    );
    worker = (
      await Test.createTestingModule({ imports: [WorkerModule] }).compile()
    ).createNestApplication();
    await worker.init();

    session = new RabbitMqSession({ url: rabbitUrl, connectTimeoutMs: 5_000 });
    publisher = new RabbitMqCommandPublisher(session, {
      confirmTimeoutMs: 5_000,
      dependencyIdentity: 'ai-rabbitmq',
    });

    // Provider + model + binding cho cả ba tác vụ.
    const created = await request(api.getHttpServer())
      .post('/api/v1/ai/providers')
      .set(admin)
      .send({
        name: `Stub ${run}`,
        provider_type: 'CUSTOM',
        base_url: `${providerUrl}/v1`,
        api_key: `sk-e2e-${run}-secret-key-1234`,
      })
      .expect(201);
    const providerId = apiResponseSchema(aiProviderDtoSchema).parse(created.body).data?.id;
    const model = await request(api.getHttpServer())
      .post('/api/v1/ai/models')
      .set(admin)
      .send({ provider_id: providerId, model_name: `gpt-${run}`, display_name: 'gpt' })
      .expect(201);
    const modelId = apiResponseSchema(aiModelDtoSchema).parse(model.body).data?.id;
    for (const task of ['document-extraction', 'lesson-synthesis', 'quiz-authoring']) {
      await request(api.getHttpServer())
        .put(`/api/v1/ai/service-bindings/${task}`)
        .set(admin)
        .send({ model_id: modelId })
        .expect(201);
    }
  });

  afterAll(async () => {
    await worker?.close();
    await api?.close();
    await session?.close();
    for (const server of [peers, provider]) {
      server?.closeAllConnections();
      await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
    }
  });

  beforeEach(() => {
    peerCalls.length = 0;
    providerBodies.length = 0;
    providerReplies = [];
    providerGate = null;
    lessonContent = null;
    quizStatuses = [];
  });

  const http = (): ReturnType<typeof request> => request(api.getHttpServer());
  const documentsSchema = apiResponseSchema(z.array(aiDocumentDtoSchema));
  const jobSchema = apiResponseSchema(lessonAiJobDtoSchema);
  const detailSchema = apiResponseSchema(lessonAiJobDetailDtoSchema);

  async function eventually<T>(read: () => Promise<T>, done: (value: T) => boolean): Promise<T> {
    const deadline = Date.now() + 15_000;
    for (;;) {
      const value = await read();
      if (done(value)) return value;
      if (Date.now() > deadline) throw new Error(`Hết thời gian chờ: ${JSON.stringify(value)}`);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  interface Doc {
    mediaId: string;
    input: { media_id: string; file_name: string; content_type: string; media_type: string };
  }
  function makeDoc(name: string, type: string, bytes: Buffer | null): Doc {
    const mediaId = randomUUID();
    if (bytes) contents.set(mediaId, bytes);
    return {
      mediaId,
      input: {
        media_id: mediaId,
        file_name: name,
        content_type: type,
        media_type: type.startsWith('image/')
          ? 'IMAGE'
          : type.startsWith('video/')
            ? 'VIDEO'
            : 'DOCUMENT',
      },
    };
  }
  const syncDocs = (docs: Doc[], retryFailed = false): request.Test =>
    http()
      .post('/internal/v1/ai/documents/sync')
      .set(service('ai:document:write'))
      .send({ documents: docs.map((doc) => doc.input), retry_failed: retryFailed });
  const queryDocs = async (docs: Doc[]): Promise<z.infer<typeof aiDocumentDtoSchema>[]> => {
    const response = await http()
      .post('/internal/v1/ai/documents/query')
      .set(service('ai:document:read'))
      .send({ documents: docs.map((doc) => doc.input) })
      .expect(200);
    return documentsSchema.parse(response.body).data ?? [];
  };
  const untilSettled = (docs: Doc[]): Promise<z.infer<typeof aiDocumentDtoSchema>[]> =>
    eventually(
      () => queryDocs(docs),
      (items) =>
        items.every((item) => ['EXTRACTED', 'FAILED', 'UNSUPPORTED'].includes(item.status)),
    );

  async function extracted(
    name = 'bai.txt',
    text = 'Quy hoạch động chia bài toán thành bài toán con.',
  ): Promise<Doc> {
    const doc = makeDoc(name, 'text/plain', Buffer.from(text));
    await syncDocs([doc]).expect(200);
    await untilSettled([doc]);
    return doc;
  }

  interface JobRequest {
    jobType?: string;
    mediaIds: string[];
    lessonId: string;
    courseId?: string;
    overwrite?: boolean;
    questionCount?: number;
  }
  const createJob = (job: JobRequest): request.Test =>
    http()
      .post('/internal/v1/ai/jobs')
      .set(service('ai:job:write'))
      .send({
        job_type: job.jobType ?? 'GENERATE_QUIZ',
        course_id: job.courseId ?? randomUUID(),
        lesson_id: job.lessonId,
        media_ids: job.mediaIds,
        ...(job.questionCount === undefined ? {} : { question_count: job.questionCount }),
        overwrite_content: job.overwrite ?? false,
        requested_by: requestedBy,
      });
  const readJob = async (
    lessonId: string,
    jobId: string,
  ): Promise<z.infer<typeof detailSchema>['data']> => {
    const response = await http()
      .get(`/internal/v1/ai/jobs/${jobId}?lesson_id=${lessonId}`)
      .set(service('ai:job:read'))
      .expect(200);
    return detailSchema.parse(response.body).data;
  };
  const untilJobDone = (lessonId: string, jobId: string): ReturnType<typeof readJob> =>
    eventually(
      () => readJob(lessonId, jobId),
      (detail) => detail?.job.status === 'COMPLETED' || detail?.job.status === 'FAILED',
    );

  const quizArgs = (correctCount: number): object => ({
    title: 'Quiz quy hoạch động',
    description_markdown: 'Do AI soạn',
    questions: [
      {
        question_markdown: 'Quy hoạch động dựa trên gì?',
        question_type: 'SINGLE_CHOICE',
        points: 1,
        options: [0, 1, 2].map((index) => ({
          option_markdown: `Đáp án ${index}`,
          is_correct: index < correctCount,
        })),
      },
    ],
  });

  // ---------------------------------------------------------------------------------------------
  it('sync → ai-worker trích xuất: TXT và DOCX đọc thẳng, PDF và ảnh qua provider, video UNSUPPORTED, media lỗi FAILED, retry_failed xếp lại', async () => {
    const docxXml = `<?xml version="1.0"?><w:document><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Giới thiệu</w:t></w:r></w:p><w:p><w:r><w:t>Đệ quy</w:t></w:r></w:p></w:body></w:document>`;
    const txt = makeDoc('ghi-chu.txt', 'text/plain', Buffer.from('Nội dung văn bản'));
    const docx = makeDoc(
      'bai.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      zipWithDocument(docxXml),
    );
    const pdf = makeDoc('slide.pdf', 'application/pdf', Buffer.from('%PDF-1.4 giả'));
    const image = makeDoc('anh.png', 'image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const video = makeDoc('phim.mp4', 'video/mp4', null);
    const missing = makeDoc('mat.txt', 'text/plain', null);
    providerReplies = [
      { kind: 'text', text: 'Văn bản trích từ PDF' },
      { kind: 'text', text: 'Văn bản trích từ ảnh' },
    ];

    const response = await syncDocs([txt, docx, pdf, image, video, missing]).expect(200);
    const immediate = documentsSchema.parse(response.body).data ?? [];
    expect(immediate.find((d) => d.media_id === video.mediaId)?.status).toBe('UNSUPPORTED');
    expect(immediate.filter((d) => d.status === 'PENDING').length).toBeGreaterThan(0);

    const settled = await untilSettled([txt, docx, pdf, image, video, missing]);
    const byId = new Map(settled.map((item) => [item.media_id, item]));
    expect(byId.get(txt.mediaId)).toMatchObject({
      status: 'EXTRACTED',
      text_length: 'Nội dung văn bản'.length,
    });
    expect(byId.get(docx.mediaId)?.status).toBe('EXTRACTED');
    expect(byId.get(pdf.mediaId)?.status).toBe('EXTRACTED');
    expect((byId.get(pdf.mediaId)?.text_length ?? 0) > 0).toBe(true);
    expect(byId.get(image.mediaId)?.status).toBe('EXTRACTED');
    expect(byId.get(video.mediaId)).toMatchObject({ status: 'UNSUPPORTED' });
    expect(byId.get(missing.mediaId)).toMatchObject({ status: 'FAILED', error_code: 'NOT_FOUND' });
    // API không bao giờ trả văn bản; DB giữ văn bản; DOCX thành Markdown.
    expect(JSON.stringify(settled)).not.toContain('Nội dung văn bản');
    const docxRow = await prisma.aiDocument.findUniqueOrThrow({ where: { mediaId: docx.mediaId } });
    expect(docxRow.extractedText).toBe('# Giới thiệu\n\nĐệ quy');
    // Chỉ PDF và ảnh gọi provider (2 lần), đi kèm tệp base64.
    expect(providerBodies).toHaveLength(2);
    const sent = JSON.stringify(providerBodies);
    expect(sent).toContain('data:application/pdf;base64');
    expect(sent).toContain('data:image/png;base64');
    // ai-worker gọi media bằng service token audience media + scope media:content:read.
    const mediaCalls = peerCalls.filter((call) => call.path.includes('/media/'));
    expect(mediaCalls.length).toBeGreaterThanOrEqual(5);
    expect(
      mediaCalls.every(
        (call) => call.token.aud === 'media' && call.token.scope.includes('media:content:read'),
      ),
    ).toBe(true);

    // Sync lại không xếp thêm việc cho tài liệu đã xong; retry_failed đặt lại tài liệu FAILED.
    contents.set(missing.mediaId, Buffer.from('Đã có nội dung'));
    await syncDocs([txt, missing], false).expect(200);
    expect((await queryDocs([missing]))[0]?.status).toBe('FAILED');
    await syncDocs([txt, missing], true).expect(200);
    const retried = await untilSettled([missing]);
    expect(retried[0]).toMatchObject({ status: 'EXTRACTED', error_code: null });
  });

  it('job SYNTHESIZE_LESSON trên bài trống: ghi bài vào course; chỉ một job hoạt động trên mỗi bài học', async () => {
    const doc = await extracted();
    const lessonId = randomUUID();
    const courseId = randomUUID();
    let release = (): void => undefined;
    providerGate = new Promise<void>((resolve) => (release = resolve));
    providerReplies = [
      { kind: 'tool', name: 'save_lesson_content', args: { markdown: '# Bài mới' } },
    ];

    const rejected = await createJob({
      jobType: 'SYNTHESIZE_LESSON',
      mediaIds: [doc.mediaId],
      lessonId,
      courseId,
    }).expect(202);
    const job = jobSchema.parse(rejected.body).data;
    expect(job).toMatchObject({ status: 'PENDING', lesson_id: lessonId, course_id: courseId });

    await eventually(
      () => Promise.resolve(providerBodies.length),
      (count) => count >= 1,
    );
    const active = await createJob({
      jobType: 'SYNTHESIZE_LESSON',
      mediaIds: [doc.mediaId],
      lessonId,
    }).expect(409);
    expect(apiErrorSchema.parse(active.body).error.code).toBe('AI_JOB_ALREADY_ACTIVE');
    release();

    const done = await untilJobDone(lessonId, job?.id as string);
    expect(done?.job).toMatchObject({
      status: 'COMPLETED',
      error_code: null,
      has_previous_content: false,
    });
    expect(done?.previous_content_markdown).toBeNull();
    expect(lessonContent).toBe('# Bài mới');
  });

  it('job SYNTHESIZE_LESSON ghi đè: lưu bản cũ; bài có nội dung mà không overwrite thì FAILED LESSON_CONTENT_EXISTS', async () => {
    const doc = await extracted();
    const lessonId = randomUUID();
    lessonContent = '# Bản cũ';
    providerReplies = [
      { kind: 'tool', name: 'save_lesson_content', args: { markdown: '# Bài mới' } },
    ];

    const blocked = await createJob({
      jobType: 'SYNTHESIZE_LESSON',
      mediaIds: [doc.mediaId],
      lessonId,
    }).expect(202);
    const blockedDone = await untilJobDone(
      lessonId,
      jobSchema.parse(blocked.body).data?.id as string,
    );
    expect(blockedDone?.job).toMatchObject({
      status: 'FAILED',
      error_code: 'LESSON_CONTENT_EXISTS',
    });
    expect(lessonContent).toBe('# Bản cũ');

    providerReplies = [
      { kind: 'tool', name: 'save_lesson_content', args: { markdown: '# Bài mới' } },
    ];
    const created = await createJob({
      jobType: 'SYNTHESIZE_LESSON',
      mediaIds: [doc.mediaId],
      lessonId,
      overwrite: true,
    }).expect(202);
    const done = await untilJobDone(lessonId, jobSchema.parse(created.body).data?.id as string);
    expect(done?.job).toMatchObject({ status: 'COMPLETED', has_previous_content: true });
    expect(done?.previous_content_markdown).toBe('# Bản cũ');
    expect(lessonContent).toBe('# Bài mới');

    const write = peerCalls.filter(
      (call) => call.method === 'PUT' && call.path.endsWith('/ai-content'),
    );
    expect(write).toHaveLength(1);
    expect(write[0]?.token).toMatchObject({ aud: 'course', sub: 'ai-worker' });
    expect(write[0]?.token.scope).toContain('course:lesson-ai:write');
    expect(write[0]?.body).toMatchObject({ requested_by: requestedBy, overwrite_content: true });
  });

  it('job GENERATE_QUIZ: model sai lần đầu (course trả 400), sửa lần hai, tạo quiz; lịch sử job theo bài học', async () => {
    const doc = await extracted();
    const lessonId = randomUUID();
    quizStatuses = [400, 201];
    providerReplies = [
      { kind: 'tool', name: 'create_quiz', args: quizArgs(0) },
      { kind: 'tool', name: 'create_quiz', args: quizArgs(1) },
    ];

    const created = await createJob({ mediaIds: [doc.mediaId], lessonId, questionCount: 1 }).expect(
      202,
    );
    const jobId = jobSchema.parse(created.body).data?.id as string;
    const done = await untilJobDone(lessonId, jobId);

    expect(done?.job).toMatchObject({ status: 'COMPLETED', step_count: 2 });
    expect(done?.job.result_quiz_id).toMatch(/^[0-9a-f-]{36}$/u);
    // Lý do course từ chối được đưa lại cho model ở lượt hai.
    expect(JSON.stringify(providerBodies[1])).toContain('Dữ liệu quiz không hợp lệ');
    const quizCalls = peerCalls.filter((call) => call.path.endsWith('/ai-quizzes'));
    expect(quizCalls).toHaveLength(2);
    expect(quizCalls[0]?.body).toMatchObject({ requested_by: requestedBy });

    const list = await http()
      .get(`/internal/v1/ai/jobs?lesson_id=${lessonId}`)
      .set(service('ai:job:read'))
      .expect(200);
    expect(
      apiResponseSchema(z.array(lessonAiJobDtoSchema))
        .parse(list.body)
        .data?.map((item) => item.id),
    ).toEqual([jobId]);
    const otherLesson = await http()
      .get(`/internal/v1/ai/jobs/${jobId}?lesson_id=${randomUUID()}`)
      .set(service('ai:job:read'))
      .expect(404);
    expect(apiErrorSchema.parse(otherLesson.body).error.code).toBe('NOT_FOUND');
  });

  it('job thất bại có mã rõ ràng: model không gọi tool (AI_NO_RESULT), provider lỗi, quá 6 lượt (AI_TOO_MANY_STEPS); không ghi dữ liệu', async () => {
    const doc = await extracted();
    const lessonId = randomUUID();

    providerReplies = [{ kind: 'text', text: 'Tôi không biết' }];
    const first = await createJob({ mediaIds: [doc.mediaId], lessonId }).expect(202);
    const noResult = await untilJobDone(lessonId, jobSchema.parse(first.body).data?.id as string);
    expect(noResult?.job).toMatchObject({
      status: 'FAILED',
      error_code: 'AI_NO_RESULT',
      result_quiz_id: null,
    });

    providerReplies = [{ kind: 'http', status: 500 }];
    const second = await createJob({ mediaIds: [doc.mediaId], lessonId }).expect(202);
    const providerDown = await untilJobDone(
      lessonId,
      jobSchema.parse(second.body).data?.id as string,
    );
    expect(providerDown?.job.status).toBe('FAILED');
    expect(providerDown?.job.error_code).toBeTruthy();

    quizStatuses = [400, 400, 400, 400, 400, 400];
    providerReplies = Array.from({ length: 6 }, () => ({
      kind: 'tool' as const,
      name: 'create_quiz',
      args: quizArgs(0),
    }));
    const third = await createJob({ mediaIds: [doc.mediaId], lessonId }).expect(202);
    const tooMany = await untilJobDone(lessonId, jobSchema.parse(third.body).data?.id as string);
    expect(tooMany?.job).toMatchObject({
      status: 'FAILED',
      error_code: 'AI_TOO_MANY_STEPS',
      step_count: 6,
    });
    expect(lessonContent).toBeNull();
  });

  it('job: tài liệu chưa EXTRACTED 422 AI_DOCUMENTS_NOT_EXTRACTED; body sai 400; job treo quá lease thành WORKER_INTERRUPTED, không chạy lại', async () => {
    const pending = makeDoc('cho.txt', 'text/plain', Buffer.from('x'));
    await prisma.aiDocument.create({
      data: {
        id: randomUUID(),
        mediaId: pending.mediaId,
        fileName: 'cho.txt',
        contentType: 'text/plain',
        mediaType: 'DOCUMENT',
        status: 'FAILED',
        errorCode: 'EXTRACTION_FAILED',
      },
    });
    const unknown = randomUUID();
    const lessonId = randomUUID();

    const response = await createJob({ mediaIds: [pending.mediaId, unknown], lessonId }).expect(
      422,
    );
    expect(apiErrorSchema.parse(response.body).error).toMatchObject({
      code: 'AI_DOCUMENTS_NOT_EXTRACTED',
      details: { media_ids: expect.arrayContaining([pending.mediaId, unknown]) as string[] },
    });
    for (const bad of [{}, { job_type: 'GENERATE_QUIZ', media_ids: [] }, { job_type: 'KHAC' }]) {
      await http().post('/internal/v1/ai/jobs').set(service('ai:job:write')).send(bad).expect(400);
    }

    const doc = await extracted();
    const stuckLesson = randomUUID();
    const stuck = await prisma.aiJob.create({
      data: {
        id: randomUUID(),
        jobType: 'GENERATE_QUIZ',
        courseId: randomUUID(),
        lessonId: stuckLesson,
        mediaIds: [doc.mediaId],
        requestedById: instructorId,
        requestedByRole: 'instructor',
        status: 'RUNNING',
        leaseExpiresAt: new Date(Date.now() - 60_000),
        startedAt: new Date(Date.now() - 120_000),
      },
    });
    await publisher.publish(
      AI_COMMANDS.jobRun.queue,
      buildCommandEnvelope({
        commandName: AI_COMMANDS.jobRun.name,
        schemaVersion: AI_COMMANDS.jobRun.version,
        payload: { job_id: stuck.id },
        producer: { serviceName: 'ai', serviceVersion: 'e2e' },
      }),
    );
    const interrupted = await untilJobDone(stuckLesson, stuck.id);
    expect(interrupted?.job).toMatchObject({ status: 'FAILED', error_code: 'WORKER_INTERRUPTED' });
    expect(providerBodies).toHaveLength(0);
  });

  it('ai.document.extract do media phát qua RabbitMQ: tài liệu được trích xuất; giao lại cùng message_id không làm việc thêm', async () => {
    const mediaId = randomUUID();
    contents.set(mediaId, Buffer.from('Tài liệu tải lên có cờ extract_text'));
    const envelope = buildCommandEnvelope({
      commandName: AI_COMMANDS.documentExtract.name,
      schemaVersion: AI_COMMANDS.documentExtract.version,
      payload: {
        media_id: mediaId,
        file_name: 'tai-len.txt',
        content_type: 'text/plain',
        media_type: 'DOCUMENT',
      },
      producer: { serviceName: 'media', serviceVersion: 'e2e' },
    });

    await publisher.publish(AI_COMMANDS.documentExtract.queue, envelope);
    const ready = await eventually(
      () => prisma.aiDocument.findUnique({ where: { mediaId } }),
      (row) => row?.status === 'EXTRACTED',
    );
    expect(ready).toMatchObject({
      fileName: 'tai-len.txt',
      extractedText: 'Tài liệu tải lên có cờ extract_text',
      attemptCount: 1,
    });
    const fetched = peerCalls.filter((call) => call.path.includes(mediaId));

    await publisher.publish(AI_COMMANDS.documentExtract.queue, envelope);
    await publisher.publish(
      AI_COMMANDS.documentExtract.queue,
      buildCommandEnvelope({
        commandName: AI_COMMANDS.documentExtract.name,
        schemaVersion: AI_COMMANDS.documentExtract.version,
        payload: {
          media_id: mediaId,
          file_name: 'tai-len.txt',
          content_type: 'text/plain',
          media_type: 'DOCUMENT',
        },
        producer: { serviceName: 'media', serviceVersion: 'e2e' },
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 800));

    const row = await prisma.aiDocument.findUniqueOrThrow({ where: { mediaId } });
    expect(row.status).toBe('EXTRACTED');
    expect(row.attemptCount).toBe(1);
    expect(peerCalls.filter((call) => call.path.includes(mediaId))).toHaveLength(fetched.length);
    // Định dạng không hỗ trợ cũng có bản ghi UNSUPPORTED thay vì kẹt.
    const videoId = randomUUID();
    await publisher.publish(
      AI_COMMANDS.documentExtract.queue,
      buildCommandEnvelope({
        commandName: AI_COMMANDS.documentExtract.name,
        schemaVersion: AI_COMMANDS.documentExtract.version,
        payload: {
          media_id: videoId,
          file_name: 'phim.mp4',
          content_type: 'video/mp4',
          media_type: 'VIDEO',
        },
        producer: { serviceName: 'media', serviceVersion: 'e2e' },
      }),
    );
    const video = await eventually(
      () => prisma.aiDocument.findUnique({ where: { mediaId: videoId } }),
      (found) => found !== null && found.status !== 'PENDING' && found.status !== 'PROCESSING',
    );
    expect(video?.status).toBe('UNSUPPORTED');
  });

  describe('ma trận xác thực của route nội bộ documents/jobs', () => {
    const lessonId = randomUUID();
    const doc = {
      media_id: randomUUID(),
      file_name: 'a.txt',
      content_type: 'text/plain',
      media_type: 'DOCUMENT',
    };
    const routes: { method: 'get' | 'post'; path: string; scope: string; body?: object }[] = [
      {
        method: 'post',
        path: '/internal/v1/ai/documents/sync',
        scope: 'ai:document:write',
        body: { documents: [doc] },
      },
      {
        method: 'post',
        path: '/internal/v1/ai/documents/query',
        scope: 'ai:document:read',
        body: { documents: [doc] },
      },
      {
        method: 'post',
        path: '/internal/v1/ai/jobs',
        scope: 'ai:job:write',
        body: {
          job_type: 'GENERATE_QUIZ',
          course_id: randomUUID(),
          lesson_id: lessonId,
          media_ids: [randomUUID()],
          requested_by: requestedBy,
        },
      },
      { method: 'get', path: `/internal/v1/ai/jobs?lesson_id=${lessonId}`, scope: 'ai:job:read' },
      {
        method: 'get',
        path: `/internal/v1/ai/jobs/${randomUUID()}?lesson_id=${lessonId}`,
        scope: 'ai:job:read',
      },
    ];
    const send = (
      route: (typeof routes)[number],
      headers: Record<string, string>,
    ): request.Test => {
      const test = http()[route.method](route.path).set(headers);
      return route.body ? test.send(route.body) : test;
    };

    it('không token: 401 SERVICE_TOKEN_MISSING', async () => {
      for (const route of routes) {
        const response = await send(route, {});
        expect([route.path, response.status, response.body.error.code]).toEqual([
          route.path,
          401,
          'SERVICE_TOKEN_MISSING',
        ]);
      }
    });

    it('sai scope (kể cả scope của route khác), token gateway hoặc sai audience: 403/401, không chạm DB', async () => {
      const before = await prisma.aiDocument.count();
      for (const route of routes) {
        const others = [
          'ai:document:read',
          'ai:document:write',
          'ai:job:read',
          'ai:job:write',
          'ai:completion',
        ].filter((scope) => scope !== route.scope);
        for (const scope of others) {
          const response = await send(route, service(scope));
          expect([route.path, scope, response.status, response.body.error.code]).toEqual([
            route.path,
            scope,
            403,
            'SERVICE_SCOPE_FORBIDDEN',
          ]);
        }
        const gateway = await send(route, { authorization: `Bearer ${gatewayToken}` });
        expect([gateway.status, gateway.body.error.code]).toEqual([403, 'SERVICE_SCOPE_FORBIDDEN']);
        const wrongAudience = mintServiceToken(signingKey, {
          subject: 'course',
          audience: 'media',
          scopes: [route.scope],
        });
        const audience = await send(route, { authorization: `Bearer ${wrongAudience}` });
        expect([audience.status, audience.body.error.code]).toEqual([401, 'SERVICE_TOKEN_INVALID']);
      }
      expect(await prisma.aiDocument.count()).toBe(before);
    });

    it('đúng scope thì qua xác thực: body sai 400 VALIDATION_ERROR', async () => {
      for (const route of routes.filter((item) => item.body)) {
        const response = await http()
          [route.method](route.path)
          .set(service(route.scope))
          .send({ documents: 'x' });
        expect([route.path, response.status, response.body.error.code]).toEqual([
          route.path,
          400,
          'VALIDATION_ERROR',
        ]);
      }
      await http().get('/internal/v1/ai/jobs').set(service('ai:job:read')).expect(400);
    });
  });
});

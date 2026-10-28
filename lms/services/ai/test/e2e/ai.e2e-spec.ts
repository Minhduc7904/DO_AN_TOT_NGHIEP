import { randomBytes, randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { generateSigningKey, toJwk } from '@aiops-lms/common/auth';
import { mintGatewayToken, mintServiceToken, mintUserToken } from '@aiops-lms/common/auth/testing';
import { AppExceptionFilter, correlationIdMiddleware } from '@aiops-lms/common/http';
import {
  aiCompletionDtoSchema,
  aiModelDtoSchema,
  aiOptionsDtoSchema,
  aiProviderDtoSchema,
  aiProviderHealthDtoSchema,
  aiServiceBindingDtoSchema,
  apiErrorSchema,
  apiListResponseSchema,
  apiResponseSchema,
} from '@aiops-lms/contracts';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { z } from 'zod';

import { applyBodyParsers } from '../../src/adapters/http/http-defaults.js';
import { PrismaService } from '../../src/adapters/persistence/prisma.service.js';
import { AesGcmSecretProtector } from '../../src/adapters/security/aes-gcm-secret-protector.js';

/**
 * Chạy với PostgreSQL thật đã migrate (`AI_DATABASE_URL`); xem `pnpm test:ai:e2e`. Provider LLM và
 * `auth` (JWKS) được giả bằng HTTP stub do test dựng: `ai` gọi provider thật qua HTTP.
 */
describe('ai service (PostgreSQL thật, provider giả qua HTTP)', () => {
  const encryptionKey = randomBytes(32).toString('base64');
  const signingKey = generateSigningKey();
  const gatewayToken = mintGatewayToken(signingKey, 'ai');
  const asRole = (role: string): Record<string, string> => ({
    authorization: `Bearer ${gatewayToken}`,
    'x-principal-id': randomUUID(),
    'x-principal-role': role,
  });
  const admin = asRole('admin');
  const internal = (scopes: string[], subject = 'course'): Record<string, string> => ({
    authorization: `Bearer ${mintServiceToken(signingKey, { subject, audience: 'ai', scopes })}`,
  });
  const course = internal(['ai:completion']);

  const run = randomUUID().slice(0, 8);
  const API_KEY = `sk-e2e-${run}-secret-key-1234`;

  interface Recorded {
    method: string;
    path: string;
    headers: IncomingMessage['headers'];
    body: string;
  }
  type ProviderHandler = (req: Recorded, res: ServerResponse) => void;

  let app: INestApplication;
  let prisma: PrismaService;
  let jwksStub: Server;
  let providerStub: Server;
  let providerUrl: string;
  let providerHost: string;
  let deadUrl: string;
  const received: Recorded[] = [];
  let handler: ProviderHandler = (_req, res) => res.writeHead(500).end();

  const completionOk =
    (message: Record<string, unknown>, finishReason = 'stop'): ProviderHandler =>
    (_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          choices: [{ finish_reason: finishReason, message }],
          usage: { prompt_tokens: 21, completion_tokens: 8 },
        }),
      );
    };

  const listen = async (server: Server): Promise<string> => {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  };

  beforeAll(async () => {
    if (!process.env['AI_DATABASE_URL']) {
      throw new Error('AI_DATABASE_URL là bắt buộc cho e2e của ai');
    }
    jwksStub = createServer((req, res) => {
      res.writeHead(req.url === '/.well-known/jwks.json' ? 200 : 404, {
        'content-type': 'application/json',
      });
      res.end(JSON.stringify({ keys: [toJwk(signingKey.publicKey)] }));
    });
    const jwksUrl = await listen(jwksStub);

    providerStub = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        const recorded: Recorded = {
          method: req.method ?? 'GET',
          path: req.url ?? '/',
          headers: req.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        };
        received.push(recorded);
        handler(recorded, res);
      });
    });
    providerUrl = await listen(providerStub);
    providerHost = new URL(providerUrl).host;

    // Cổng không ai nghe để mô phỏng provider chết (connection refused).
    const dead = createServer();
    deadUrl = await listen(dead);
    await new Promise<void>((resolve) => dead.close(() => resolve()));

    Object.assign(process.env, {
      OTEL_SDK_DISABLED: 'true',
      AUTH_BASE_URL: jwksUrl,
      AI_ENCRYPTION_KEY: encryptionKey,
      AI_COMPLETION_TIMEOUT_MS: '700',
      AI_HEALTH_CHECK_TIMEOUT_MS: '700',
    });
    const { AppModule } = await import('../../src/app.module.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
    applyBodyParsers(app as NestExpressApplication);
    app.use(correlationIdMiddleware);
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    prisma = moduleRef.get(PrismaService);
    // Khóa mã hóa đổi mỗi lần chạy nên bỏ dữ liệu của lần chạy trước (DB tạm của e2e).
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE ai_invocations, ai_service_bindings, ai_models, ai_providers CASCADE',
    );
  });

  afterAll(async () => {
    await app?.close();
    for (const server of [jwksStub, providerStub]) {
      server?.closeAllConnections();
      await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
    }
  });

  const http = (): ReturnType<typeof request> => request(app.getHttpServer());

  async function createProvider(overrides: Record<string, unknown> = {}): Promise<{ id: string }> {
    const response = await http()
      .post('/api/v1/ai/providers')
      .set(admin)
      .send({
        name: `Provider ${run} ${randomUUID().slice(0, 6)}`,
        provider_type: 'CUSTOM',
        base_url: `${providerUrl}/v1`,
        api_key: API_KEY,
        ...overrides,
      })
      .expect(201);
    return apiResponseSchema(aiProviderDtoSchema).parse(response.body).data as { id: string };
  }

  async function createModel(providerId: string, modelName = 'gpt-e2e'): Promise<{ id: string }> {
    const response = await http()
      .post('/api/v1/ai/models')
      .set(admin)
      .send({ provider_id: providerId, model_name: modelName, display_name: modelName })
      .expect(201);
    return apiResponseSchema(aiModelDtoSchema).parse(response.body).data as { id: string };
  }

  async function bind(taskKey: string, modelId: string, status = 201): Promise<void> {
    await http()
      .put(`/api/v1/ai/service-bindings/${taskKey}`)
      .set(admin)
      .send({ model_id: modelId })
      .expect(status);
  }

  const complete = (body: unknown, headers = course): request.Test =>
    http()
      .post('/internal/v1/ai/completions')
      .set(headers)
      .send(body as object);

  const userMessage = { role: 'user', text: 'Tóm tắt giúp tôi' };

  /** Dựng provider + model + binding mới cho một tác vụ, trả id để tách bạch giữa các test. */
  async function setUpTask(
    taskKey: string,
    providerOverrides: Record<string, unknown> = {},
  ): Promise<{ provider: { id: string }; model: { id: string } }> {
    const provider = await createProvider(providerOverrides);
    const model = await createModel(provider.id);
    await http()
      .put(`/api/v1/ai/service-bindings/${taskKey}`)
      .set(admin)
      .send({ model_id: model.id })
      .expect((res) => expect([200, 201]).toContain(res.status));
    return { provider, model };
  }

  it('cấu hình provider → model → binding rồi completion đi qua provider giả', async () => {
    // ---- provider: chỉ trả hint, API key mã hóa trong DB ----------------------------------
    const created = await http()
      .post('/api/v1/ai/providers')
      .set(admin)
      .send({
        name: `Stub ${run}`,
        provider_type: 'CUSTOM',
        base_url: `${providerUrl}/v1`,
        api_key: API_KEY,
      })
      .expect(201);
    const provider = apiResponseSchema(aiProviderDtoSchema).parse(created.body).data as {
      id: string;
      api_key_hint: string;
    };
    expect(provider.api_key_hint).toBe('****1234');
    expect(JSON.stringify(created.body)).not.toContain(API_KEY);

    const row = await prisma.aiProvider.findUniqueOrThrow({ where: { id: provider.id } });
    expect(row.apiKeyEncrypted).not.toContain(API_KEY);
    expect(Buffer.from(row.apiKeyEncrypted, 'base64').toString('latin1')).not.toContain(
      'secret-key',
    );
    expect(row.apiKeyHint).toBe('****1234');
    expect(AesGcmSecretProtector.fromBase64(encryptionKey).decrypt(row.apiKeyEncrypted)).toBe(
      API_KEY,
    );
    const dump = JSON.stringify(
      await prisma.$queryRaw`SELECT to_jsonb(p) AS row FROM ai_providers p WHERE p.id = ${provider.id}::uuid`,
    );
    expect(dump).not.toContain(API_KEY);

    // get / list không lộ key
    const got = await http().get(`/api/v1/ai/providers/${provider.id}`).set(admin).expect(200);
    expect(JSON.stringify(got.body)).not.toContain(API_KEY);
    const listed = await http()
      .get('/api/v1/ai/providers?page=1&page_size=5')
      .set(admin)
      .expect(200);
    const parsedList = apiListResponseSchema(aiProviderDtoSchema).parse(listed.body);
    expect(parsedList.success && parsedList.meta.pagination?.page_size).toBe(5);
    expect(JSON.stringify(listed.body)).not.toContain(API_KEY);

    // ---- model + binding ------------------------------------------------------------------
    const model = await createModel(provider.id, `gpt-${run}`);
    const unbound = await complete({ task: 'lesson-synthesis', messages: [userMessage] }).expect(
      409,
    );
    expect(apiErrorSchema.parse(unbound.body).error.code).toBe('AI_TASK_NOT_CONFIGURED');

    await bind('lesson-synthesis', model.id, 201);
    await bind('lesson-synthesis', model.id, 200);
    const bindings = await http().get('/api/v1/ai/service-bindings').set(admin).expect(200);
    const parsedBindings = apiResponseSchema(z.array(aiServiceBindingDtoSchema)).parse(
      bindings.body,
    );
    expect(parsedBindings.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          task_key: 'lesson-synthesis',
          model_name: `gpt-${run}`,
          provider_type: 'CUSTOM',
        }),
      ]),
    );
    await http().get('/api/v1/ai/service-bindings/lesson-synthesis').set(admin).expect(200);
    await http().get('/api/v1/ai/service-bindings/khong-hop-le').set(admin).expect(400);
    const options = await http().get('/api/v1/ai/options').set(admin).expect(200);
    expect(apiResponseSchema(aiOptionsDtoSchema).parse(options.body).data?.task_keys).toEqual([
      'document-extraction',
      'lesson-synthesis',
      'quiz-authoring',
    ]);

    // ---- completion: văn bản ---------------------------------------------------------------
    received.length = 0;
    handler = completionOk({ role: 'assistant', content: 'Bản tóm tắt' });
    const text = await complete({
      task: 'lesson-synthesis',
      messages: [{ role: 'system', text: 'Bạn là trợ lý' }, userMessage],
    }).expect(200);
    const completion = apiResponseSchema(aiCompletionDtoSchema).parse(text.body).data;
    expect(completion).toMatchObject({
      task: 'lesson-synthesis',
      provider_type: 'CUSTOM',
      model_name: `gpt-${run}`,
      text: 'Bản tóm tắt',
      tool_calls: [],
      finish_reason: 'stop',
      prompt_tokens: 21,
      completion_tokens: 8,
    });
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ method: 'POST', path: '/v1/chat/completions' });
    expect(received[0]?.headers['authorization']).toBe(`Bearer ${API_KEY}`);
    expect(JSON.parse(received[0]?.body ?? '{}')).toMatchObject({
      model: `gpt-${run}`,
      messages: [
        { role: 'system', content: 'Bạn là trợ lý' },
        { role: 'user', content: 'Tóm tắt giúp tôi' },
      ],
    });
    expect(JSON.stringify(text.body)).not.toContain(API_KEY);

    // ---- completion: tool call + vòng tool ------------------------------------------------
    handler = completionOk(
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: { name: 'save', arguments: '{"markdown":"# Bài"}' },
          },
        ],
      },
      'tool_calls',
    );
    const tool = await complete({
      task: 'lesson-synthesis',
      messages: [
        userMessage,
        {
          role: 'assistant',
          tool_calls: [{ id: 'call_0', name: 'save', arguments_json: '{"markdown":"lỗi"}' }],
        },
        { role: 'tool', text: '{"ok":false}', tool_call_id: 'call_0' },
      ],
      tools: [
        {
          name: 'save',
          description: 'Lưu bài',
          parameters_schema: { type: 'object', properties: { markdown: { type: 'string' } } },
        },
      ],
    }).expect(200);
    expect(apiResponseSchema(aiCompletionDtoSchema).parse(tool.body).data).toMatchObject({
      text: null,
      finish_reason: 'tool_calls',
      tool_calls: [{ id: 'call_1', name: 'save', arguments_json: '{"markdown":"# Bài"}' }],
    });
    const sent = JSON.parse(received.at(-1)?.body ?? '{}') as {
      tools: unknown[];
      messages: Record<string, unknown>[];
    };
    expect(sent.tools).toEqual([
      {
        type: 'function',
        function: {
          name: 'save',
          description: 'Lưu bài',
          parameters: { type: 'object', properties: { markdown: { type: 'string' } } },
        },
      },
    ]);
    expect(sent.messages[2]).toMatchObject({ role: 'tool', tool_call_id: 'call_0' });

    // ---- nhật ký gọi: có token, không có nội dung message và không có key -----------------------
    const invocations = await prisma.aiInvocation.findMany({
      where: { taskKey: 'lesson-synthesis', modelName: `gpt-${run}` },
      orderBy: { createdAt: 'asc' },
    });
    expect(invocations.map((entry) => entry.status)).toEqual(['SUCCESS', 'SUCCESS']);
    expect(invocations[0]).toMatchObject({
      promptTokens: 21,
      completionTokens: 8,
      toolCallCount: 0,
    });
    expect(invocations[1]?.toolCallCount).toBe(1);
    expect(JSON.stringify(invocations)).not.toContain(API_KEY);
    expect(JSON.stringify(invocations)).not.toContain('Tóm tắt giúp tôi');
  });

  it('truyền ảnh/PDF lớn (base64 vài MB) qua provider', async () => {
    await setUpTask('document-extraction');
    received.length = 0;
    handler = completionOk({ role: 'assistant', content: '# Tài liệu' });
    const pdf = randomBytes(3 * 1024 * 1024).toString('base64');

    const response = await complete({
      task: 'document-extraction',
      messages: [
        {
          role: 'user',
          parts: [
            { type: 'text', text: 'Chép lại' },
            { type: 'file', media_type: 'application/pdf', data_base64: pdf, file_name: 'a.pdf' },
            { type: 'image', media_type: 'image/png', data_base64: 'AAAA' },
          ],
        },
      ],
    }).expect(200);

    expect(response.body.data.text).toBe('# Tài liệu');
    const payload = JSON.parse(received[0]?.body ?? '{}') as {
      messages: { content: Record<string, unknown>[] }[];
    };
    const [textPart, filePart, imagePart] = payload.messages[0]?.content ?? [];
    expect(textPart).toEqual({ type: 'text', text: 'Chép lại' });
    expect(filePart).toEqual({
      type: 'file',
      file: { filename: 'a.pdf', file_data: `data:application/pdf;base64,${pdf}` },
    });
    expect(imagePart).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/png;base64,AAAA' },
    });
  });

  describe('lỗi provider không lộ API key hay host', () => {
    const leakProbe = (): { restore: () => string } => {
      const written: string[] = [];
      const originalOut = process.stdout.write.bind(process.stdout);
      const originalErr = process.stderr.write.bind(process.stderr);
      const capture = (chunk: unknown): boolean => {
        written.push(String(chunk));
        return true;
      };
      process.stdout.write = capture as typeof process.stdout.write;
      process.stderr.write = capture as typeof process.stderr.write;
      return {
        restore: (): string => {
          process.stdout.write = originalOut;
          process.stderr.write = originalErr;
          return written.join('');
        },
      };
    };

    async function failing(
      task: string,
      respond: ProviderHandler | null,
      baseUrl?: string,
    ): Promise<request.Response> {
      await setUpTask(task, baseUrl ? { base_url: baseUrl } : {});
      if (respond) handler = respond;
      const probe = leakProbe();
      const response = await complete({ task, messages: [userMessage] });
      const logs = probe.restore();
      const everything = JSON.stringify(response.body) + logs;
      expect(everything).not.toContain(API_KEY);
      expect(everything).not.toContain(providerHost);
      expect(everything).not.toContain(`:${new URL(baseUrl ?? providerUrl).port}`);
      return response;
    }

    const status =
      (code: number, body: unknown): ProviderHandler =>
      (_req, res) => {
        res.writeHead(code, { 'content-type': 'application/json' });
        res.end(typeof body === 'string' ? body : JSON.stringify(body));
      };

    it('provider 401: 502 AI_PROVIDER_ERROR (AUTH_FAILED)', async () => {
      const response = await failing(
        'quiz-authoring',
        status(401, { error: { message: `bad key ${API_KEY}` } }),
      );

      expect(response.status).toBe(502);
      expect(apiErrorSchema.parse(response.body).error).toMatchObject({
        code: 'AI_PROVIDER_ERROR',
        details: { reason: 'AUTH_FAILED', upstream_status: 401 },
      });
    });

    it('provider 429: 502 AI_PROVIDER_ERROR (RATE_LIMITED)', async () => {
      const response = await failing('quiz-authoring', status(429, 'slow down'));

      expect(response.status).toBe(502);
      expect(response.body.error.details).toMatchObject({ reason: 'RATE_LIMITED' });
    });

    it('provider 400: 422 AI_PROVIDER_REJECTED_REQUEST, thông điệp provider đã che key và host', async () => {
      const response = await failing(
        'quiz-authoring',
        status(400, {
          error: {
            message: `Model does not support tools for ${API_KEY} at ${providerUrl}/v1/chat on ${providerHost}`,
          },
        }),
      );

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('AI_PROVIDER_REJECTED_REQUEST');
      expect(response.body.error.message).toContain('Model does not support tools');
    });

    it('provider 500 và phản hồi sai định dạng: 502 AI_PROVIDER_ERROR', async () => {
      const serverError = await failing(
        'quiz-authoring',
        status(500, { error: { message: providerUrl } }),
      );
      expect(serverError.status).toBe(502);
      expect(serverError.body.error.details).toMatchObject({
        reason: 'UPSTREAM_ERROR',
        upstream_status: 500,
      });

      const garbage = await failing('quiz-authoring', status(200, 'đây không phải JSON'));
      expect(garbage.status).toBe(502);
      expect(garbage.body.error.details).toMatchObject({ reason: 'INVALID_RESPONSE' });
    });

    it('provider không trả lời kịp: 504 DEPENDENCY_TIMEOUT (không phải lỗi kết nối)', async () => {
      const response = await failing('quiz-authoring', () => {
        // không bao giờ trả lời
      });

      expect(response.status).toBe(504);
      expect(response.body.error.code).toBe('DEPENDENCY_TIMEOUT');
    });

    it('không kết nối được provider: 503 DEPENDENCY_UNAVAILABLE', async () => {
      const response = await failing('quiz-authoring', null, `${deadUrl}/v1`);

      expect(response.status).toBe(503);
      expect(response.body.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    });

    it('provider redirect không được theo (key không sang host khác)', async () => {
      const response = await failing('quiz-authoring', (_req, res) => {
        res.writeHead(302, { location: 'http://127.0.0.1:9/steal' });
        res.end();
      });

      expect(response.status).toBe(502);
      expect(response.body.error.details).toMatchObject({ reason: 'INVALID_RESPONSE' });
    });

    it('mọi lần gọi lỗi đều được ghi nhật ký FAILED kèm mã lỗi, không có key', async () => {
      const failed = await prisma.aiInvocation.findMany({ where: { status: 'FAILED' } });

      expect(failed.map((entry) => entry.errorCode)).toEqual(
        expect.arrayContaining([
          'AI_PROVIDER_ERROR',
          'AI_PROVIDER_REJECTED_REQUEST',
          'DEPENDENCY_TIMEOUT',
          'DEPENDENCY_UNAVAILABLE',
        ]),
      );
      expect(JSON.stringify(failed)).not.toContain(API_KEY);
    });
  });

  it('API key lưu hỏng hoặc đổi khóa: 409 AI_PROVIDER_KEY_UNREADABLE', async () => {
    const { provider } = await setUpTask('quiz-authoring');
    await prisma.aiProvider.update({
      where: { id: provider.id },
      data: {
        apiKeyEncrypted: AesGcmSecretProtector.fromBase64(
          randomBytes(32).toString('base64'),
        ).encrypt('khác'),
      },
    });

    const response = await complete({ task: 'quiz-authoring', messages: [userMessage] }).expect(
      409,
    );

    expect(response.body.error.code).toBe('AI_PROVIDER_KEY_UNREADABLE');
  });

  it('health check: ONLINE, AUTH_FAILED, UNREACHABLE, ERROR, DISABLED; không ghi DB và không lộ key', async () => {
    const online = await createProvider();
    const authFailed = await createProvider();
    const unreachable = await createProvider({ base_url: `${deadUrl}/v1` });
    const broken = await createProvider();
    const disabled = await createProvider({ status: 'INACTIVE' });
    let calls = 0;
    handler = (_req, res) => {
      calls += 1;
      res.writeHead(200, { 'content-type': 'application/json' }).end('{"data":[]}');
    };
    const before = await prisma.aiProvider.count();

    const one = await http()
      .post(`/api/v1/ai/providers/${online.id}/health-check`)
      .set(admin)
      .expect(200);
    expect(apiResponseSchema(aiProviderHealthDtoSchema).parse(one.body).data).toMatchObject({
      health_status: 'ONLINE',
      http_status: 200,
      provider_status: 'ACTIVE',
    });
    expect(received.at(-1)).toMatchObject({ method: 'GET', path: '/v1/models' });
    expect(received.at(-1)?.headers['authorization']).toBe(`Bearer ${API_KEY}`);

    handler = (_req, res) => res.writeHead(401).end();
    const denied = await http()
      .post(`/api/v1/ai/providers/${authFailed.id}/health-check`)
      .set(admin)
      .expect(200);
    expect(denied.body.data).toMatchObject({ health_status: 'AUTH_FAILED', http_status: 401 });

    handler = (_req, res) => res.writeHead(500).end();
    const error = await http()
      .post(`/api/v1/ai/providers/${broken.id}/health-check`)
      .set(admin)
      .expect(200);
    expect(error.body.data).toMatchObject({ health_status: 'ERROR', http_status: 500 });

    const dead = await http()
      .post(`/api/v1/ai/providers/${unreachable.id}/health-check`)
      .set(admin)
      .expect(200);
    expect(dead.body.data).toMatchObject({ health_status: 'UNREACHABLE', http_status: null });

    calls = 0;
    const off = await http()
      .post(`/api/v1/ai/providers/${disabled.id}/health-check`)
      .set(admin)
      .expect(200);
    expect(off.body.data.health_status).toBe('DISABLED');
    expect(calls).toBe(0);

    handler = (_req, res) => res.writeHead(200).end('{}');
    const all = await http().post('/api/v1/ai/providers/health-checks').set(admin).expect(200);
    const results =
      apiResponseSchema(z.array(aiProviderHealthDtoSchema)).parse(all.body).data ?? [];
    expect(results.some((entry) => entry.health_status === 'DISABLED')).toBe(true);
    expect(results.some((entry) => entry.health_status === 'UNREACHABLE')).toBe(true);
    expect(JSON.stringify([one.body, denied.body, error.body, dead.body, all.body])).not.toContain(
      API_KEY,
    );
    expect(await prisma.aiProvider.count()).toBe(before);

    await http().post(`/api/v1/ai/providers/${randomUUID()}/health-check`).set(admin).expect(404);
  });

  it('quy tắc dữ liệu: trùng tên, ràng buộc xóa, validation, provider/model INACTIVE', async () => {
    const name = `Quy tắc ${run}`;
    const provider = await createProvider({ name, provider_type: 'OPENAI', base_url: null });
    expect(
      (await http().get(`/api/v1/ai/providers/${provider.id}`).set(admin)).body.data.base_url,
    ).toBe('https://api.openai.com/v1');

    const duplicate = await http()
      .post('/api/v1/ai/providers')
      .set(admin)
      .send({ name: name.toUpperCase(), provider_type: 'OPENAI', api_key: API_KEY })
      .expect(409);
    expect(duplicate.body.error.code).toBe('AI_PROVIDER_NAME_CONFLICT');

    // validation
    for (const bad of [
      { name: 'x', provider_type: 'OPENAI', api_key: API_KEY },
      { name: 'Hợp lệ', provider_type: 'KHONG_CO', api_key: API_KEY },
      { name: 'Hợp lệ', provider_type: 'CUSTOM', api_key: API_KEY },
      { name: 'Hợp lệ', provider_type: 'OPENAI', api_key: 'ngắn' },
      { name: 'Hợp lệ', provider_type: 'OPENAI', api_key: 'có khoảng trắng bên trong khóa' },
      { name: 'Hợp lệ', provider_type: 'CUSTOM', base_url: 'ftp://x', api_key: API_KEY },
      { name: 'Hợp lệ', provider_type: 'CUSTOM', base_url: 'http://u:p@x/v1', api_key: API_KEY },
    ]) {
      const response = await http().post('/api/v1/ai/providers').set(admin).send(bad).expect(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(JSON.stringify(response.body)).not.toContain(API_KEY);
    }

    // cập nhật: không gửi api_key thì giữ key; đổi key thì hint đổi
    const kept = await http()
      .put(`/api/v1/ai/providers/${provider.id}`)
      .set(admin)
      .send({ name, provider_type: 'OPENAI', base_url: null, status: 'ACTIVE' })
      .expect(200);
    expect(kept.body.data.api_key_hint).toBe('****1234');
    const rotated = await http()
      .put(`/api/v1/ai/providers/${provider.id}`)
      .set(admin)
      .send({
        name,
        provider_type: 'OPENAI',
        base_url: null,
        api_key: 'sk-moi-moi-moi-9999',
        status: 'ACTIVE',
      })
      .expect(200);
    expect(rotated.body.data.api_key_hint).toBe('****9999');
    expect(JSON.stringify(rotated.body)).not.toContain('sk-moi-moi-moi-9999');

    // model: trùng tên trong provider, provider không tồn tại
    const model = await createModel(provider.id, `m-${run}`);
    const conflict = await http()
      .post('/api/v1/ai/models')
      .set(admin)
      .send({ provider_id: provider.id, model_name: `m-${run}`, display_name: 'x' })
      .expect(409);
    expect(conflict.body.error.code).toBe('AI_MODEL_CONFLICT');
    await http()
      .post('/api/v1/ai/models')
      .set(admin)
      .send({ provider_id: randomUUID(), model_name: 'm', display_name: 'm' })
      .expect(404);
    const models = await http()
      .get(`/api/v1/ai/models?provider_id=${provider.id}`)
      .set(admin)
      .expect(200);
    expect(models.body.meta.pagination.total).toBe(1);
    await http().get(`/api/v1/ai/models/${model.id}`).set(admin).expect(200);
    await http()
      .put(`/api/v1/ai/models/${model.id}`)
      .set(admin)
      .send({ model_name: `m-${run}`, display_name: 'Đổi tên', status: 'ACTIVE' })
      .expect(200);

    // ràng buộc xóa: provider còn model, model còn binding
    await bind('document-extraction', model.id, 200);
    const providerInUse = await http()
      .delete(`/api/v1/ai/providers/${provider.id}`)
      .set(admin)
      .expect(409);
    expect(providerInUse.body.error.code).toBe('AI_PROVIDER_IN_USE');
    const modelInUse = await http().delete(`/api/v1/ai/models/${model.id}`).set(admin).expect(409);
    expect(modelInUse.body.error.code).toBe('AI_MODEL_IN_USE');

    // model INACTIVE không gán được; gỡ binding rồi xóa model, xóa provider
    await http()
      .put(`/api/v1/ai/models/${model.id}`)
      .set(admin)
      .send({ model_name: `m-${run}`, display_name: 'Đổi tên', status: 'INACTIVE' })
      .expect(200);
    const inactive = await http()
      .put('/api/v1/ai/service-bindings/quiz-authoring')
      .set(admin)
      .send({ model_id: model.id })
      .expect(409);
    expect(inactive.body.error.code).toBe('AI_REFERENCE_INACTIVE');
    await http().delete('/api/v1/ai/service-bindings/document-extraction').set(admin).expect(204);
    await http().delete('/api/v1/ai/service-bindings/document-extraction').set(admin).expect(404);
    await http().delete(`/api/v1/ai/models/${model.id}`).set(admin).expect(204);
    await http().delete(`/api/v1/ai/providers/${provider.id}`).set(admin).expect(204);
    await http().get(`/api/v1/ai/providers/${provider.id}`).set(admin).expect(404);

    // completion validation
    for (const bad of [
      { task: 'khong-ho-tro', messages: [userMessage] },
      { task: 'quiz-authoring', messages: [] },
      { task: 'quiz-authoring', messages: [{ role: 'user' }] },
      { task: 'quiz-authoring', messages: [{ role: 'tool', text: 'x' }] },
      {
        task: 'quiz-authoring',
        messages: [userMessage],
        tools: [{ name: 'tên sai!', description: 'x', parameters_schema: {} }],
      },
    ]) {
      const response = await complete(bad).expect(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  describe('ma trận xác thực', () => {
    const publicRoutes: [string, string, object?][] = [
      ['get', '/api/v1/ai/providers'],
      [
        'post',
        '/api/v1/ai/providers',
        { name: 'Trái phép', provider_type: 'OPENAI', api_key: 'sk-trai-phep-12345' },
      ],
      ['get', '/api/v1/ai/models'],
      ['get', '/api/v1/ai/service-bindings'],
      ['get', '/api/v1/ai/options'],
      ['post', '/api/v1/ai/providers/health-checks'],
    ];
    const send = (
      method: string,
      path: string,
      headers: Record<string, string>,
      body?: object,
    ): request.Test => {
      const test = (http() as unknown as Record<string, (url: string) => request.Test>)[method]?.(
        path,
      ) as request.Test;
      return test.set(headers).send(body ?? {});
    };

    it('không token: 401 SERVICE_TOKEN_MISSING ở mọi route (public và internal)', async () => {
      for (const [method, path, body] of publicRoutes) {
        const response = await send(method, path, {}, body);
        expect([response.status, response.body.error?.code]).toEqual([
          401,
          'SERVICE_TOKEN_MISSING',
        ]);
      }
      const internalResponse = await send(
        'post',
        '/internal/v1/ai/completions',
        {},
        { task: 'quiz-authoring', messages: [userMessage] },
      );
      expect([internalResponse.status, internalResponse.body.error.code]).toEqual([
        401,
        'SERVICE_TOKEN_MISSING',
      ]);
    });

    it('token sai: 401 SERVICE_TOKEN_INVALID; user token ở nơi cần service token: 401 TOKEN_TYPE_MISMATCH', async () => {
      const garbage = await send('get', '/api/v1/ai/providers', {
        authorization: 'Bearer khong.phai.jwt',
      });
      expect(garbage.body.error.code).toBe('SERVICE_TOKEN_INVALID');
      const wrongAudience = mintServiceToken(signingKey, {
        subject: 'gateway',
        audience: 'course',
        scopes: ['gateway:proxy'],
      });
      const audience = await send('get', '/api/v1/ai/providers', {
        authorization: `Bearer ${wrongAudience}`,
      });
      expect(audience.body.error.code).toBe('SERVICE_TOKEN_INVALID');

      const userToken = mintUserToken(signingKey, { subject: randomUUID(), role: 'admin' });
      for (const [method, path, body] of [
        ...publicRoutes,
        [
          'post',
          '/internal/v1/ai/completions',
          { task: 'quiz-authoring', messages: [userMessage] },
        ] as [string, string, object],
      ]) {
        const response = await send(method, path, { authorization: `Bearer ${userToken}` }, body);
        expect([response.status, response.body.error.code]).toEqual([401, 'TOKEN_TYPE_MISMATCH']);
      }
    });

    it('token sai scope: 403 SERVICE_SCOPE_FORBIDDEN ở route internal; token gateway không dùng được ở route internal', async () => {
      const body = { task: 'quiz-authoring', messages: [userMessage] };
      for (const headers of [
        internal(['media:usage:read']),
        internal([]),
        { authorization: `Bearer ${gatewayToken}` },
      ]) {
        const response = await send('post', '/internal/v1/ai/completions', headers, body);
        expect([response.status, response.body.error.code]).toEqual([
          403,
          'SERVICE_SCOPE_FORBIDDEN',
        ]);
      }
    });

    it('service token của course (scope ai:completion) không gọi được route admin: 403 SERVICE_SCOPE_FORBIDDEN', async () => {
      for (const [method, path, body] of publicRoutes) {
        const response = await send(
          method,
          path,
          { ...course, 'x-principal-id': randomUUID(), 'x-principal-role': 'admin' },
          body,
        );
        expect([response.status, response.body.error.code]).toEqual([
          403,
          'SERVICE_SCOPE_FORBIDDEN',
        ]);
      }
    });

    it('token gateway nhưng role không phải admin hoặc thiếu danh tính: 403 FORBIDDEN / 401 UNAUTHORIZED', async () => {
      for (const role of ['instructor', 'student']) {
        for (const [method, path, body] of publicRoutes) {
          const response = await send(method, path, asRole(role), body);
          expect([response.status, response.body.error.code]).toEqual([403, 'FORBIDDEN']);
        }
      }
      const noPrincipal = await send('get', '/api/v1/ai/providers', {
        authorization: `Bearer ${gatewayToken}`,
      });
      expect([noPrincipal.status, noPrincipal.body.error.code]).toEqual([401, 'UNAUTHORIZED']);
    });

    it('x-principal-* giả không kèm token gateway bị từ chối', async () => {
      const forged = await send('get', '/api/v1/ai/providers', {
        ...internal(['ai:completion']),
        'x-principal-id': randomUUID(),
        'x-principal-role': 'admin',
      });
      expect(forged.status).toBe(403);
    });

    it('/health và /ready mở, không cần token', async () => {
      await http().get('/health').expect(200);
      await http().get('/ready').expect(200);
    });
  });
});

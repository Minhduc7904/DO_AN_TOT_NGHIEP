import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { ConfigService } from '@nestjs/config';

import { MediaCleanupHandler } from '../../src/adapters/clients/media-cleanup.handler.js';

const SUMMARY = {
  retention_hours: 24,
  pending_grace_minutes: 15,
  limit: 200,
  unused_deleted: 2,
  thumbnails_deleted: 1,
  objects_removed: 3,
  pending_recovered: 1,
  pending_orphan_objects_removed: 1,
  skipped: 0,
  failed: 0,
  has_more: false,
};

const envelope = (data: unknown): unknown => ({
  success: true,
  data,
  error: null,
  meta: { trace_id: 't', timestamp: new Date().toISOString(), pagination: null },
});
const errorEnvelope = (code: string): unknown => ({
  success: false,
  data: null,
  error: { code, message: 'x', details: null },
  meta: { trace_id: 't', timestamp: new Date().toISOString(), pagination: null },
});

describe('MediaCleanupHandler', () => {
  let server: Server;
  let respond: (status: number, body: unknown) => void = () => undefined;
  let seen: {
    method?: string | undefined;
    url?: string | undefined;
    authorization?: string | undefined;
    body?: string | undefined;
  } = {};
  let handler: MediaCleanupHandler;

  beforeAll(async () => {
    server = createServer((req, res) => {
      let body = '';
      req.on('data', (chunk: Buffer) => (body += chunk.toString()));
      req.on('end', () => {
        seen = {
          method: req.method,
          url: req.url,
          authorization: req.headers.authorization,
          body,
        };
        respond = (status, payload) => {
          res.writeHead(status, { 'content-type': 'application/json' });
          res.end(JSON.stringify(payload));
        };
        next();
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    handler = new MediaCleanupHandler(
      new ConfigService({
        SCHEDULER_MEDIA_BASE_URL: baseUrl,
        SCHEDULER_MEDIA_TIMEOUT_MS: 2_000,
        SCHEDULER_MEDIA_BREAKER_THRESHOLD: 50,
        SCHEDULER_MEDIA_BREAKER_COOLDOWN_MS: 10,
      }),
      { getToken: (audience: string) => Promise.resolve(`token-for-${audience}`) },
    );
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    });
  });

  let next: () => void = () => undefined;
  const reply = (status: number, body: unknown): void => {
    next = () => respond(status, body);
  };

  it('gọi POST /internal/v1/media/cleanup với token audience media và payload của run', async () => {
    reply(200, envelope(SUMMARY));

    const result = await handler.handle({ retention_hours: 24, limit: 200 });

    expect(seen).toMatchObject({
      method: 'POST',
      url: '/internal/v1/media/cleanup',
      authorization: 'Bearer token-for-media',
    });
    expect(JSON.parse(seen.body ?? '{}')).toEqual({ retention_hours: 24, limit: 200 });
    expect(result).toEqual({ output: SUMMARY });
  });

  it('có media lỗi (failed > 0): thất bại MEDIA_CLEANUP_INCOMPLETE nhưng giữ tóm tắt', async () => {
    reply(200, envelope({ ...SUMMARY, failed: 2 }));

    const result = await handler.handle({});

    expect(result.failure?.code).toBe('MEDIA_CLEANUP_INCOMPLETE');
    expect(result.output).toMatchObject({ failed: 2, unused_deleted: 2 });
  });

  it('media từ chối (403/400): MEDIA_CLEANUP_REJECTED, thông báo không chứa dữ liệu thô', async () => {
    reply(403, errorEnvelope('SERVICE_SCOPE_FORBIDDEN'));

    const result = await handler.handle({});

    expect(result.failure).toMatchObject({ code: 'MEDIA_CLEANUP_REJECTED' });
    expect(result.failure?.message).toContain('SERVICE_SCOPE_FORBIDDEN');
  });

  it('phản hồi sai contract: ném lỗi MEDIA_CLEANUP_INVALID_RESPONSE', async () => {
    reply(200, envelope({ unused_deleted: 'nhieu' }));

    await expect(handler.handle({})).rejects.toMatchObject({
      code: 'MEDIA_CLEANUP_INVALID_RESPONSE',
    });
  });

  it('media 5xx: ném DEPENDENCY_UNAVAILABLE để use case ghi mã lỗi của run', async () => {
    reply(503, errorEnvelope('DEPENDENCY_UNAVAILABLE'));

    await expect(handler.handle({})).rejects.toMatchObject({ code: 'DEPENDENCY_UNAVAILABLE' });
  });

  it('payload không hợp lệ không được gửi đi', async () => {
    await expect(handler.handle({ retention_hours: -5 })).rejects.toThrow();
  });
});

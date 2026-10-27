import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { CircuitBreaker } from '../../src/clients/circuit-breaker.js';
import { HttpQueryClient } from '../../src/clients/http-query-client.js';
import { runWithCorrelationId } from '../../src/http/correlation.js';

describe('CircuitBreaker', () => {
  it('mở sau ngưỡng lỗi, half-open một probe sau cooldown, đóng khi probe thành công', () => {
    const breaker = new CircuitBreaker({ cooldownMs: 100, failureThreshold: 2 });

    breaker.onFailure(0);
    expect(breaker.allowRequest(1)).toBe(true);
    breaker.onFailure(2);
    expect(breaker.allowRequest(50)).toBe(false);
    expect(breaker.allowRequest(200)).toBe(true);
    expect(breaker.allowRequest(201)).toBe(false);
    breaker.onSuccess();
    expect(breaker.allowRequest(202)).toBe(true);
  });
});

describe('HttpQueryClient', () => {
  let server: Server;
  let baseUrl: string;
  let lastHeaders: Record<string, string | string[] | undefined> = {};

  beforeAll(async () => {
    server = createServer((request, response) => {
      lastHeaders = request.headers;
      if (request.url?.startsWith('/missing')) {
        response.writeHead(404).end(JSON.stringify({ code: 'NOT_FOUND' }));
      } else if (request.url?.startsWith('/slow')) {
        setTimeout(() => response.writeHead(200).end('{}'), 500);
      } else if (request.url?.startsWith('/boom')) {
        response.writeHead(500).end('{}');
      } else {
        response.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}');
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  const options = (timeoutMs = 300): ConstructorParameters<typeof HttpQueryClient>[0] => ({
    dependency: 'test-http',
    baseUrl,
    timeoutMs,
    breaker: { cooldownMs: 10_000, failureThreshold: 2 },
  });

  it('forward correlation id, principal và query; trả 4xx cho caller', async () => {
    const client = new HttpQueryClient(options());

    const ok = await runWithCorrelationId('corr-1', () =>
      client.request({
        path: '/ok',
        query: { page: 1, skip: undefined },
        principal: { id: '2f0b0a6e-5d4b-4c0b-9a54-3d1f0b8f7a11', role: 'admin' },
      }),
    );
    expect(ok).toEqual({ status: 200, body: { ok: true } });
    expect(lastHeaders['x-correlation-id']).toBe('corr-1');
    expect(lastHeaders['x-principal-role']).toBe('admin');

    await expect(client.request({ path: '/missing' })).resolves.toMatchObject({ status: 404 });
  });

  it('timeout thành DEPENDENCY_TIMEOUT', async () => {
    const client = new HttpQueryClient(options(100));

    await expect(client.request({ path: '/slow' })).rejects.toMatchObject({
      code: 'DEPENDENCY_TIMEOUT',
      status: 504,
    });
  });

  it('5xx thành DEPENDENCY_UNAVAILABLE và breaker mở sau ngưỡng', async () => {
    const client = new HttpQueryClient(options());

    await expect(client.request({ path: '/boom' })).rejects.toMatchObject({ status: 503 });
    await expect(client.request({ path: '/boom' })).rejects.toMatchObject({ status: 503 });
    lastHeaders = {};
    await expect(client.request({ path: '/ok' })).rejects.toMatchObject({ status: 503 });
    expect(lastHeaders).toEqual({});
  });
});

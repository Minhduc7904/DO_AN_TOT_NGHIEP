import { generateSigningKey, StaticKeyProvider, TokenVerifier } from '@aiops-lms/common/auth';
import { mintServiceToken, mintUserToken } from '@aiops-lms/common/auth/testing';

import { JwksUserTokenVerifier } from '../../src/adapters/security/jwks-user-token.verifier.js';
import type {
  UpstreamClient,
  UpstreamRequest,
  UpstreamResponse,
} from '../../src/application/ports/upstream-client.js';
import { ProxyRequestUseCase } from '../../src/application/use-cases/proxy-request.use-case.js';
import type { UpstreamName } from '../../src/domain/route-table.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const key = generateSigningKey();

function token(
  role: string,
  options: { expiresInSeconds?: number; key?: typeof key } = {},
): string {
  return mintUserToken(options.key ?? key, {
    subject: USER_ID,
    role,
    expiresInSeconds: options.expiresInSeconds ?? 3_600,
  });
}

class RecordingUpstream implements UpstreamClient {
  readonly calls: { upstream: UpstreamName; request: UpstreamRequest }[] = [];
  response: UpstreamResponse = { status: 200, headers: {}, body: null };

  forward(upstream: UpstreamName, request: UpstreamRequest): Promise<UpstreamResponse> {
    this.calls.push({ upstream, request });
    return Promise.resolve(this.response);
  }
}

function setup(): { upstream: RecordingUpstream; useCase: ProxyRequestUseCase } {
  const upstream = new RecordingUpstream();
  const enabled = new Set<UpstreamName>(['identity', 'course', 'scheduler', 'ai', 'media']);
  return {
    upstream,
    useCase: new ProxyRequestUseCase(
      upstream,
      enabled,
      new JwksUserTokenVerifier(new TokenVerifier(new StaticKeyProvider([key]))),
    ),
  };
}

function input(
  method: string,
  url: string,
  headers: Record<string, string | string[] | undefined> = {},
): Parameters<ProxyRequestUseCase['execute']>[0] {
  return { method, url, headers, body: null, signal: new AbortController().signal };
}

describe('ProxyRequestUseCase', () => {
  it('route công khai chuyển tiếp không cần token và không đặt danh tính', async () => {
    const { upstream, useCase } = setup();

    await useCase.execute(input('POST', '/api/v1/auth/student/login?x=1'));

    expect(upstream.calls).toHaveLength(1);
    expect(upstream.calls[0]).toMatchObject({
      upstream: 'identity',
      request: { method: 'POST', target: '/api/v1/auth/student/login?x=1' },
    });
    expect(upstream.calls[0]?.request.headers).not.toHaveProperty('x-principal-id');
  });

  it('thiếu hoặc sai token → 401 và không gọi upstream', async () => {
    const { upstream, useCase } = setup();
    const bad = [
      undefined,
      'Basic abc',
      'Bearer',
      'Bearer rác',
      `Bearer ${token('student', { key: generateSigningKey() })}`,
      `Bearer ${token('student', { expiresInSeconds: -10 })}`,
      `Bearer ${token('superuser')}`,
    ];

    for (const authorization of bad) {
      await expect(
        useCase.execute(input('GET', '/api/v1/courses', { authorization })),
      ).rejects.toMatchObject({ status: 401 });
    }
    expect(upstream.calls).toHaveLength(0);
  });

  it('service token không dùng được như user token', async () => {
    const { upstream, useCase } = setup();
    const service = mintServiceToken(key, {
      subject: 'gateway',
      audience: 'aiops-lms',
      scopes: ['gateway:proxy'],
    });

    await expect(
      useCase.execute(input('GET', '/api/v1/courses', { authorization: `Bearer ${service}` })),
    ).rejects.toMatchObject({ code: 'TOKEN_TYPE_MISMATCH', status: 401 });
    expect(upstream.calls).toHaveLength(0);
  });

  it('sai role → 403; admin vào được route chỉ dành admin', async () => {
    const { upstream, useCase } = setup();
    const as = (role: string): Record<string, string> => ({
      authorization: `Bearer ${token(role)}`,
    });

    for (const path of ['/api/v1/scheduler/jobs', '/api/v1/ai/providers']) {
      await expect(useCase.execute(input('GET', path, as('student')))).rejects.toMatchObject({
        status: 403,
      });
      await expect(useCase.execute(input('GET', path, as('instructor')))).rejects.toMatchObject({
        status: 403,
      });
      await expect(useCase.execute(input('GET', path, as('admin')))).resolves.toBeDefined();
    }
    expect(upstream.calls).toHaveLength(2);
  });

  it('xóa header danh tính và xác thực của client, đặt lại từ JWT', async () => {
    const { upstream, useCase } = setup();

    await useCase.execute(
      input('GET', '/api/v1/students/me', {
        authorization: `Bearer ${token('student')}`,
        'x-principal-id': '99999999-9999-4999-8999-999999999999',
        'x-principal-role': 'admin',
        cookie: 'session=1',
        host: 'gateway.local',
        connection: 'keep-alive',
        'accept-encoding': 'gzip',
        'x-correlation-id': 'corr-1',
        range: 'bytes=0-10',
      }),
    );

    expect(upstream.calls[0]?.request.headers).toEqual({
      'accept-encoding': 'identity',
      'x-correlation-id': 'corr-1',
      range: 'bytes=0-10',
      'x-principal-id': USER_ID,
      'x-principal-role': 'student',
    });
  });

  it('không chuyển body cho GET/HEAD; path đã chuẩn hóa chống thoát khỏi /api', async () => {
    const { upstream, useCase } = setup();
    const body = (async function* (): AsyncGenerator<Uint8Array> {
      yield new Uint8Array([1]);
    })();

    await useCase.execute({
      ...input('GET', '/api/v1/media/abc/content'),
      body,
    });
    expect(upstream.calls[0]?.request.body).toBeNull();

    await expect(
      useCase.execute(input('GET', '/api/v1/auth/%2e%2e/%2e%2e/%2e%2e/internal/v1/students')),
    ).rejects.toMatchObject({ status: 404 });
    await expect(useCase.execute(input('GET', '/internal/v1/students'))).rejects.toMatchObject({
      status: 404,
    });
    await expect(useCase.execute(input('GET', '//evil.example/api/v1/x'))).rejects.toMatchObject({
      status: 404,
    });
    expect(upstream.calls).toHaveLength(1);
  });

  it('trả nguyên phản hồi upstream, kể cả lỗi nghiệp vụ 5xx', async () => {
    const { upstream, useCase } = setup();
    upstream.response = {
      status: 502,
      headers: { 'content-type': 'application/json' },
      body: null,
    };

    await expect(useCase.execute(input('POST', '/api/v1/auth/refresh'))).resolves.toEqual(
      upstream.response,
    );
  });
});

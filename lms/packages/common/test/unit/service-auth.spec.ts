import 'reflect-metadata';

import { jest } from '@jest/globals';
import { type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { generateSigningKey, StaticKeyProvider, toJwk } from '../../src/auth/keys.js';
import { createHttpServiceAuth, type ServiceAuthSettings } from '../../src/auth/service-auth.js';
import {
  ServiceTokenProvider,
  type ServiceTokenSource,
} from '../../src/auth/service-token.provider.js';
import { mintGatewayToken, mintServiceToken, mintUserToken } from '../../src/auth/testing.js';
import { HttpJwksKeyProvider } from '../../src/auth/http-jwks-key-provider.js';
import { TokenVerifier } from '../../src/auth/token-verifier.js';
import { AppError } from '../../src/errors/index.js';
import { Anonymous, InternalApi, Roles, SkipAuth } from '../../src/http/principal.js';
import { ServiceAuthGuard } from '../../src/http/service-auth.guard.js';

const PRINCIPAL_ID = '2f0b0a6e-5d4b-4c0b-9a54-3d1f0b8f7a11';
const key = generateSigningKey();
const otherKey = generateSigningKey();

function verifierFor(...keys: ReturnType<typeof generateSigningKey>[]): TokenVerifier {
  return new TokenVerifier(new StaticKeyProvider(keys));
}

describe('TokenVerifier', () => {
  const verifier = verifierFor(key);

  it('chấp nhận service token đúng aud và đọc scope', async () => {
    const token = mintServiceToken(key, {
      subject: 'media',
      audience: 'identity',
      scopes: ['a', 'b'],
    });
    await expect(
      verifier.verify(token, { type: 'service', audience: 'identity' }),
    ).resolves.toMatchObject({
      type: 'service',
      subject: 'media',
      scopes: ['a', 'b'],
    });
  });

  it('từ chối sai aud, hết hạn, sai khóa, kid lạ và token hỏng', async () => {
    const wrongAudience = mintServiceToken(key, {
      subject: 'media',
      audience: 'course',
      scopes: [],
    });
    const expired = mintServiceToken(key, {
      subject: 'media',
      audience: 'identity',
      scopes: [],
      expiresInSeconds: 10,
      now: Date.now() - 60_000,
    });
    const foreign = mintServiceToken(otherKey, {
      subject: 'media',
      audience: 'identity',
      scopes: [],
    });
    for (const token of [wrongAudience, expired, foreign, 'abc.def.ghi', 'x']) {
      await expect(
        verifier.verify(token, { type: 'service', audience: 'identity' }),
      ).rejects.toMatchObject({
        code: 'SERVICE_TOKEN_INVALID',
        status: 401,
      });
    }
  });

  it('phân biệt loại token', async () => {
    const user = mintUserToken(key, { subject: PRINCIPAL_ID, role: 'admin' });
    const service = mintServiceToken(key, { subject: 'media', audience: 'aiops-lms', scopes: [] });
    await expect(
      verifier.verify(user, { type: 'service', audience: 'aiops-lms' }),
    ).rejects.toMatchObject({
      code: 'TOKEN_TYPE_MISMATCH',
    });
    await expect(
      verifier.verify(service, { type: 'user', audience: 'aiops-lms' }),
    ).rejects.toMatchObject({
      code: 'TOKEN_TYPE_MISMATCH',
    });
    await expect(
      verifier.verify(user, { type: 'user', audience: 'aiops-lms' }),
    ).resolves.toMatchObject({
      type: 'user',
      role: 'admin',
    });
  });
});

describe('ServiceAuthGuard', () => {
  class Controller {
    @Roles('admin')
    adminOnly(): void {}
    @Anonymous()
    login(): void {}
    @SkipAuth()
    health(): void {}
    any(): void {}
    @InternalApi({ scopes: ['student:profile:read'] })
    internal(): void {}
  }
  const settings: ServiceAuthSettings = { serviceName: 'identity', verifier: verifierFor(key) };
  const guard = new ServiceAuthGuard(new Reflector(), settings);
  const instance = new Controller();

  function contextFor(
    handler: () => void,
    headers: Record<string, string>,
  ): { context: ExecutionContext; request: { principal?: unknown } } {
    const request: { headers: Record<string, string>; principal?: unknown } = { headers };
    const context = {
      getHandler: () => handler,
      getClass: () => Controller,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return { context, request };
  }

  const gateway = { authorization: `Bearer ${mintGatewayToken(key, 'identity')}` };
  const principal = (role: string): Record<string, string> => ({
    ...gateway,
    'x-principal-id': PRINCIPAL_ID,
    'x-principal-role': role,
  });

  it('bỏ qua route SkipAuth', async () => {
    await expect(guard.canActivate(contextFor(instance.health, {}).context)).resolves.toBe(true);
  });

  it('thiếu token → SERVICE_TOKEN_MISSING, kể cả route public', async () => {
    await expect(guard.canActivate(contextFor(instance.login, {}).context)).rejects.toMatchObject({
      code: 'SERVICE_TOKEN_MISSING',
      status: 401,
    });
  });

  it('header x-principal-* giả mà không có token gateway bị từ chối', async () => {
    const forged = { 'x-principal-id': PRINCIPAL_ID, 'x-principal-role': 'admin' };
    await expect(
      guard.canActivate(contextFor(instance.adminOnly, forged).context),
    ).rejects.toMatchObject({
      code: 'SERVICE_TOKEN_MISSING',
    });
  });

  it('user token ở route nào cũng bị TOKEN_TYPE_MISMATCH', async () => {
    const headers = {
      authorization: `Bearer ${mintUserToken(key, { subject: PRINCIPAL_ID, role: 'admin' })}`,
    };
    await expect(
      guard.canActivate(contextFor(instance.adminOnly, headers).context),
    ).rejects.toMatchObject({
      code: 'TOKEN_TYPE_MISMATCH',
    });
  });

  it('route public chỉ nhận token của gateway', async () => {
    const notGateway = {
      authorization: `Bearer ${mintServiceToken(key, { subject: 'media', audience: 'identity', scopes: ['student:profile:read'] })}`,
      'x-principal-id': PRINCIPAL_ID,
      'x-principal-role': 'admin',
    };
    await expect(
      guard.canActivate(contextFor(instance.adminOnly, notGateway).context),
    ).rejects.toMatchObject({
      code: 'SERVICE_SCOPE_FORBIDDEN',
      status: 403,
    });
  });

  it('route public: Anonymous không cần principal, còn lại cần principal và role', async () => {
    await expect(guard.canActivate(contextFor(instance.login, gateway).context)).resolves.toBe(
      true,
    );
    await expect(
      guard.canActivate(contextFor(instance.any, gateway).context),
    ).rejects.toMatchObject({
      status: 401,
    });
    await expect(
      guard.canActivate(contextFor(instance.adminOnly, principal('student')).context),
    ).rejects.toMatchObject({
      status: 403,
    });
    const admin = contextFor(instance.adminOnly, principal('admin'));
    await expect(guard.canActivate(admin.context)).resolves.toBe(true);
    expect(admin.request.principal).toEqual({ id: PRINCIPAL_ID, role: 'admin' });
  });

  it('route internal kiểm scope và không cần principal', async () => {
    const ok = {
      authorization: `Bearer ${mintServiceToken(key, { subject: 'media', audience: 'identity', scopes: ['student:profile:read'] })}`,
    };
    const missing = {
      authorization: `Bearer ${mintServiceToken(key, { subject: 'course', audience: 'identity', scopes: [] })}`,
    };
    await expect(guard.canActivate(contextFor(instance.internal, ok).context)).resolves.toBe(true);
    await expect(
      guard.canActivate(contextFor(instance.internal, missing).context),
    ).rejects.toMatchObject({
      code: 'SERVICE_SCOPE_FORBIDDEN',
    });
    // Token của gateway không tự động có quyền internal.
    await expect(
      guard.canActivate(contextFor(instance.internal, gateway).context),
    ).rejects.toMatchObject({
      code: 'SERVICE_SCOPE_FORBIDDEN',
    });
  });

  it('service token cho service khác bị từ chối', async () => {
    const wrong = { authorization: `Bearer ${mintGatewayToken(key, 'course')}` };
    await expect(
      guard.canActivate(contextFor(instance.login, wrong).context),
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe('ServiceTokenProvider', () => {
  function sourceWith(
    behaviour: (call: number) => Promise<{ accessToken: string; expiresInSeconds: number }>,
  ): { source: ServiceTokenSource; calls: () => number } {
    let calls = 0;
    return {
      source: { fetch: () => behaviour(++calls) },
      calls: () => calls,
    };
  }

  it('cache theo audience và single-flight khi nhiều request đồng thời', async () => {
    const { source, calls } = sourceWith((n) =>
      Promise.resolve({ accessToken: `t${n}`, expiresInSeconds: 600 }),
    );
    const provider = new ServiceTokenProvider(source);
    const tokens = await Promise.all([
      provider.getToken('course'),
      provider.getToken('course'),
      provider.getToken('course'),
    ]);
    expect(tokens).toEqual(['t1', 't1', 't1']);
    await provider.getToken('identity');
    await provider.getToken('course');
    expect(calls()).toBe(2);
  });

  it('làm mới nền ở 50% TTL, request vẫn nhận token cũ ngay', async () => {
    let now = 1_000_000;
    const { source, calls } = sourceWith((n) =>
      Promise.resolve({ accessToken: `t${n}`, expiresInSeconds: 100 }),
    );
    const provider = new ServiceTokenProvider(source, { now: () => now });
    expect(await provider.getToken('x')).toBe('t1');
    now += 60_000;
    expect(await provider.getToken('x')).toBe('t1');
    await new Promise((resolve) => setImmediate(resolve));
    expect(calls()).toBe(2);
    expect(await provider.getToken('x')).toBe('t2');
  });

  it('stale-while-error: auth lỗi vẫn dùng token cũ đến khi hết hạn rồi mới ném lỗi', async () => {
    let now = 1_000_000;
    const { source, calls } = sourceWith((n) =>
      n === 1
        ? Promise.resolve({ accessToken: 't1', expiresInSeconds: 100 })
        : Promise.reject(AppError.dependencyUnavailable('x-identity-token')),
    );
    const provider = new ServiceTokenProvider(source, { now: () => now, retryDelayMs: 5_000 });
    await provider.getToken('x');
    now += 60_000;
    expect(await provider.getToken('x')).toBe('t1');
    await new Promise((resolve) => setImmediate(resolve));
    // Trong khoảng backoff không gọi lại auth.
    expect(await provider.getToken('x')).toBe('t1');
    expect(calls()).toBe(2);
    now += 50_000;
    await expect(provider.getToken('x')).rejects.toMatchObject({ code: 'DEPENDENCY_UNAVAILABLE' });
  });
});

describe('HttpJwksKeyProvider', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  function mockJwks(state: {
    keys: ReturnType<typeof generateSigningKey>[];
    fail?: boolean;
  }): ReturnType<typeof jest.fn> {
    const mock = jest.fn(() =>
      state.fail
        ? Promise.resolve(new Response('', { status: 503 }))
        : Promise.resolve(Response.json({ keys: state.keys.map((k) => toJwk(k.publicKey)) })),
    );
    globalThis.fetch = mock as unknown as typeof fetch;
    return mock;
  }

  const options = {
    dependency: 'test-identity-jwks',
    url: 'http://auth.test/.well-known/jwks.json',
    timeoutMs: 1_000,
    cacheTtlMs: 300_000,
    minRefetchIntervalMs: 10_000,
  };

  it('chỉ tải JWKS một lần cho nhiều lần verify', async () => {
    const mock = mockJwks({ keys: [key] });
    const provider = new HttpJwksKeyProvider(options);
    await Promise.all([provider.getKey(key.kid), provider.getKey(key.kid)]);
    await provider.getKey(key.kid);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('kid lạ chỉ refetch tối đa một lần mỗi khoảng min-refetch, xoay khóa vẫn nhận khóa mới', async () => {
    let now = 1_000_000;
    const state = { keys: [key] };
    const mock = mockJwks(state);
    const provider = new HttpJwksKeyProvider({ ...options, now: () => now });
    await provider.getKey(key.kid);
    expect(await provider.getKey('unknown')).toBeUndefined();
    expect(mock).toHaveBeenCalledTimes(1);
    state.keys = [key, otherKey];
    now += 11_000;
    expect(await provider.getKey(otherKey.kid)).toBeDefined();
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('stale-while-error: auth lỗi vẫn dùng khóa đã cache; chưa có cache thì báo dependency lỗi', async () => {
    let now = 1_000_000;
    const state = { keys: [key], fail: false };
    mockJwks(state);
    const provider = new HttpJwksKeyProvider({ ...options, now: () => now });
    await provider.getKey(key.kid);
    state.fail = true;
    now += 400_000;
    expect(await provider.getKey(key.kid)).toBeDefined();

    const cold = new HttpJwksKeyProvider(options);
    await expect(cold.getKey(key.kid)).rejects.toMatchObject({ code: 'DEPENDENCY_UNAVAILABLE' });
  });

  it('createHttpServiceAuth dựng verifier theo tên service', () => {
    const auth = createHttpServiceAuth('course', {
      baseUrl: 'http://auth.test',
      timeoutMs: 1_000,
      cacheTtlMs: 1_000,
      minRefetchIntervalMs: 1_000,
    });
    expect(auth.serviceName).toBe('course');
  });
});

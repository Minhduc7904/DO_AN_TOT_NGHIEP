import { HttpException } from '@nestjs/common';
import type { ArgumentsHost, ExecutionContext } from '@nestjs/common';
import { apiErrorSchema } from '@aiops-lms/contracts';
import { Reflector } from '@nestjs/core';
import { z } from 'zod';

import { AppExceptionFilter } from '../../src/http/app-exception.filter.js';
import { correlationIdMiddleware, getCorrelationId } from '../../src/http/correlation.js';
import { parseInput } from '../../src/http/parse-input.js';
import { Public, PrincipalGuard, Roles } from '../../src/http/principal.js';
import { AppError } from '../../src/errors/index.js';

const PRINCIPAL_ID = '2f0b0a6e-5d4b-4c0b-9a54-3d1f0b8f7a11';

function hostFor(): { host: ArgumentsHost; sent: { status?: number; body?: unknown } } {
  const sent: { status?: number; body?: unknown } = {};
  const response = {
    status(code: number) {
      sent.status = code;
      return { json: (body: unknown) => (sent.body = body) };
    },
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
  return { host, sent };
}

describe('AppExceptionFilter', () => {
  it('ánh xạ AppError sang envelope phẳng', () => {
    const { host, sent } = hostFor();
    new AppExceptionFilter().catch(
      new AppError('QUIZ_HAS_ATTEMPTS', 409, 'Quiz đã có attempt'),
      host,
    );

    expect(sent.status).toBe(409);
    expect(sent.body).toMatchObject({
      success: false,
      data: null,
      error: { code: 'QUIZ_HAS_ATTEMPTS', message: 'Quiz đã có attempt', details: null },
      meta: { trace_id: 'unavailable', pagination: null },
    });
    expect(apiErrorSchema.safeParse(sent.body).success).toBe(true);
  });

  it('ánh xạ HttpException theo status', () => {
    const { host, sent } = hostFor();
    new AppExceptionFilter().catch(new HttpException('Không có route', 404), host);

    expect(sent.status).toBe(404);
    expect(sent.body).toMatchObject({
      error: { code: 'NOT_FOUND', message: 'Không có route' },
    });
  });

  it('không lộ chi tiết lỗi không phân loại', () => {
    const { host, sent } = hostFor();
    new AppExceptionFilter().catch(new Error('password=secret at db:5432'), host);

    expect(sent.status).toBe(500);
    expect(JSON.stringify(sent.body)).not.toContain('secret');
    expect(sent.body).toMatchObject({ error: { code: 'INTERNAL_ERROR' } });
  });
});

describe('parseInput', () => {
  it('trả dữ liệu hợp lệ và ném VALIDATION_ERROR kèm issue', () => {
    const schema = z.object({ email: z.email() });

    expect(parseInput(schema, { email: 'a@b.co' })).toEqual({ email: 'a@b.co' });
    try {
      parseInput(schema, { email: 'x' });
      throw new Error('phải ném lỗi');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({ code: 'VALIDATION_ERROR', status: 400 });
      expect((error as AppError).details).toEqual([{ path: 'email', message: expect.any(String) }]);
    }
  });
});

describe('PrincipalGuard', () => {
  class Controller {
    @Roles('admin')
    adminOnly(): void {}
    @Public()
    open(): void {}
    any(): void {}
  }

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

  const guard = new PrincipalGuard(new Reflector());
  const instance = new Controller();

  it('cho route công khai không cần header', () => {
    expect(guard.canActivate(contextFor(instance.open, {}).context)).toBe(true);
  });

  it('trả 401 khi thiếu hoặc sai danh tính', () => {
    expect(() => guard.canActivate(contextFor(instance.any, {}).context)).toThrow(AppError);
    expect(() =>
      guard.canActivate(
        contextFor(instance.any, { 'x-principal-id': 'not-uuid', 'x-principal-role': 'admin' })
          .context,
      ),
    ).toThrow(expect.objectContaining({ status: 401 }));
  });

  it('trả 403 khi sai role và gắn principal khi đúng role', () => {
    const student = { 'x-principal-id': PRINCIPAL_ID, 'x-principal-role': 'student' };
    expect(() => guard.canActivate(contextFor(instance.adminOnly, student).context)).toThrow(
      expect.objectContaining({ status: 403 }),
    );

    const admin = contextFor(instance.adminOnly, { ...student, 'x-principal-role': 'admin' });
    expect(guard.canActivate(admin.context)).toBe(true);
    expect(admin.request.principal).toEqual({ id: PRINCIPAL_ID, role: 'admin' });
  });
});

describe('correlationIdMiddleware', () => {
  it('giữ id hợp lệ, tạo mới khi thiếu hoặc sai và echo trong response', () => {
    const headers: Record<string, string> = {};
    const response = { setHeader: (name: string, value: string) => (headers[name] = value) };
    let seen: string | undefined;

    correlationIdMiddleware({ headers: { 'x-correlation-id': 'req-123' } }, response, () => {
      seen = getCorrelationId();
    });
    expect(seen).toBe('req-123');
    expect(headers['x-correlation-id']).toBe('req-123');

    correlationIdMiddleware({ headers: { 'x-correlation-id': 'bad id!' } }, response, () => {
      seen = getCorrelationId();
    });
    expect(seen).toMatch(/^[0-9a-f-]{36}$/u);
    expect(getCorrelationId()).toBeUndefined();
  });
});

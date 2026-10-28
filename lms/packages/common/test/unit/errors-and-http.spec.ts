import { HttpException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { apiErrorSchema } from '@aiops-lms/contracts';
import { z } from 'zod';

import { AppExceptionFilter } from '../../src/http/app-exception.filter.js';
import { correlationIdMiddleware, getCorrelationId } from '../../src/http/correlation.js';
import { parseInput } from '../../src/http/parse-input.js';
import { AppError } from '../../src/errors/index.js';

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

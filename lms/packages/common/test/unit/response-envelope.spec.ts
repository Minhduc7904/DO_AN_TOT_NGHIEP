import { apiListResponseSchema, apiResponseSchema } from '@aiops-lms/contracts';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { StreamableFile } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { z } from 'zod';

import {
  buildErrorEnvelope,
  buildSuccessEnvelope,
  Page,
  toPage,
} from '../../src/http/response-envelope.js';
import {
  RawResponse,
  ResponseEnvelopeInterceptor,
} from '../../src/http/response-envelope.interceptor.js';

class Controller {
  normal(): void {}
  @RawResponse()
  raw(): void {}
}

function run(handler: () => void, value: unknown): Promise<unknown> {
  const context = {
    getHandler: () => handler,
    getClass: () => Controller,
  } as unknown as ExecutionContext;
  const next: CallHandler = { handle: () => of(value) };
  return lastValueFrom(new ResponseEnvelopeInterceptor(new Reflector()).intercept(context, next));
}

const instance = new Controller();
const itemSchema = z.object({ id: z.string() });

describe('envelope thống nhất', () => {
  it('success và error có cùng bốn khóa', () => {
    const success = buildSuccessEnvelope({ id: 'a' });
    const failure = buildErrorEnvelope('NOT_FOUND', 'Không có');

    expect(Object.keys(success).sort()).toEqual(['data', 'error', 'meta', 'success']);
    expect(Object.keys(failure).sort()).toEqual(Object.keys(success).sort());
    expect(Object.keys(success.meta).sort()).toEqual(Object.keys(failure.meta).sort());
    expect(apiResponseSchema(itemSchema).safeParse(success).success).toBe(true);
    expect(apiResponseSchema(itemSchema).safeParse(failure).success).toBe(true);
  });
});

describe('ResponseEnvelopeInterceptor', () => {
  it('bọc object thành data, pagination null', async () => {
    const body = await run(instance.normal, { id: 'a' });

    expect(body).toMatchObject({
      success: true,
      data: { id: 'a' },
      error: null,
      meta: { pagination: null },
    });
  });

  it('bọc Page thành data là mảng kèm meta.pagination', async () => {
    const page = toPage(
      { items: [{ id: 'a' }, { id: 'b' }], total: 45 },
      { page: 2, page_size: 20 },
      (item) => item,
    );

    const body = await run(instance.normal, page);

    expect(body).toMatchObject({
      success: true,
      data: [{ id: 'a' }, { id: 'b' }],
      meta: { pagination: { page: 2, page_size: 20, total: 45, total_pages: 3 } },
    });
    expect(apiListResponseSchema(itemSchema).safeParse(body).success).toBe(true);
  });

  it('trả data null khi controller không trả gì và giữ nguyên route raw/stream', async () => {
    await expect(run(instance.normal, undefined)).resolves.toMatchObject({
      success: true,
      data: null,
    });
    const stream = new StreamableFile(Buffer.from('csv'));
    await expect(run(instance.normal, stream)).resolves.toBe(stream);
    await expect(run(instance.raw, { raw: true })).resolves.toEqual({ raw: true });
  });

  it('Page rỗng vẫn có total_pages 0', () => {
    const page = toPage({ items: [], total: 0 }, { page: 1, page_size: 20 }, (item) => item);

    expect(page).toBeInstanceOf(Page);
    expect(page.pagination).toEqual({ page: 1, page_size: 20, total: 0, total_pages: 0 });
  });
});

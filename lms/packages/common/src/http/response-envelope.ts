import {
  buildPaginationMeta,
  type ApiError,
  type ApiSuccess,
  type PaginationMeta,
  type PaginationQuery,
} from '@aiops-lms/contracts';
import { trace } from '@opentelemetry/api';

import { ERROR_CODES } from '../errors/index.js';

function currentMeta(pagination: PaginationMeta | null, now: Date): ApiSuccess<unknown>['meta'] {
  return {
    trace_id: trace.getActiveSpan()?.spanContext().traceId ?? 'unavailable',
    timestamp: now.toISOString(),
    pagination,
  };
}

export function buildSuccessEnvelope<TData>(
  data: TData,
  pagination: PaginationMeta | null = null,
  now: Date = new Date(),
): ApiSuccess<TData> {
  return { success: true, data, error: null, meta: currentMeta(pagination, now) };
}

export function buildErrorEnvelope(
  code: string,
  message: string,
  details: unknown = null,
  now: Date = new Date(),
): ApiError {
  return {
    success: false,
    data: null,
    error: { code, message, details },
    meta: currentMeta(null, now),
  };
}

const CODE_BY_STATUS: Record<number, string> = {
  400: ERROR_CODES.validation,
  401: ERROR_CODES.unauthorized,
  403: ERROR_CODES.forbidden,
  404: ERROR_CODES.notFound,
  409: ERROR_CODES.conflict,
  503: ERROR_CODES.dependencyUnavailable,
  504: ERROR_CODES.dependencyTimeout,
};

export function codeForStatus(status: number): string {
  return CODE_BY_STATUS[status] ?? ERROR_CODES.internal;
}

/**
 * Kết quả danh sách mà controller trả về; `ResponseEnvelopeInterceptor` đưa `items` vào `data` và
 * phân trang vào `meta.pagination`.
 */
export class Page<TItem> {
  constructor(
    readonly items: TItem[],
    readonly pagination: PaginationMeta,
  ) {}
}

/** Ánh xạ kết quả repository `{ items, total }` sang `Page` của DTO theo query phân trang. */
export function toPage<TEntity, TDto>(
  result: { items: TEntity[]; total: number },
  query: PaginationQuery,
  present: (entity: TEntity) => TDto,
): Page<TDto> {
  return new Page(result.items.map(present), buildPaginationMeta(query, result.total));
}

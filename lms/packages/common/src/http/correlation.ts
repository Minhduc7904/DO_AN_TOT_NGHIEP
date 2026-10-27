import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

const storage = new AsyncLocalStorage<{ correlationId: string }>();

/** Correlation id của request đang xử lý (hoặc command đang consume); undefined ngoài ngữ cảnh. */
export function getCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId;
}

export function runWithCorrelationId<T>(correlationId: string, run: () => T): T {
  return storage.run({ correlationId }, run);
}

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
}

interface ResponseLike {
  setHeader(name: string, value: string): unknown;
}

/** Nhận `x-correlation-id` từ client/gateway hoặc tạo mới; echo lại trong response. */
export function correlationIdMiddleware(
  request: RequestLike,
  response: ResponseLike,
  next: () => void,
): void {
  const incoming = request.headers[CORRELATION_ID_HEADER];
  const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
  const correlationId =
    candidate && /^[A-Za-z0-9._-]{1,128}$/u.test(candidate) ? candidate : randomUUID();
  response.setHeader(CORRELATION_ID_HEADER, correlationId);
  runWithCorrelationId(correlationId, next);
}

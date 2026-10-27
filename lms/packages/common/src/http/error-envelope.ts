import { trace } from '@opentelemetry/api';

import { ERROR_CODES } from '../errors/index.js';

export interface ErrorEnvelope {
  code: string;
  message: string;
  trace_id: string;
  timestamp: string;
  details: unknown;
}

export function buildErrorEnvelope(
  code: string,
  message: string,
  details: unknown = null,
  now: Date = new Date(),
): ErrorEnvelope {
  return {
    code,
    message,
    trace_id: trace.getActiveSpan()?.spanContext().traceId ?? 'unavailable',
    timestamp: now.toISOString(),
    details,
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

import { setHttpClientSpanAttributes } from '@aiops-lms/observability';
import { context, propagation, trace } from '@opentelemetry/api';

import { AppError } from '../errors/index.js';
import { CORRELATION_ID_HEADER, getCorrelationId } from '../http/correlation.js';
import { PRINCIPAL_ID_HEADER, PRINCIPAL_ROLE_HEADER } from '../http/principal.js';
import type { Principal } from '../ports/index.js';
import { observeDependency } from '../telemetry/observe-dependency.js';
import { CircuitBreaker } from './circuit-breaker.js';

export interface HttpQueryClientOptions {
  /** Định danh dependency canonical, ví dụ `course-student-http`. */
  dependency: string;
  baseUrl: string;
  timeoutMs: number;
  breaker: { cooldownMs: number; failureThreshold: number };
}

export interface HttpRequest {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  /** Chỉ truyền khi downstream thật sự cần danh tính. */
  principal?: Principal;
}

export interface HttpResponse<T> {
  status: number;
  body: T;
}

/**
 * Client HTTP đồng bộ giữa service: timeout bắt buộc, circuit breaker, forward `traceparent` và
 * `x-correlation-id`, **không retry**. 2xx/3xx/4xx trả về cho caller quyết định; lỗi mạng,
 * timeout, breaker mở và 5xx thành `DEPENDENCY_UNAVAILABLE`/`DEPENDENCY_TIMEOUT`.
 */
export class HttpQueryClient {
  private readonly breaker: CircuitBreaker;

  constructor(private readonly options: HttpQueryClientOptions) {
    this.breaker = new CircuitBreaker(options.breaker);
  }

  request<T = unknown>(request: HttpRequest): Promise<HttpResponse<T>> {
    const method = request.method ?? 'GET';
    return observeDependency(this.options.dependency, `${method} ${request.path}`, async () => {
      if (!this.breaker.allowRequest()) {
        trace.getActiveSpan()?.setAttribute('circuit_breaker_open', true);
        throw AppError.dependencyUnavailable(this.options.dependency);
      }
      try {
        const response = await this.send<T>(method, request);
        if (response.status >= 500) {
          throw response.status === 504
            ? AppError.dependencyTimeout(this.options.dependency)
            : AppError.dependencyUnavailable(this.options.dependency);
        }
        this.breaker.onSuccess();
        return response;
      } catch (error) {
        this.breaker.onFailure();
        throw error;
      }
    });
  }

  private async send<T>(method: string, request: HttpRequest): Promise<HttpResponse<T>> {
    const url = new URL(request.path, this.options.baseUrl);
    for (const [key, value] of Object.entries(request.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const headers: Record<string, string> = { accept: 'application/json', ...request.headers };
    if (request.body !== undefined) headers['content-type'] = 'application/json';
    const correlationId = getCorrelationId();
    if (correlationId) headers[CORRELATION_ID_HEADER] = correlationId;
    if (request.principal) {
      headers[PRINCIPAL_ID_HEADER] = request.principal.id;
      headers[PRINCIPAL_ROLE_HEADER] = request.principal.role;
    }
    propagation.inject(context.active(), headers);

    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.options.timeoutMs);

    setHttpClientSpanAttributes(trace.getActiveSpan(), this.options.dependency, method);
    try {
      const response = await fetch(url, {
        method,
        headers,
        signal: controller.signal,
        ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
      });
      setHttpClientSpanAttributes(
        trace.getActiveSpan(),
        this.options.dependency,
        method,
        response.status,
      );
      const text = await response.text();
      return { status: response.status, body: (text ? JSON.parse(text) : null) as T };
    } catch (error) {
      if (timedOut) throw AppError.dependencyTimeout(this.options.dependency);
      if (error instanceof AppError) throw error;
      throw AppError.dependencyUnavailable(this.options.dependency);
    } finally {
      clearTimeout(timeout);
    }
  }
}

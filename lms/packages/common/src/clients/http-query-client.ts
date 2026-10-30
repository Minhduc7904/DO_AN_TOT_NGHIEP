import { setHttpClientSpanAttributes } from '@aiops-lms/observability';
import { context, propagation, trace } from '@opentelemetry/api';

import type { TokenProvider } from '../auth/service-token.provider.js';
import { AppError } from '../errors/index.js';
import { CORRELATION_ID_HEADER, getCorrelationId } from '../http/correlation.js';
import { PRINCIPAL_ID_HEADER, PRINCIPAL_ROLE_HEADER } from '../http/principal.js';
import type { Principal } from '../ports/index.js';
import { observeDependency } from '../telemetry/observe-dependency.js';
import { CircuitBreaker } from './circuit-breaker.js';

export interface HttpQueryClientOptions {
  /** Định danh dependency canonical, ví dụ `media-identity`. */
  dependency: string;
  baseUrl: string;
  timeoutMs: number;
  breaker: { cooldownMs: number; failureThreshold: number };
  /** Gắn service access token (audience = service đích) vào mọi request tới `/internal/v1/*`. */
  auth?: { audience: string; tokens: TokenProvider };
}

export interface HttpRequest {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  /** Chỉ truyền khi downstream thật sự cần danh tính. */
  principal?: Principal;
  /**
   * `bytes`: phản hồi 2xx trả về `Buffer` (tải nội dung nhị phân); phản hồi khác 2xx vẫn là JSON lỗi.
   * Mặc định `json`.
   */
  responseType?: 'json' | 'bytes';
  /**
   * Các mã 5xx mà caller muốn tự xử lý theo body lỗi của downstream (ví dụ `502 AI_PROVIDER_ERROR`):
   * trả về như 4xx và không tính vào circuit breaker. Mã 5xx khác vẫn thành lỗi dependency.
   */
  passthroughStatuses?: readonly number[];
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

  async request<T = unknown>(request: HttpRequest): Promise<HttpResponse<T>> {
    const method = request.method ?? 'GET';
    // Lấy token trước khi mở span dependency: lỗi lấy token thuộc về dependency `*-identity-token`.
    const token = await this.options.auth?.tokens.getToken(this.options.auth.audience);
    return observeDependency(this.options.dependency, `${method} ${request.path}`, async () => {
      if (!this.breaker.allowRequest()) {
        trace.getActiveSpan()?.setAttribute('circuit_breaker_open', true);
        throw AppError.dependencyUnavailable(this.options.dependency);
      }
      try {
        const response = await this.send<T>(method, request, token);
        if (response.status >= 500 && !request.passthroughStatuses?.includes(response.status)) {
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

  private async send<T>(
    method: string,
    request: HttpRequest,
    token: string | undefined,
  ): Promise<HttpResponse<T>> {
    const url = new URL(request.path, this.options.baseUrl);
    for (const [key, value] of Object.entries(request.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const bytes = request.responseType === 'bytes';
    const headers: Record<string, string> = {
      accept: bytes ? '*/*' : 'application/json',
      ...request.headers,
    };
    if (token) headers.authorization = `Bearer ${token}`;
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
      if (bytes && response.ok) {
        return { status: response.status, body: Buffer.from(await response.arrayBuffer()) as T };
      }
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

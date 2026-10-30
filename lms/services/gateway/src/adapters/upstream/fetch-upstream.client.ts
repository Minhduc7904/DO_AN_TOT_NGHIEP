import type { TokenProvider } from '@aiops-lms/common/auth';
import { AppError, ERROR_CODES } from '@aiops-lms/common/errors';
import { CORRELATION_ID_HEADER, getCorrelationId } from '@aiops-lms/common/http';
import { observeDependency } from '@aiops-lms/common/telemetry';
import { normalizeHttpMethod, setHttpClientSpanAttributes } from '@aiops-lms/observability';
import { context, propagation, trace } from '@opentelemetry/api';
import { Readable } from 'node:stream';

import type {
  UpstreamClient,
  UpstreamRequest,
  UpstreamResponse,
} from '../../application/ports/upstream-client.js';
import type { UpstreamName } from '../../domain/route-table.js';

/** Identity canonical của từng upstream theo catalogue v2 (`gateway-<service>`). */
const DEPENDENCY_IDENTITY: Record<UpstreamName, string> = {
  identity: 'gateway-identity',
  course: 'gateway-course',
  media: 'gateway-media',
  notification: 'gateway-notification',
  scheduler: 'gateway-scheduler',
  ai: 'gateway-ai',
};

// Header theo từng chặng của phản hồi không được chuyển cho client.
const DROPPED_RESPONSE_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

/**
 * Phản hồi 5xx của upstream: vẫn được trả nguyên vẹn cho client (giữ mã nghiệp vụ như
 * `AI_PROVIDER_ERROR`), nhưng được ném ra khỏi `observeDependency` để span và metric ghi nhận lỗi.
 */
class UpstreamServerError extends AppError {
  constructor(
    dependency: string,
    readonly response: UpstreamResponse,
  ) {
    super(
      response.status === 504 ? ERROR_CODES.dependencyTimeout : ERROR_CODES.dependencyUnavailable,
      response.status,
      'Upstream trả lỗi máy chủ',
      { dependency },
    );
  }
}

export class FetchUpstreamClient implements UpstreamClient {
  constructor(
    private readonly baseUrls: Partial<Record<UpstreamName, string>>,
    private readonly timeoutMs: number,
    private readonly tokens: TokenProvider,
  ) {}

  async forward(upstream: UpstreamName, request: UpstreamRequest): Promise<UpstreamResponse> {
    const baseUrl = this.baseUrls[upstream];
    if (!baseUrl) throw AppError.notFound('Không tìm thấy route');
    const dependency = DEPENDENCY_IDENTITY[upstream];
    const method = normalizeHttpMethod(request.method);
    // Token trước khi mở span dependency: lỗi lấy token thuộc dependency `gateway-identity-token`,
    // không bị tính nhầm là upstream lỗi.
    const token = await this.tokens.getToken(upstream);

    try {
      return await observeDependency(dependency, method, () =>
        this.send(dependency, baseUrl, request, token),
      );
    } catch (error) {
      if (error instanceof UpstreamServerError) return error.response;
      throw error;
    }
  }

  private async send(
    dependency: string,
    baseUrl: string,
    request: UpstreamRequest,
    token: string,
  ): Promise<UpstreamResponse> {
    // Mọi request tới service đều mang service token của gateway (client không gửi được Authorization).
    const headers: Record<string, string> = {
      ...request.headers,
      authorization: `Bearer ${token}`,
    };
    const correlationId = getCorrelationId();
    if (correlationId) headers[CORRELATION_ID_HEADER] = correlationId;
    // Client span hiện tại làm parent: upstream nhận cùng trace id nhưng parent span của gateway.
    propagation.inject(context.active(), headers);

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);
    const abortOnClientClose = (): void => controller.abort();
    request.signal.addEventListener('abort', abortOnClientClose, { once: true });

    const method = normalizeHttpMethod(request.method);
    setHttpClientSpanAttributes(trace.getActiveSpan(), dependency, method);
    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(new URL(request.target, baseUrl), {
        method: request.method,
        headers,
        signal: controller.signal,
        redirect: 'manual',
        ...(request.body
          ? { body: Readable.toWeb(Readable.from(request.body)) as ReadableStream, duplex: 'half' }
          : {}),
      } as RequestInit);
    } catch {
      if (timedOut) throw AppError.dependencyTimeout(dependency);
      throw AppError.dependencyUnavailable(dependency);
    } finally {
      // Timeout chỉ áp tới khi có header phản hồi; body lớn (media, CSV) được stream tiếp.
      clearTimeout(timer);
    }
    setHttpClientSpanAttributes(trace.getActiveSpan(), dependency, method, upstreamResponse.status);

    const response: UpstreamResponse = {
      status: upstreamResponse.status,
      headers: responseHeaders(upstreamResponse.headers),
      body: upstreamResponse.body
        ? (upstreamResponse.body as unknown as AsyncIterable<Uint8Array>)
        : null,
    };
    if (response.status >= 500) throw new UpstreamServerError(dependency, response);
    return response;
  }
}

function responseHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, name) => {
    if (!DROPPED_RESPONSE_HEADERS.has(name)) result[name] = value;
  });
  return result;
}

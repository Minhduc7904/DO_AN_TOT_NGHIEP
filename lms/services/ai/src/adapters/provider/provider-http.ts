import { AppError } from '@aiops-lms/common/errors';
import { observeDependency } from '@aiops-lms/common/telemetry';
import { setHttpClientSpanAttributes } from '@aiops-lms/observability';
import { trace } from '@opentelemetry/api';

import { ProviderCallError, type ProviderTarget } from '../../application/ports/provider-client.js';

/** Định danh dependency canonical của nhà cung cấp LLM (catalogue v2 mục 2.2). */
export const LLM_PROVIDER_DEPENDENCY = 'ai-llm-provider';

const ANTHROPIC_VERSION = '2023-06-01';
const MAX_DETAIL_LENGTH = 300;

export interface ProviderHttpRequest {
  method: 'GET' | 'POST';
  /** Đường dẫn tương đối với base URL của provider, ví dụ `chat/completions`. */
  path: string;
  target: ProviderTarget;
  body?: string | undefined;
  timeoutMs: number;
}

export interface ProviderHttpResponse {
  status: number;
  text: string;
}

export function providerUrl(baseUrl: string, path: string): URL {
  return new URL(`${baseUrl.replace(/\/+$/u, '')}/${path}`);
}

/** Header xác thực: `Authorization: Bearer`; Anthropic cần thêm `x-api-key` và `anthropic-version`. */
export function providerHeaders(target: ProviderTarget): Record<string, string> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    authorization: `Bearer ${target.apiKey}`,
  };
  if (target.providerType === 'ANTHROPIC') {
    headers['x-api-key'] = target.apiKey;
    headers['anthropic-version'] = ANTHROPIC_VERSION;
  }
  return headers;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/**
 * Làm sạch văn bản do provider trả trước khi đưa ra ngoài: che API key, URL và host của provider
 * (có thể là host nội bộ), gộp khoảng trắng và cắt ngắn.
 */
export function sanitizeProviderText(text: string, target: ProviderTarget): string {
  let result = text;
  if (target.apiKey.length > 0) result = result.replaceAll(target.apiKey, '***');
  try {
    const url = new URL(target.baseUrl);
    for (const host of new Set([url.host, url.hostname])) {
      if (host) result = result.replace(new RegExp(escapeRegExp(host), 'giu'), '[host]');
    }
  } catch {
    // base URL đã được validate lúc lưu; nếu hỏng thì bỏ qua bước che host.
  }
  result = result
    .replace(/\bhttps?:\/\/[^\s"'<>)]+/giu, '[url]')
    .replace(/\s+/gu, ' ')
    .trim();
  return result.length > MAX_DETAIL_LENGTH ? `${result.slice(0, MAX_DETAIL_LENGTH)}...` : result;
}

/** Lấy thông điệp lỗi từ body JSON kiểu `{ "error": { "message": "…" } }`; `null` nếu không có. */
export function extractProviderMessage(body: string): string | null {
  try {
    let root: unknown = JSON.parse(body);
    if (Array.isArray(root)) root = root[0];
    if (!root || typeof root !== 'object' || !('error' in root)) return null;
    const error = (root as { error: unknown }).error;
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && 'message' in error) {
      const message = (error as { message: unknown }).message;
      return typeof message === 'string' ? message : null;
    }
  } catch {
    // body không phải JSON
  }
  return null;
}

/**
 * Gửi một request tới provider. Timeout và lỗi kết nối thành `AppError` `DEPENDENCY_TIMEOUT` /
 * `DEPENDENCY_UNAVAILABLE` (hai lỗi phân biệt rõ, thông điệp không chứa URL hay host). Không theo
 * redirect để API key không bị gửi sang host khác. Mọi lời gọi có span/metric `ai-llm-provider`.
 */
export function callProvider<T>(
  request: ProviderHttpRequest,
  interpret: (response: ProviderHttpResponse) => T,
): Promise<T> {
  const operation = `${request.method} ${request.path}`;
  return observeDependency(
    LLM_PROVIDER_DEPENDENCY,
    operation,
    async () => {
      const response = await transport(request);
      return interpret(response);
    },
    {
      isExpectedFailure: (error) =>
        error instanceof ProviderCallError &&
        (error.kind === 'auth-failed' || error.kind === 'rejected'),
    },
  );
}

async function transport(request: ProviderHttpRequest): Promise<ProviderHttpResponse> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, request.timeoutMs);
  const span = trace.getActiveSpan();
  setHttpClientSpanAttributes(span, LLM_PROVIDER_DEPENDENCY, request.method);
  try {
    const headers = providerHeaders(request.target);
    if (request.body !== undefined) headers['content-type'] = 'application/json';
    const response = await fetch(providerUrl(request.target.baseUrl, request.path), {
      method: request.method,
      headers,
      redirect: 'manual',
      signal: controller.signal,
      ...(request.body === undefined ? {} : { body: request.body }),
    });
    setHttpClientSpanAttributes(span, LLM_PROVIDER_DEPENDENCY, request.method, response.status);
    return { status: response.status, text: await response.text() };
  } catch {
    // Không đưa message của lỗi gốc ra ngoài: có thể chứa host nội bộ hoặc chi tiết kết nối.
    throw timedOut
      ? AppError.dependencyTimeout(LLM_PROVIDER_DEPENDENCY)
      : AppError.dependencyUnavailable(LLM_PROVIDER_DEPENDENCY);
  } finally {
    clearTimeout(timer);
  }
}

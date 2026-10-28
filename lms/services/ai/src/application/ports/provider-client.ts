import type { ProviderKind } from '../../domain/ai.js';

export const CHAT_CLIENT = Symbol('CHAT_CLIENT');
export const PROVIDER_PROBE = Symbol('PROVIDER_PROBE');

export type ChatPart =
  | { type: 'text'; text: string }
  | { type: 'image'; mediaType: string; dataBase64: string }
  | { type: 'file'; mediaType: string; dataBase64: string; fileName?: string | undefined };

export interface ToolCall {
  id: string;
  name: string;
  argumentsJson: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  text?: string | undefined;
  parts?: ChatPart[] | undefined;
  toolCalls?: ToolCall[] | undefined;
  toolCallId?: string | undefined;
}

export interface ChatTool {
  name: string;
  description: string;
  parametersSchema: Record<string, unknown>;
}

/** Đích gọi provider; `apiKey` là plaintext chỉ tồn tại trong bộ nhớ suốt lời gọi. */
export interface ProviderTarget {
  providerType: ProviderKind;
  baseUrl: string;
  apiKey: string;
}

export interface ChatRequest extends ProviderTarget {
  modelName: string;
  messages: ChatMessage[];
  tools: ChatTool[];
}

export interface ChatResult {
  text: string | null;
  toolCalls: ToolCall[];
  finishReason: string;
  promptTokens: number;
  completionTokens: number;
}

export type ProviderFailureKind =
  'auth-failed' | 'rate-limited' | 'rejected' | 'invalid-response' | 'upstream-error';

/**
 * Provider trả HTTP lỗi hoặc phản hồi không đọc được. `safeDetail` đã được che API key và URL/host,
 * cắt ngắn; không bao giờ chứa dữ liệu nhạy cảm. Lỗi mạng/timeout không dùng lớp này mà là
 * `AppError` `DEPENDENCY_UNAVAILABLE`/`DEPENDENCY_TIMEOUT` do adapter ném.
 */
export class ProviderCallError extends Error {
  constructor(
    readonly kind: ProviderFailureKind,
    readonly upstreamStatus: number | null,
    readonly safeDetail: string | null = null,
  ) {
    super(`Provider call failed: ${kind}`);
    this.name = 'ProviderCallError';
  }
}

export interface ChatClient {
  /**
   * Gọi provider đúng một lần (không retry để tránh tính phí trùng).
   * @throws ProviderCallError khi provider trả lỗi/ phản hồi sai.
   * @throws AppError DEPENDENCY_TIMEOUT / DEPENDENCY_UNAVAILABLE khi timeout hoặc không kết nối được.
   */
  complete(request: ChatRequest): Promise<ChatResult>;
}

export type ProbeOutcome = 'ok' | 'auth-failed' | 'error' | 'unreachable';

export interface ProbeResult {
  outcome: ProbeOutcome;
  httpStatus: number | null;
  latencyMs: number | null;
}

export interface ProviderProbe {
  /** `GET {baseUrl}/models`; không bao giờ ném lỗi mạng, kết quả nằm trong `outcome`. */
  check(target: ProviderTarget): Promise<ProbeResult>;
}

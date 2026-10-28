/** Loại provider; mọi loại nói chuẩn OpenAI chat-completions, khác nhau ở base URL mặc định và vài header. */
export type ProviderKind = 'OPENAI' | 'GEMINI' | 'ANTHROPIC' | 'MISTRAL' | 'CUSTOM';
export type AiStatus = 'ACTIVE' | 'INACTIVE';
export type TaskKey = 'document-extraction' | 'lesson-synthesis' | 'quiz-authoring';
export type HealthStatus = 'ONLINE' | 'AUTH_FAILED' | 'UNREACHABLE' | 'ERROR' | 'DISABLED';

export const PROVIDER_KINDS: readonly ProviderKind[] = [
  'OPENAI',
  'GEMINI',
  'ANTHROPIC',
  'MISTRAL',
  'CUSTOM',
];

export const TASK_KEYS: readonly TaskKey[] = [
  'document-extraction',
  'lesson-synthesis',
  'quiz-authoring',
];

/** Endpoint mặc định của từng loại provider; `CUSTOM` bắt buộc khai báo base URL. */
export const DEFAULT_BASE_URLS: Readonly<Record<ProviderKind, string | null>> = {
  OPENAI: 'https://api.openai.com/v1',
  GEMINI: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  ANTHROPIC: 'https://api.anthropic.com/v1/',
  MISTRAL: 'https://api.mistral.ai/v1',
  CUSTOM: null,
};

export interface Provider {
  id: string;
  name: string;
  providerType: ProviderKind;
  baseUrl: string;
  /** Chỉ `****` + 4 ký tự cuối của API key. */
  apiKeyHint: string;
  status: AiStatus;
  createdAt: Date;
  updatedAt: Date;
}

/** Provider kèm API key đã mã hóa; chỉ dùng nội bộ ở use case gọi provider. */
export interface ProviderCredential extends Provider {
  apiKeyEncrypted: string;
}

export interface Model {
  id: string;
  providerId: string;
  providerName: string;
  providerType: ProviderKind;
  providerStatus: AiStatus;
  modelName: string;
  displayName: string;
  status: AiStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceBinding {
  id: string;
  taskKey: TaskKey;
  modelId: string;
  modelName: string;
  modelDisplayName: string;
  modelStatus: AiStatus;
  providerId: string;
  providerName: string;
  providerType: ProviderKind;
  providerStatus: AiStatus;
  createdAt: Date;
  updatedAt: Date;
}

export function isTaskKey(value: string): value is TaskKey {
  return (TASK_KEYS as readonly string[]).includes(value);
}

/** `****` + 4 ký tự cuối; chỉ để nhận diện, không dùng để giải mã. */
export function apiKeyHint(apiKey: string): string {
  return `****${apiKey.slice(-4)}`;
}

/** Base URL lưu cho provider: đã khai báo thì bỏ khoảng trắng, nếu không dùng endpoint mặc định của loại. */
export function resolveBaseUrl(kind: ProviderKind, baseUrl: string | null | undefined): string {
  const explicit = baseUrl?.trim();
  if (explicit) return explicit;
  const fallback = DEFAULT_BASE_URLS[kind];
  if (!fallback) throw new Error(`Provider ${kind} cần base URL`);
  return fallback;
}

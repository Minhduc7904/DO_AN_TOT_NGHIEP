import {
  DEFAULT_BASE_URLS,
  PROVIDER_KINDS,
  type ProviderKind,
  TASK_KEYS,
  type TaskKey,
} from '../../../domain/ai.js';

export interface AiOptions {
  providerTypes: { providerType: ProviderKind; defaultBaseUrl: string | null }[];
  taskKeys: readonly TaskKey[];
}

/** Lựa chọn cố định cho form cấu hình; không truy cập database. */
export class GetAiOptionsUseCase {
  execute(): AiOptions {
    return {
      providerTypes: PROVIDER_KINDS.map((providerType) => ({
        providerType,
        defaultBaseUrl: DEFAULT_BASE_URLS[providerType],
      })),
      taskKeys: TASK_KEYS,
    };
  }
}

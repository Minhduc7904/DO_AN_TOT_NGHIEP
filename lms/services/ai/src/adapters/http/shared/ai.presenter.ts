import type {
  AiCompletionDto,
  AiModelDto,
  AiOptionsDto,
  AiProviderDto,
  AiProviderHealthDto,
  AiServiceBindingDto,
} from '@aiops-lms/contracts';

import type { Model, Provider, ServiceBinding } from '../../../domain/ai.js';
import type { Completion } from '../../../application/use-cases/completions/create-completion.use-case.js';
import type { AiOptions } from '../../../application/use-cases/options/get-ai-options.use-case.js';
import type { ProviderHealth } from '../../../application/use-cases/providers/provider-health-checker.js';

export function presentProvider(provider: Provider): AiProviderDto {
  return {
    id: provider.id,
    name: provider.name,
    provider_type: provider.providerType,
    base_url: provider.baseUrl,
    api_key_hint: provider.apiKeyHint,
    status: provider.status,
    created_at: provider.createdAt.toISOString(),
    updated_at: provider.updatedAt.toISOString(),
  };
}

export function presentProviderHealth(health: ProviderHealth): AiProviderHealthDto {
  return {
    provider_id: health.providerId,
    name: health.name,
    provider_type: health.providerType,
    base_url: health.baseUrl,
    provider_status: health.providerStatus,
    health_status: health.healthStatus,
    http_status: health.httpStatus,
    latency_ms: health.latencyMs,
    message: health.message,
    checked_at: health.checkedAt.toISOString(),
  };
}

export function presentModel(model: Model): AiModelDto {
  return {
    id: model.id,
    provider_id: model.providerId,
    provider_name: model.providerName,
    provider_type: model.providerType,
    model_name: model.modelName,
    display_name: model.displayName,
    status: model.status,
    created_at: model.createdAt.toISOString(),
    updated_at: model.updatedAt.toISOString(),
  };
}

export function presentBinding(binding: ServiceBinding): AiServiceBindingDto {
  return {
    id: binding.id,
    task_key: binding.taskKey,
    model_id: binding.modelId,
    model_name: binding.modelName,
    model_display_name: binding.modelDisplayName,
    model_status: binding.modelStatus,
    provider_id: binding.providerId,
    provider_name: binding.providerName,
    provider_type: binding.providerType,
    provider_status: binding.providerStatus,
    created_at: binding.createdAt.toISOString(),
    updated_at: binding.updatedAt.toISOString(),
  };
}

export function presentOptions(options: AiOptions): AiOptionsDto {
  return {
    provider_types: options.providerTypes.map((entry) => ({
      provider_type: entry.providerType,
      default_base_url: entry.defaultBaseUrl,
    })),
    task_keys: [...options.taskKeys],
  };
}

export function presentCompletion(completion: Completion): AiCompletionDto {
  return {
    task: completion.task,
    provider_type: completion.providerType,
    model_name: completion.modelName,
    text: completion.text,
    tool_calls: completion.toolCalls.map((call) => ({
      id: call.id,
      name: call.name,
      arguments_json: call.argumentsJson,
    })),
    finish_reason: completion.finishReason,
    prompt_tokens: completion.promptTokens,
    completion_tokens: completion.completionTokens,
    latency_ms: completion.latencyMs,
  };
}

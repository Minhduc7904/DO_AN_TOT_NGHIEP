import type {
  Model,
  Provider,
  ProviderCredential,
  ServiceBinding,
  TaskKey,
} from '../../domain/ai.js';
import type {
  AiModel as ModelRow,
  AiProvider as ProviderRow,
  AiServiceBinding as BindingRow,
} from './generated/client.js';

export function toProvider(row: ProviderRow): Provider {
  return {
    id: row.id,
    name: row.name,
    providerType: row.providerType,
    baseUrl: row.baseUrl,
    apiKeyHint: row.apiKeyHint,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toCredential(row: ProviderRow): ProviderCredential {
  return { ...toProvider(row), apiKeyEncrypted: row.apiKeyEncrypted };
}

export type ModelWithProvider = ModelRow & { provider: ProviderRow };

export function toModel(row: ModelWithProvider): Model {
  return {
    id: row.id,
    providerId: row.providerId,
    providerName: row.provider.name,
    providerType: row.provider.providerType,
    providerStatus: row.provider.status,
    modelName: row.modelName,
    displayName: row.displayName,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export type BindingWithModel = BindingRow & { model: ModelWithProvider };

export function toBinding(row: BindingWithModel): ServiceBinding {
  return {
    id: row.id,
    taskKey: row.taskKey as TaskKey,
    modelId: row.modelId,
    modelName: row.model.modelName,
    modelDisplayName: row.model.displayName,
    modelStatus: row.model.status,
    providerId: row.model.providerId,
    providerName: row.model.provider.name,
    providerType: row.model.provider.providerType,
    providerStatus: row.model.provider.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

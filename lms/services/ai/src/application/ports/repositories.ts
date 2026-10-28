import type {
  AiStatus,
  Model,
  Provider,
  ProviderCredential,
  ProviderKind,
  ServiceBinding,
  TaskKey,
} from '../../domain/ai.js';

export const PROVIDER_REPOSITORY = Symbol('PROVIDER_REPOSITORY');
export const MODEL_REPOSITORY = Symbol('MODEL_REPOSITORY');
export const BINDING_REPOSITORY = Symbol('BINDING_REPOSITORY');
export const INVOCATION_REPOSITORY = Symbol('INVOCATION_REPOSITORY');

export interface Paged<T> {
  items: T[];
  total: number;
}

export interface NewProvider {
  id: string;
  name: string;
  providerType: ProviderKind;
  baseUrl: string;
  apiKeyEncrypted: string;
  apiKeyHint: string;
  status: AiStatus;
}

export interface ProviderPatch {
  name: string;
  providerType: ProviderKind;
  baseUrl: string;
  status: AiStatus;
  /** Có cả hai thì thay API key; không có thì giữ key cũ. */
  apiKeyEncrypted?: string | undefined;
  apiKeyHint?: string | undefined;
}

export interface ProviderFilter {
  search?: string | undefined;
  status?: AiStatus | undefined;
  providerType?: ProviderKind | undefined;
}

export type DeleteOutcome = 'deleted' | 'not-found' | 'in-use';

export interface ProviderRepository {
  /** `null` khi tên đã tồn tại (không phân biệt hoa thường). */
  create(provider: NewProvider): Promise<Provider | null>;
  findById(id: string): Promise<Provider | null>;
  findCredentialById(id: string): Promise<ProviderCredential | null>;
  /** Provider khác `exceptId` có cùng tên không phân biệt hoa thường. */
  nameTaken(name: string, exceptId?: string): Promise<boolean>;
  list(filter: ProviderFilter, page: number, pageSize: number): Promise<Paged<Provider>>;
  listCredentials(): Promise<ProviderCredential[]>;
  /** `'conflict'` khi tên trùng provider khác; `null` khi không tìm thấy. */
  update(id: string, patch: ProviderPatch): Promise<Provider | 'conflict' | null>;
  delete(id: string): Promise<DeleteOutcome>;
}

export interface NewModel {
  id: string;
  providerId: string;
  modelName: string;
  displayName: string;
  status: AiStatus;
}

export interface ModelPatch {
  modelName: string;
  displayName: string;
  status: AiStatus;
}

export interface ModelFilter {
  providerId?: string | undefined;
  status?: AiStatus | undefined;
  search?: string | undefined;
}

export interface ModelRepository {
  /** `null` khi provider đã có model cùng tên. */
  create(model: NewModel): Promise<Model | null>;
  findById(id: string): Promise<Model | null>;
  list(filter: ModelFilter, page: number, pageSize: number): Promise<Paged<Model>>;
  /** `'conflict'` khi trùng tên model trong provider; `null` khi không tìm thấy. */
  update(id: string, patch: ModelPatch): Promise<Model | 'conflict' | null>;
  delete(id: string): Promise<DeleteOutcome>;
}

export interface BindingTarget {
  model: Model;
  provider: ProviderCredential;
}

export interface BindingRepository {
  list(): Promise<ServiceBinding[]>;
  findByTask(taskKey: TaskKey): Promise<ServiceBinding | null>;
  /** Model và provider (kèm key đã mã hóa) mà tác vụ đang trỏ tới. */
  findTarget(taskKey: TaskKey): Promise<BindingTarget | null>;
  /** Tạo hoặc thay model của binding; `created` cho biết binding mới hay đã có. */
  upsert(
    id: string,
    taskKey: TaskKey,
    modelId: string,
  ): Promise<{ binding: ServiceBinding; created: boolean }>;
  delete(taskKey: TaskKey): Promise<boolean>;
}

export interface NewInvocation {
  id: string;
  taskKey: TaskKey;
  modelId: string;
  providerType: ProviderKind;
  modelName: string;
  status: 'SUCCESS' | 'FAILED';
  errorCode: string | null;
  promptTokens: number;
  completionTokens: number;
  toolCallCount: number;
  latencyMs: number;
  createdAt: Date;
}

export interface InvocationRepository {
  record(invocation: NewInvocation): Promise<void>;
}

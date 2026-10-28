import type { Clock, IdGenerator } from '@aiops-lms/common/ports';

import type {
  AiStatus,
  Model,
  Provider,
  ProviderCredential,
  ServiceBinding,
  TaskKey,
} from '../../src/domain/ai.js';
import type {
  ChatClient,
  ChatRequest,
  ChatResult,
  ProbeResult,
  ProviderProbe,
  ProviderTarget,
} from '../../src/application/ports/provider-client.js';
import type {
  BindingRepository,
  BindingTarget,
  DeleteOutcome,
  InvocationRepository,
  ModelFilter,
  ModelPatch,
  ModelRepository,
  NewInvocation,
  NewModel,
  NewProvider,
  Paged,
  ProviderFilter,
  ProviderPatch,
  ProviderRepository,
} from '../../src/application/ports/repositories.js';
import {
  type SecretProtector,
  SecretUnreadableError,
} from '../../src/application/ports/secret-protector.js';

export class FakeClock implements Clock {
  constructor(public current = new Date('2026-10-28T08:00:00.000Z')) {}
  now(): Date {
    return new Date(this.current);
  }
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

export class SequenceIds implements IdGenerator {
  private n = 0;
  next(): string {
    this.n += 1;
    return `00000000-0000-4000-8000-${String(this.n).padStart(12, '0')}`;
  }
}

/** "Mã hóa" đảo chuỗi có tiền tố để test thấy ciphertext khác plaintext; `unreadable` mô phỏng sai khóa. */
export class FakeSecrets implements SecretProtector {
  unreadable = false;
  encrypt(plaintext: string): string {
    return `enc:${[...plaintext].reverse().join('')}`;
  }
  decrypt(ciphertext: string): string {
    if (this.unreadable || !ciphertext.startsWith('enc:')) throw new SecretUnreadableError();
    return [...ciphertext.slice(4)].reverse().join('');
  }
}

const page = <T>(all: T[], pageNumber: number, pageSize: number): Paged<T> => ({
  items: all.slice((pageNumber - 1) * pageSize, pageNumber * pageSize),
  total: all.length,
});

export class MemoryProviders implements ProviderRepository {
  readonly rows = new Map<string, ProviderCredential>();
  /** Id của provider còn model (mô phỏng khóa ngoại RESTRICT). */
  readonly inUse = new Set<string>();
  private tick = 0;

  private clock(): Date {
    this.tick += 1;
    return new Date(Date.UTC(2026, 9, 28, 8, 0, this.tick));
  }

  create(provider: NewProvider): Promise<Provider | null> {
    if (
      [...this.rows.values()].some((row) => row.name.toLowerCase() === provider.name.toLowerCase())
    ) {
      return Promise.resolve(null);
    }
    const now = this.clock();
    const row: ProviderCredential = { ...provider, createdAt: now, updatedAt: now };
    this.rows.set(row.id, row);
    return Promise.resolve(this.strip(row));
  }

  private strip(row: ProviderCredential): Provider {
    const { apiKeyEncrypted: _ignored, ...provider } = row;
    void _ignored;
    return provider;
  }

  findById(id: string): Promise<Provider | null> {
    const row = this.rows.get(id);
    return Promise.resolve(row ? this.strip(row) : null);
  }

  findCredentialById(id: string): Promise<ProviderCredential | null> {
    return Promise.resolve(this.rows.get(id) ?? null);
  }

  nameTaken(name: string, exceptId?: string): Promise<boolean> {
    return Promise.resolve(
      [...this.rows.values()].some(
        (row) => row.id !== exceptId && row.name.toLowerCase() === name.toLowerCase(),
      ),
    );
  }

  list(filter: ProviderFilter, pageNumber: number, pageSize: number): Promise<Paged<Provider>> {
    const all = [...this.rows.values()]
      .filter((row) => !filter.status || row.status === filter.status)
      .filter((row) => !filter.providerType || row.providerType === filter.providerType)
      .filter(
        (row) => !filter.search || row.name.toLowerCase().includes(filter.search.toLowerCase()),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((row) => this.strip(row));
    return Promise.resolve(page(all, pageNumber, pageSize));
  }

  listCredentials(): Promise<ProviderCredential[]> {
    return Promise.resolve([...this.rows.values()]);
  }

  update(id: string, patch: ProviderPatch): Promise<Provider | 'conflict' | null> {
    const row = this.rows.get(id);
    if (!row) return Promise.resolve(null);
    const taken = [...this.rows.values()].some(
      (other) => other.id !== id && other.name.toLowerCase() === patch.name.toLowerCase(),
    );
    if (taken) return Promise.resolve('conflict');
    const next: ProviderCredential = {
      ...row,
      name: patch.name,
      providerType: patch.providerType,
      baseUrl: patch.baseUrl,
      status: patch.status,
      ...(patch.apiKeyEncrypted !== undefined && patch.apiKeyHint !== undefined
        ? { apiKeyEncrypted: patch.apiKeyEncrypted, apiKeyHint: patch.apiKeyHint }
        : {}),
      updatedAt: this.clock(),
    };
    this.rows.set(id, next);
    return Promise.resolve(this.strip(next));
  }

  delete(id: string): Promise<DeleteOutcome> {
    if (!this.rows.has(id)) return Promise.resolve('not-found');
    if (this.inUse.has(id)) return Promise.resolve('in-use');
    this.rows.delete(id);
    return Promise.resolve('deleted');
  }
}

export class MemoryModels implements ModelRepository {
  readonly rows = new Map<string, Model>();
  readonly inUse = new Set<string>();
  private tick = 0;

  constructor(private readonly providers: MemoryProviders) {}

  private view(row: { id: string; providerId: string }, patch: Partial<Model> = {}): Model {
    const provider = this.providers.rows.get(row.providerId);
    const base = this.rows.get(row.id);
    return {
      ...(base as Model),
      providerName: provider?.name ?? '',
      providerType: provider?.providerType ?? 'OPENAI',
      providerStatus: provider?.status ?? 'ACTIVE',
      ...patch,
    };
  }

  create(model: NewModel): Promise<Model | null> {
    if (
      [...this.rows.values()].some(
        (row) => row.providerId === model.providerId && row.modelName === model.modelName,
      )
    ) {
      return Promise.resolve(null);
    }
    this.tick += 1;
    const now = new Date(Date.UTC(2026, 9, 28, 9, 0, this.tick));
    this.rows.set(model.id, {
      ...model,
      providerName: '',
      providerType: 'OPENAI',
      providerStatus: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });
    return Promise.resolve(this.view(model));
  }

  findById(id: string): Promise<Model | null> {
    const row = this.rows.get(id);
    return Promise.resolve(row ? this.view(row) : null);
  }

  list(filter: ModelFilter, pageNumber: number, pageSize: number): Promise<Paged<Model>> {
    const all = [...this.rows.values()]
      .map((row) => this.view(row))
      .filter((row) => !filter.providerId || row.providerId === filter.providerId)
      .filter((row) => !filter.status || row.status === filter.status)
      .filter(
        (row) =>
          !filter.search ||
          row.modelName.toLowerCase().includes(filter.search.toLowerCase()) ||
          row.displayName.toLowerCase().includes(filter.search.toLowerCase()),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return Promise.resolve(page(all, pageNumber, pageSize));
  }

  update(id: string, patch: ModelPatch): Promise<Model | 'conflict' | null> {
    const row = this.rows.get(id);
    if (!row) return Promise.resolve(null);
    const taken = [...this.rows.values()].some(
      (other) =>
        other.id !== id &&
        other.providerId === row.providerId &&
        other.modelName === patch.modelName,
    );
    if (taken) return Promise.resolve('conflict');
    this.rows.set(id, { ...row, ...patch });
    return Promise.resolve(this.view(row));
  }

  delete(id: string): Promise<DeleteOutcome> {
    if (!this.rows.has(id)) return Promise.resolve('not-found');
    if (this.inUse.has(id)) return Promise.resolve('in-use');
    this.rows.delete(id);
    return Promise.resolve('deleted');
  }
}

export class MemoryBindings implements BindingRepository {
  readonly rows = new Map<TaskKey, { id: string; modelId: string }>();

  constructor(
    private readonly models: MemoryModels,
    private readonly providers: MemoryProviders,
  ) {}

  private async view(taskKey: TaskKey): Promise<ServiceBinding | null> {
    const row = this.rows.get(taskKey);
    if (!row) return null;
    const model = await this.models.findById(row.modelId);
    if (!model) return null;
    return {
      id: row.id,
      taskKey,
      modelId: model.id,
      modelName: model.modelName,
      modelDisplayName: model.displayName,
      modelStatus: model.status,
      providerId: model.providerId,
      providerName: model.providerName,
      providerType: model.providerType,
      providerStatus: model.providerStatus,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  }

  async list(): Promise<ServiceBinding[]> {
    const all: ServiceBinding[] = [];
    for (const taskKey of [...this.rows.keys()].sort()) {
      const view = await this.view(taskKey);
      if (view) all.push(view);
    }
    return all;
  }

  findByTask(taskKey: TaskKey): Promise<ServiceBinding | null> {
    return this.view(taskKey);
  }

  async findTarget(taskKey: TaskKey): Promise<BindingTarget | null> {
    const row = this.rows.get(taskKey);
    if (!row) return null;
    const model = await this.models.findById(row.modelId);
    const provider = model ? await this.providers.findCredentialById(model.providerId) : null;
    return model && provider ? { model, provider } : null;
  }

  async upsert(
    id: string,
    taskKey: TaskKey,
    modelId: string,
  ): Promise<{ binding: ServiceBinding; created: boolean }> {
    const existing = this.rows.get(taskKey);
    this.rows.set(taskKey, { id: existing?.id ?? id, modelId });
    return { binding: (await this.view(taskKey)) as ServiceBinding, created: !existing };
  }

  delete(taskKey: TaskKey): Promise<boolean> {
    return Promise.resolve(this.rows.delete(taskKey));
  }
}

export class MemoryInvocations implements InvocationRepository {
  readonly rows: NewInvocation[] = [];
  failWrites = false;

  record(invocation: NewInvocation): Promise<void> {
    if (this.failWrites) return Promise.reject(new Error('db down'));
    this.rows.push(invocation);
    return Promise.resolve();
  }
}

/** Chat client giả: trả kết quả đặt trước hoặc ném lỗi đặt trước; lưu request để assertion. */
export class FakeChat implements ChatClient {
  readonly requests: ChatRequest[] = [];
  outcome: ChatResult | Error = {
    text: 'xin chào',
    toolCalls: [],
    finishReason: 'stop',
    promptTokens: 10,
    completionTokens: 5,
  };

  complete(request: ChatRequest): Promise<ChatResult> {
    this.requests.push(request);
    return this.outcome instanceof Error
      ? Promise.reject(this.outcome)
      : Promise.resolve(this.outcome);
  }
}

export class FakeProbe implements ProviderProbe {
  readonly targets: ProviderTarget[] = [];
  result: ProbeResult = { outcome: 'ok', httpStatus: 200, latencyMs: 12 };

  check(target: ProviderTarget): Promise<ProbeResult> {
    this.targets.push(target);
    return Promise.resolve(this.result);
  }
}

export interface World {
  ids: SequenceIds;
  clock: FakeClock;
  secrets: FakeSecrets;
  providers: MemoryProviders;
  models: MemoryModels;
  bindings: MemoryBindings;
  invocations: MemoryInvocations;
  chat: FakeChat;
  probe: FakeProbe;
}

export function world(): World {
  const providers = new MemoryProviders();
  const models = new MemoryModels(providers);
  return {
    ids: new SequenceIds(),
    clock: new FakeClock(),
    secrets: new FakeSecrets(),
    providers,
    models,
    bindings: new MemoryBindings(models, providers),
    invocations: new MemoryInvocations(),
    chat: new FakeChat(),
    probe: new FakeProbe(),
  };
}

export type { AiStatus };

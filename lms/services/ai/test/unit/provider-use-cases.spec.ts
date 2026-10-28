import { AppError } from '@aiops-lms/common/errors';

import { CreateProviderUseCase } from '../../src/application/use-cases/providers/create-provider.use-case.js';
import { DeleteProviderUseCase } from '../../src/application/use-cases/providers/delete-provider.use-case.js';
import { GetProviderUseCase } from '../../src/application/use-cases/providers/get-provider.use-case.js';
import { ListProvidersUseCase } from '../../src/application/use-cases/providers/list-providers.use-case.js';
import { UpdateProviderUseCase } from '../../src/application/use-cases/providers/update-provider.use-case.js';
import { CheckAllProvidersHealthUseCase } from '../../src/application/use-cases/providers/check-all-providers-health.use-case.js';
import { CheckProviderHealthUseCase } from '../../src/application/use-cases/providers/check-provider-health.use-case.js';
import { ProviderHealthChecker } from '../../src/application/use-cases/providers/provider-health-checker.js';
import { GetAiOptionsUseCase } from '../../src/application/use-cases/options/get-ai-options.use-case.js';
import type { Provider } from '../../src/domain/ai.js';
import { type World, world } from './fakes.js';

const KEY = 'sk-test-key-0123456789';

async function expectError(promise: Promise<unknown>, code: string, status: number): Promise<void> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(AppError);
  expect(error).toMatchObject({ code, status });
}

function createProvider(
  w: World,
  overrides: Partial<Parameters<CreateProviderUseCase['execute']>[0]> = {},
): Promise<Provider> {
  return new CreateProviderUseCase(w.providers, w.secrets, w.ids).execute({
    name: 'OpenAI chính',
    providerType: 'OPENAI',
    baseUrl: null,
    apiKey: KEY,
    status: 'ACTIVE',
    ...overrides,
  });
}

describe('CreateProviderUseCase', () => {
  it('lưu API key đã mã hóa, chỉ trả hint, dùng base URL mặc định của loại', async () => {
    const w = world();

    const provider = await createProvider(w);

    expect(provider).toMatchObject({
      name: 'OpenAI chính',
      baseUrl: 'https://api.openai.com/v1',
      apiKeyHint: '****6789',
      status: 'ACTIVE',
    });
    expect(provider).not.toHaveProperty('apiKeyEncrypted');
    const stored = w.providers.rows.get(provider.id);
    expect(stored?.apiKeyEncrypted).not.toContain(KEY);
    expect(w.secrets.decrypt(stored?.apiKeyEncrypted ?? '')).toBe(KEY);
  });

  it('CUSTOM giữ base URL đã khai báo', async () => {
    const w = world();

    const provider = await createProvider(w, {
      name: 'Nội bộ',
      providerType: 'CUSTOM',
      baseUrl: ' http://llm.internal:8080/v1 ',
    });

    expect(provider.baseUrl).toBe('http://llm.internal:8080/v1');
  });

  it('trùng tên không phân biệt hoa thường: 409 AI_PROVIDER_NAME_CONFLICT', async () => {
    const w = world();
    await createProvider(w);

    await expectError(
      createProvider(w, { name: 'openai CHÍNH' }),
      'AI_PROVIDER_NAME_CONFLICT',
      409,
    );
  });
});

describe('UpdateProviderUseCase', () => {
  it('không gửi api_key thì giữ key cũ; gửi key mới thì đổi ciphertext và hint', async () => {
    const w = world();
    const provider = await createProvider(w);
    const update = new UpdateProviderUseCase(w.providers, w.secrets);
    const before = w.providers.rows.get(provider.id)?.apiKeyEncrypted;

    const kept = await update.execute(provider.id, {
      name: 'Đổi tên',
      providerType: 'OPENAI',
      baseUrl: null,
      status: 'INACTIVE',
    });
    expect(kept).toMatchObject({ name: 'Đổi tên', status: 'INACTIVE', apiKeyHint: '****6789' });
    expect(w.providers.rows.get(provider.id)?.apiKeyEncrypted).toBe(before);

    const rotated = await update.execute(provider.id, {
      name: 'Đổi tên',
      providerType: 'OPENAI',
      baseUrl: null,
      apiKey: 'sk-new-key-abcdefgh',
      status: 'ACTIVE',
    });
    expect(rotated.apiKeyHint).toBe('****efgh');
    expect(w.secrets.decrypt(w.providers.rows.get(provider.id)?.apiKeyEncrypted ?? '')).toBe(
      'sk-new-key-abcdefgh',
    );
  });

  it('404 khi không có provider; 409 khi đổi sang tên của provider khác', async () => {
    const w = world();
    const first = await createProvider(w);
    const second = await createProvider(w, { name: 'Gemini', providerType: 'GEMINI' });
    const update = new UpdateProviderUseCase(w.providers, w.secrets);
    const input = { providerType: 'OPENAI', baseUrl: null, status: 'ACTIVE' } as const;

    await expectError(
      update.execute('00000000-0000-4000-8000-0000000000ff', { ...input, name: 'x1' }),
      'NOT_FOUND',
      404,
    );
    await expectError(
      update.execute(second.id, { ...input, name: first.name }),
      'AI_PROVIDER_NAME_CONFLICT',
      409,
    );
    await expect(update.execute(second.id, { ...input, name: 'Gemini' })).resolves.toMatchObject({
      name: 'Gemini',
    });
  });
});

describe('GetProviderUseCase, ListProvidersUseCase, DeleteProviderUseCase', () => {
  it('get: 404 khi không có; list: lọc và phân trang', async () => {
    const w = world();
    const a = await createProvider(w, { name: 'Alpha' });
    await createProvider(w, { name: 'Beta', providerType: 'MISTRAL', status: 'INACTIVE' });
    await createProvider(w, { name: 'Gamma', providerType: 'GEMINI' });

    await expect(new GetProviderUseCase(w.providers).execute(a.id)).resolves.toMatchObject({
      name: 'Alpha',
    });
    await expectError(
      new GetProviderUseCase(w.providers).execute('00000000-0000-4000-8000-0000000000ff'),
      'NOT_FOUND',
      404,
    );

    const list = new ListProvidersUseCase(w.providers);
    expect((await list.execute({}, 1, 2)).items).toHaveLength(2);
    expect((await list.execute({}, 1, 2)).total).toBe(3);
    expect((await list.execute({ status: 'INACTIVE' }, 1, 20)).items.map((p) => p.name)).toEqual([
      'Beta',
    ]);
    expect(
      (await list.execute({ providerType: 'GEMINI' }, 1, 20)).items.map((p) => p.name),
    ).toEqual(['Gamma']);
    expect((await list.execute({ search: 'alp' }, 1, 20)).items.map((p) => p.name)).toEqual([
      'Alpha',
    ]);
  });

  it('delete: 204 khi xóa được, 404 khi không có, 409 AI_PROVIDER_IN_USE khi còn model', async () => {
    const w = world();
    const a = await createProvider(w, { name: 'Alpha' });
    const b = await createProvider(w, { name: 'Beta' });
    w.providers.inUse.add(b.id);
    const remove = new DeleteProviderUseCase(w.providers);

    await expect(remove.execute(a.id)).resolves.toBeUndefined();
    await expectError(remove.execute(a.id), 'NOT_FOUND', 404);
    await expectError(remove.execute(b.id), 'AI_PROVIDER_IN_USE', 409);
  });
});

describe('kiểm tra kết nối provider', () => {
  const checker = (w: World): ProviderHealthChecker =>
    new ProviderHealthChecker(w.secrets, w.probe, w.clock);

  it('ONLINE: giải mã key, gọi probe với key plaintext, response không có key', async () => {
    const w = world();
    const provider = await createProvider(w);

    const health = await new CheckProviderHealthUseCase(w.providers, checker(w)).execute(
      provider.id,
    );

    expect(health).toMatchObject({ healthStatus: 'ONLINE', httpStatus: 200, latencyMs: 12 });
    expect(w.probe.targets[0]).toMatchObject({ apiKey: KEY, providerType: 'OPENAI' });
    expect(JSON.stringify(health)).not.toContain(KEY);
  });

  it('INACTIVE: DISABLED và không gọi ra ngoài', async () => {
    const w = world();
    const provider = await createProvider(w, { status: 'INACTIVE' });

    const health = await new CheckProviderHealthUseCase(w.providers, checker(w)).execute(
      provider.id,
    );

    expect(health).toMatchObject({ healthStatus: 'DISABLED', httpStatus: null, latencyMs: null });
    expect(w.probe.targets).toHaveLength(0);
  });

  it('phân loại AUTH_FAILED, UNREACHABLE, ERROR theo kết quả probe', async () => {
    const w = world();
    const provider = await createProvider(w);
    const check = new CheckProviderHealthUseCase(w.providers, checker(w));

    w.probe.result = { outcome: 'auth-failed', httpStatus: 401, latencyMs: 5 };
    expect((await check.execute(provider.id)).healthStatus).toBe('AUTH_FAILED');
    w.probe.result = { outcome: 'unreachable', httpStatus: null, latencyMs: null };
    expect((await check.execute(provider.id)).healthStatus).toBe('UNREACHABLE');
    w.probe.result = { outcome: 'error', httpStatus: 500, latencyMs: 9 };
    expect((await check.execute(provider.id)).healthStatus).toBe('ERROR');
  });

  it('key lưu không giải mã được: ERROR và không gọi ra ngoài', async () => {
    const w = world();
    const provider = await createProvider(w);
    w.secrets.unreadable = true;

    const health = await new CheckProviderHealthUseCase(w.providers, checker(w)).execute(
      provider.id,
    );

    expect(health.healthStatus).toBe('ERROR');
    expect(w.probe.targets).toHaveLength(0);
  });

  it('404 khi không có provider; check-all trả kết quả từng provider', async () => {
    const w = world();
    await createProvider(w, { name: 'A' });
    await createProvider(w, { name: 'B', status: 'INACTIVE' });

    await expectError(
      new CheckProviderHealthUseCase(w.providers, checker(w)).execute(
        '00000000-0000-4000-8000-0000000000ff',
      ),
      'NOT_FOUND',
      404,
    );
    const all = await new CheckAllProvidersHealthUseCase(w.providers, checker(w)).execute();
    expect(all.map((entry) => entry.healthStatus).sort()).toEqual(['DISABLED', 'ONLINE']);
  });
});

describe('GetAiOptionsUseCase', () => {
  it('trả loại provider với base URL mặc định và ba khóa tác vụ', () => {
    const options = new GetAiOptionsUseCase().execute();

    expect(options.taskKeys).toEqual(['document-extraction', 'lesson-synthesis', 'quiz-authoring']);
    expect(
      options.providerTypes.find((entry) => entry.providerType === 'OPENAI')?.defaultBaseUrl,
    ).toBe('https://api.openai.com/v1');
    expect(
      options.providerTypes.find((entry) => entry.providerType === 'CUSTOM')?.defaultBaseUrl,
    ).toBeNull();
  });
});

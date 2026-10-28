import { AppError } from '@aiops-lms/common/errors';

import { DeleteBindingUseCase } from '../../src/application/use-cases/bindings/delete-binding.use-case.js';
import { GetBindingUseCase } from '../../src/application/use-cases/bindings/get-binding.use-case.js';
import { ListBindingsUseCase } from '../../src/application/use-cases/bindings/list-bindings.use-case.js';
import { UpsertBindingUseCase } from '../../src/application/use-cases/bindings/upsert-binding.use-case.js';
import { CreateModelUseCase } from '../../src/application/use-cases/models/create-model.use-case.js';
import { DeleteModelUseCase } from '../../src/application/use-cases/models/delete-model.use-case.js';
import { GetModelUseCase } from '../../src/application/use-cases/models/get-model.use-case.js';
import { ListModelsUseCase } from '../../src/application/use-cases/models/list-models.use-case.js';
import { UpdateModelUseCase } from '../../src/application/use-cases/models/update-model.use-case.js';
import { CreateProviderUseCase } from '../../src/application/use-cases/providers/create-provider.use-case.js';
import type { Model, Provider } from '../../src/domain/ai.js';
import { type World, world } from './fakes.js';

const MISSING = '00000000-0000-4000-8000-0000000000ff';

async function expectError(promise: Promise<unknown>, code: string, status: number): Promise<void> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(AppError);
  expect(error).toMatchObject({ code, status });
}

async function seedProvider(
  w: World,
  name = 'OpenAI',
  status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE',
): Promise<Provider> {
  return new CreateProviderUseCase(w.providers, w.secrets, w.ids).execute({
    name,
    providerType: 'OPENAI',
    baseUrl: null,
    apiKey: 'sk-test-key-0123456789',
    status,
  });
}

async function seedModel(
  w: World,
  providerId: string,
  modelName = 'gpt-4o',
  status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE',
): Promise<Model> {
  return new CreateModelUseCase(w.models, w.providers, w.ids).execute({
    providerId,
    modelName,
    displayName: modelName.toUpperCase(),
    status,
  });
}

describe('model', () => {
  it('create: cần provider tồn tại (404) và tên model duy nhất trong provider (409 AI_MODEL_CONFLICT)', async () => {
    const w = world();
    const provider = await seedProvider(w);
    const create = new CreateModelUseCase(w.models, w.providers, w.ids);

    await expect(seedModel(w, provider.id)).resolves.toMatchObject({
      modelName: 'gpt-4o',
      providerName: 'OpenAI',
      status: 'ACTIVE',
    });
    await expectError(seedModel(w, provider.id), 'AI_MODEL_CONFLICT', 409);
    await expectError(
      create.execute({ providerId: MISSING, modelName: 'x', displayName: 'x', status: 'ACTIVE' }),
      'NOT_FOUND',
      404,
    );
  });

  it('get / list / update / delete', async () => {
    const w = world();
    const provider = await seedProvider(w);
    const a = await seedModel(w, provider.id, 'gpt-4o');
    const b = await seedModel(w, provider.id, 'gpt-4o-mini', 'INACTIVE');

    await expect(new GetModelUseCase(w.models).execute(a.id)).resolves.toMatchObject({ id: a.id });
    await expectError(new GetModelUseCase(w.models).execute(MISSING), 'NOT_FOUND', 404);

    const list = new ListModelsUseCase(w.models);
    expect((await list.execute({ providerId: provider.id }, 1, 20)).total).toBe(2);
    expect((await list.execute({ status: 'INACTIVE' }, 1, 20)).items.map((m) => m.id)).toEqual([
      b.id,
    ]);
    expect((await list.execute({ search: 'MINI' }, 1, 20)).items.map((m) => m.id)).toEqual([b.id]);

    const update = new UpdateModelUseCase(w.models);
    await expect(
      update.execute(b.id, { modelName: 'gpt-4.1-mini', displayName: 'Mini', status: 'ACTIVE' }),
    ).resolves.toMatchObject({ modelName: 'gpt-4.1-mini', status: 'ACTIVE' });
    await expectError(
      update.execute(b.id, { modelName: 'gpt-4o', displayName: 'x', status: 'ACTIVE' }),
      'AI_MODEL_CONFLICT',
      409,
    );
    await expectError(
      update.execute(MISSING, { modelName: 'x', displayName: 'x', status: 'ACTIVE' }),
      'NOT_FOUND',
      404,
    );

    w.models.inUse.add(a.id);
    const remove = new DeleteModelUseCase(w.models);
    await expectError(remove.execute(a.id), 'AI_MODEL_IN_USE', 409);
    await expect(remove.execute(b.id)).resolves.toBeUndefined();
    await expectError(remove.execute(b.id), 'NOT_FOUND', 404);
  });
});

describe('service binding', () => {
  it('upsert: tạo mới (created) rồi thay model (không created); idempotent với cùng model', async () => {
    const w = world();
    const provider = await seedProvider(w);
    const first = await seedModel(w, provider.id, 'gpt-4o');
    const second = await seedModel(w, provider.id, 'gpt-4.1');
    const upsert = new UpsertBindingUseCase(w.bindings, w.models, w.ids);

    const created = await upsert.execute('lesson-synthesis', first.id);
    expect(created).toMatchObject({
      created: true,
      binding: { taskKey: 'lesson-synthesis', modelName: 'gpt-4o' },
    });

    const same = await upsert.execute('lesson-synthesis', first.id);
    expect(same.created).toBe(false);
    expect(same.binding.id).toBe(created.binding.id);

    const replaced = await upsert.execute('lesson-synthesis', second.id);
    expect(replaced).toMatchObject({ created: false, binding: { modelName: 'gpt-4.1' } });
  });

  it('upsert: 404 khi model không tồn tại; 409 AI_REFERENCE_INACTIVE khi model hoặc provider INACTIVE', async () => {
    const w = world();
    const active = await seedProvider(w, 'Active');
    const inactive = await seedProvider(w, 'Inactive', 'INACTIVE');
    const inactiveModel = await seedModel(w, active.id, 'm1', 'INACTIVE');
    const modelOfInactiveProvider = await seedModel(w, inactive.id, 'm2');
    const upsert = new UpsertBindingUseCase(w.bindings, w.models, w.ids);

    await expectError(upsert.execute('quiz-authoring', MISSING), 'NOT_FOUND', 404);
    await expectError(
      upsert.execute('quiz-authoring', inactiveModel.id),
      'AI_REFERENCE_INACTIVE',
      409,
    );
    await expectError(
      upsert.execute('quiz-authoring', modelOfInactiveProvider.id),
      'AI_REFERENCE_INACTIVE',
      409,
    );
  });

  it('list / get / delete', async () => {
    const w = world();
    const provider = await seedProvider(w);
    const model = await seedModel(w, provider.id);
    const upsert = new UpsertBindingUseCase(w.bindings, w.models, w.ids);
    await upsert.execute('quiz-authoring', model.id);
    await upsert.execute('document-extraction', model.id);

    expect((await new ListBindingsUseCase(w.bindings).execute()).map((b) => b.taskKey)).toEqual([
      'document-extraction',
      'quiz-authoring',
    ]);
    await expect(
      new GetBindingUseCase(w.bindings).execute('quiz-authoring'),
    ).resolves.toMatchObject({
      providerName: 'OpenAI',
    });
    await expectError(
      new GetBindingUseCase(w.bindings).execute('lesson-synthesis'),
      'NOT_FOUND',
      404,
    );

    const remove = new DeleteBindingUseCase(w.bindings);
    await expect(remove.execute('quiz-authoring')).resolves.toBeUndefined();
    await expectError(remove.execute('quiz-authoring'), 'NOT_FOUND', 404);
  });
});

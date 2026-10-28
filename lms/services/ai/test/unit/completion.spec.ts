import { AppError } from '@aiops-lms/common/errors';

import { ProviderCallError } from '../../src/application/ports/provider-client.js';
import {
  type CompletionInput,
  CreateCompletionUseCase,
} from '../../src/application/use-cases/completions/create-completion.use-case.js';
import { UpsertBindingUseCase } from '../../src/application/use-cases/bindings/upsert-binding.use-case.js';
import { CreateModelUseCase } from '../../src/application/use-cases/models/create-model.use-case.js';
import { CreateProviderUseCase } from '../../src/application/use-cases/providers/create-provider.use-case.js';
import { type World, world } from './fakes.js';

const KEY = 'sk-test-key-0123456789';
const input: CompletionInput = {
  task: 'lesson-synthesis',
  messages: [{ role: 'user', text: 'Viết bài học' }],
  tools: [],
};

async function configured(
  w: World,
  options: { providerStatus?: 'ACTIVE' | 'INACTIVE'; modelStatus?: 'ACTIVE' | 'INACTIVE' } = {},
): Promise<CreateCompletionUseCase> {
  const provider = await new CreateProviderUseCase(w.providers, w.secrets, w.ids).execute({
    name: 'OpenAI',
    providerType: 'OPENAI',
    baseUrl: 'http://provider.invalid/v1',
    apiKey: KEY,
    status: 'ACTIVE',
  });
  const model = await new CreateModelUseCase(w.models, w.providers, w.ids).execute({
    providerId: provider.id,
    modelName: 'gpt-4o',
    displayName: 'GPT-4o',
    status: 'ACTIVE',
  });
  await new UpsertBindingUseCase(w.bindings, w.models, w.ids).execute('lesson-synthesis', model.id);
  // Sau khi gán, đổi trạng thái để kiểm tra phía completion.
  if (options.providerStatus) {
    const stored = w.providers.rows.get(provider.id);
    if (stored) w.providers.rows.set(provider.id, { ...stored, status: options.providerStatus });
  }
  if (options.modelStatus) {
    const stored = w.models.rows.get(model.id);
    if (stored) w.models.rows.set(model.id, { ...stored, status: options.modelStatus });
  }
  return new CreateCompletionUseCase(w.bindings, w.secrets, w.chat, w.invocations, w.clock, w.ids);
}

async function failureOf(promise: Promise<unknown>): Promise<AppError> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(AppError);
  return error as AppError;
}

describe('CreateCompletionUseCase', () => {
  it('thành công: giải mã key chỉ để gọi provider, trả kết quả và ghi nhật ký không có nội dung message', async () => {
    const w = world();
    w.chat.outcome = {
      text: null,
      toolCalls: [{ id: 'call_1', name: 'save', argumentsJson: '{"a":1}' }],
      finishReason: 'tool_calls',
      promptTokens: 100,
      completionTokens: 40,
    };

    const completion = await (await configured(w)).execute(input);

    expect(completion).toMatchObject({
      task: 'lesson-synthesis',
      providerType: 'OPENAI',
      modelName: 'gpt-4o',
      finishReason: 'tool_calls',
      toolCalls: [{ id: 'call_1', name: 'save', argumentsJson: '{"a":1}' }],
    });
    expect(w.chat.requests[0]).toMatchObject({
      apiKey: KEY,
      baseUrl: 'http://provider.invalid/v1',
      modelName: 'gpt-4o',
    });
    expect(w.invocations.rows).toHaveLength(1);
    expect(w.invocations.rows[0]).toMatchObject({
      taskKey: 'lesson-synthesis',
      status: 'SUCCESS',
      errorCode: null,
      promptTokens: 100,
      completionTokens: 40,
      toolCallCount: 1,
    });
    expect(JSON.stringify(w.invocations.rows)).not.toContain(KEY);
    expect(JSON.stringify(w.invocations.rows)).not.toContain('Viết bài học');
  });

  it('chưa gán model: 409 AI_TASK_NOT_CONFIGURED và không gọi provider', async () => {
    const w = world();
    const useCase = new CreateCompletionUseCase(
      w.bindings,
      w.secrets,
      w.chat,
      w.invocations,
      w.clock,
      w.ids,
    );

    const error = await failureOf(useCase.execute(input));

    expect(error).toMatchObject({ code: 'AI_TASK_NOT_CONFIGURED', status: 409 });
    expect(w.chat.requests).toHaveLength(0);
  });

  it('model hoặc provider INACTIVE: 409 AI_REFERENCE_INACTIVE', async () => {
    const modelOff = world();
    expect(
      await failureOf((await configured(modelOff, { modelStatus: 'INACTIVE' })).execute(input)),
    ).toMatchObject({
      code: 'AI_REFERENCE_INACTIVE',
      status: 409,
    });
    const providerOff = world();
    expect(
      await failureOf(
        (await configured(providerOff, { providerStatus: 'INACTIVE' })).execute(input),
      ),
    ).toMatchObject({
      code: 'AI_REFERENCE_INACTIVE',
    });
    expect(modelOff.chat.requests).toHaveLength(0);
  });

  it('key lưu không giải mã được: 409 AI_PROVIDER_KEY_UNREADABLE, không gọi provider', async () => {
    const w = world();
    const useCase = await configured(w);
    w.secrets.unreadable = true;

    expect(await failureOf(useCase.execute(input))).toMatchObject({
      code: 'AI_PROVIDER_KEY_UNREADABLE',
      status: 409,
    });
    expect(w.chat.requests).toHaveLength(0);
  });

  it.each([
    ['auth-failed', 401, 502, 'AI_PROVIDER_ERROR', 'AUTH_FAILED'],
    ['rate-limited', 429, 502, 'AI_PROVIDER_ERROR', 'RATE_LIMITED'],
    ['invalid-response', 200, 502, 'AI_PROVIDER_ERROR', 'INVALID_RESPONSE'],
    ['upstream-error', 503, 502, 'AI_PROVIDER_ERROR', 'UPSTREAM_ERROR'],
  ] as const)(
    'provider %s: %i -> %i %s (%s), ghi nhật ký FAILED',
    async (kind, upstream, status, code, reason) => {
      const w = world();
      const useCase = await configured(w);
      w.chat.outcome = new ProviderCallError(kind, upstream);

      const error = await failureOf(useCase.execute(input));

      expect(error).toMatchObject({ code, status, details: { reason, upstream_status: upstream } });
      expect(w.invocations.rows[0]).toMatchObject({ status: 'FAILED', errorCode: code });
    },
  );

  it('provider từ chối request: 422 AI_PROVIDER_REJECTED_REQUEST kèm thông điệp đã làm sạch', async () => {
    const w = world();
    const useCase = await configured(w);
    w.chat.outcome = new ProviderCallError('rejected', 400, 'model does not support tools');

    const error = await failureOf(useCase.execute(input));

    expect(error).toMatchObject({ code: 'AI_PROVIDER_REJECTED_REQUEST', status: 422 });
    expect(error.message).toContain('model does not support tools');
    expect(w.invocations.rows[0]).toMatchObject({
      status: 'FAILED',
      errorCode: 'AI_PROVIDER_REJECTED_REQUEST',
    });
  });

  it('timeout và lỗi kết nối giữ nguyên mã DEPENDENCY_TIMEOUT / DEPENDENCY_UNAVAILABLE và được ghi nhật ký', async () => {
    const w = world();
    const useCase = await configured(w);

    w.chat.outcome = AppError.dependencyTimeout('ai-llm-provider');
    expect(await failureOf(useCase.execute(input))).toMatchObject({
      code: 'DEPENDENCY_TIMEOUT',
      status: 504,
    });
    w.chat.outcome = AppError.dependencyUnavailable('ai-llm-provider');
    expect(await failureOf(useCase.execute(input))).toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
      status: 503,
    });

    expect(w.invocations.rows.map((row) => row.errorCode)).toEqual([
      'DEPENDENCY_TIMEOUT',
      'DEPENDENCY_UNAVAILABLE',
    ]);
  });

  it('lỗi ghi nhật ký không làm mất kết quả đã có từ model', async () => {
    const w = world();
    const useCase = await configured(w);
    w.invocations.failWrites = true;

    await expect(useCase.execute(input)).resolves.toMatchObject({ text: 'xin chào' });
  });
});

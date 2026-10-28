import { AppError, ERROR_CODES } from '@aiops-lms/common/errors';
import type { Clock, IdGenerator } from '@aiops-lms/common/ports';

import type { ProviderKind, TaskKey } from '../../../domain/ai.js';
import { aiErrors } from '../../../domain/errors.js';
import {
  type ChatClient,
  type ChatMessage,
  type ChatResult,
  type ChatTool,
  ProviderCallError,
} from '../../ports/provider-client.js';
import type { BindingRepository, InvocationRepository } from '../../ports/repositories.js';
import type { SecretProtector } from '../../ports/secret-protector.js';
import { SecretUnreadableError } from '../../ports/secret-protector.js';

export interface CompletionInput {
  task: TaskKey;
  messages: ChatMessage[];
  tools: ChatTool[];
}

export interface Completion extends ChatResult {
  task: TaskKey;
  providerType: ProviderKind;
  modelName: string;
  latencyMs: number;
}

/** Chuyển lỗi HTTP của provider thành lỗi contract; không mang API key hay host của provider. */
function toAppError(error: ProviderCallError): AppError {
  switch (error.kind) {
    case 'auth-failed':
      return aiErrors.providerError('AUTH_FAILED', error.upstreamStatus);
    case 'rate-limited':
      return aiErrors.providerError('RATE_LIMITED', error.upstreamStatus);
    case 'invalid-response':
      return aiErrors.providerError('INVALID_RESPONSE', error.upstreamStatus);
    case 'upstream-error':
      return aiErrors.providerError('UPSTREAM_ERROR', error.upstreamStatus);
    case 'rejected':
      return aiErrors.providerRejectedRequest(error.upstreamStatus ?? 400, error.safeDetail);
  }
}

/**
 * Chạy một lượt chat completion cho một tác vụ: tra binding → giải mã API key trong bộ nhớ → gọi
 * provider đúng một lần (không retry) → ghi `ai_invocations` (cả thành công lẫn thất bại; không lưu
 * nội dung message). `ai` không thực thi tool: model chỉ trả `toolCalls`, caller tự chạy.
 */
export class CreateCompletionUseCase {
  constructor(
    private readonly bindings: BindingRepository,
    private readonly secrets: SecretProtector,
    private readonly chat: ChatClient,
    private readonly invocations: InvocationRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: CompletionInput): Promise<Completion> {
    const target = await this.bindings.findTarget(input.task);
    if (!target) throw aiErrors.taskNotConfigured(input.task);
    if (target.model.status !== 'ACTIVE') throw aiErrors.referenceInactive('Model');
    if (target.provider.status !== 'ACTIVE') throw aiErrors.referenceInactive('Provider');

    let apiKey: string;
    try {
      apiKey = this.secrets.decrypt(target.provider.apiKeyEncrypted);
    } catch (error) {
      if (error instanceof SecretUnreadableError) throw aiErrors.providerKeyUnreadable();
      throw error;
    }

    const started = this.clock.now().getTime();
    const latency = (): number => Math.max(0, this.clock.now().getTime() - started);
    const record = (
      status: 'SUCCESS' | 'FAILED',
      errorCode: string | null,
      result?: ChatResult,
    ): Promise<void> =>
      this.invocations.record({
        id: this.ids.next(),
        taskKey: input.task,
        modelId: target.model.id,
        providerType: target.provider.providerType,
        modelName: target.model.modelName,
        status,
        errorCode,
        promptTokens: result?.promptTokens ?? 0,
        completionTokens: result?.completionTokens ?? 0,
        toolCallCount: result?.toolCalls.length ?? 0,
        latencyMs: latency(),
        createdAt: this.clock.now(),
      });

    let result: ChatResult;
    try {
      result = await this.chat.complete({
        providerType: target.provider.providerType,
        baseUrl: target.provider.baseUrl,
        apiKey,
        modelName: target.model.modelName,
        messages: input.messages,
        tools: input.tools,
      });
    } catch (error) {
      if (error instanceof ProviderCallError) {
        const mapped = toAppError(error);
        await this.recordQuietly(record('FAILED', mapped.code));
        throw mapped;
      }
      if (
        error instanceof AppError &&
        (error.code === ERROR_CODES.dependencyTimeout ||
          error.code === ERROR_CODES.dependencyUnavailable)
      ) {
        await this.recordQuietly(record('FAILED', error.code));
      }
      throw error;
    }

    const latencyMs = latency();
    await this.recordQuietly(record('SUCCESS', null, result));
    return {
      ...result,
      task: input.task,
      providerType: target.provider.providerType,
      modelName: target.model.modelName,
      latencyMs,
    };
  }

  /** Ghi nhật ký lỗi không được làm mất kết quả đã có từ model. */
  private async recordQuietly(write: Promise<void>): Promise<void> {
    try {
      await write;
    } catch {
      // Nhật ký là phụ; lỗi ghi không che kết quả hay lỗi gốc của provider.
    }
  }
}

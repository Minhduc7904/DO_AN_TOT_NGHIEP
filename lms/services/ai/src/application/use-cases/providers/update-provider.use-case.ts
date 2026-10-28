import {
  type AiStatus,
  apiKeyHint,
  type Provider,
  type ProviderKind,
  resolveBaseUrl,
} from '../../../domain/ai.js';
import { aiErrors } from '../../../domain/errors.js';
import type { ProviderRepository } from '../../ports/repositories.js';
import type { SecretProtector } from '../../ports/secret-protector.js';

export interface UpdateProviderInput {
  name: string;
  providerType: ProviderKind;
  baseUrl: string | null | undefined;
  /** Bỏ trống = giữ API key hiện có. */
  apiKey?: string | undefined;
  status: AiStatus;
}

export class UpdateProviderUseCase {
  constructor(
    private readonly providers: ProviderRepository,
    private readonly secrets: SecretProtector,
  ) {}

  async execute(id: string, input: UpdateProviderInput): Promise<Provider> {
    if (!(await this.providers.findById(id))) throw aiErrors.providerNotFound();
    if (await this.providers.nameTaken(input.name, id)) throw aiErrors.providerNameConflict();
    const updated = await this.providers.update(id, {
      name: input.name,
      providerType: input.providerType,
      baseUrl: resolveBaseUrl(input.providerType, input.baseUrl),
      status: input.status,
      ...(input.apiKey === undefined
        ? {}
        : {
            apiKeyEncrypted: this.secrets.encrypt(input.apiKey),
            apiKeyHint: apiKeyHint(input.apiKey),
          }),
    });
    if (updated === 'conflict') throw aiErrors.providerNameConflict();
    if (!updated) throw aiErrors.providerNotFound();
    return updated;
  }
}

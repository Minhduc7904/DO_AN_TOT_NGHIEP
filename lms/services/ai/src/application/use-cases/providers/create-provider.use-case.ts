import type { IdGenerator } from '@aiops-lms/common/ports';

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

export interface CreateProviderInput {
  name: string;
  providerType: ProviderKind;
  baseUrl: string | null | undefined;
  apiKey: string;
  status: AiStatus;
}

export class CreateProviderUseCase {
  constructor(
    private readonly providers: ProviderRepository,
    private readonly secrets: SecretProtector,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: CreateProviderInput): Promise<Provider> {
    if (await this.providers.nameTaken(input.name)) throw aiErrors.providerNameConflict();
    const created = await this.providers.create({
      id: this.ids.next(),
      name: input.name,
      providerType: input.providerType,
      baseUrl: resolveBaseUrl(input.providerType, input.baseUrl),
      apiKeyEncrypted: this.secrets.encrypt(input.apiKey),
      apiKeyHint: apiKeyHint(input.apiKey),
      status: input.status,
    });
    if (!created) throw aiErrors.providerNameConflict();
    return created;
  }
}

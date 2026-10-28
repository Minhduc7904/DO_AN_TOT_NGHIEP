import type { IdGenerator } from '@aiops-lms/common/ports';

import type { AiStatus, Model } from '../../../domain/ai.js';
import { aiErrors } from '../../../domain/errors.js';
import type { ModelRepository, ProviderRepository } from '../../ports/repositories.js';

export interface CreateModelInput {
  providerId: string;
  modelName: string;
  displayName: string;
  status: AiStatus;
}

export class CreateModelUseCase {
  constructor(
    private readonly models: ModelRepository,
    private readonly providers: ProviderRepository,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: CreateModelInput): Promise<Model> {
    if (!(await this.providers.findById(input.providerId))) throw aiErrors.providerNotFound();
    const created = await this.models.create({ id: this.ids.next(), ...input });
    if (!created) throw aiErrors.modelConflict();
    return created;
  }
}

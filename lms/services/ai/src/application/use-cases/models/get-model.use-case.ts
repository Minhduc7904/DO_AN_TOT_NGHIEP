import type { Model } from '../../../domain/ai.js';
import { aiErrors } from '../../../domain/errors.js';
import type { ModelRepository } from '../../ports/repositories.js';

export class GetModelUseCase {
  constructor(private readonly models: ModelRepository) {}

  async execute(id: string): Promise<Model> {
    const model = await this.models.findById(id);
    if (!model) throw aiErrors.modelNotFound();
    return model;
  }
}

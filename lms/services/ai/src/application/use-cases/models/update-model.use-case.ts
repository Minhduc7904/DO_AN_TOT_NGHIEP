import type { Model } from '../../../domain/ai.js';
import { aiErrors } from '../../../domain/errors.js';
import type { ModelPatch, ModelRepository } from '../../ports/repositories.js';

export class UpdateModelUseCase {
  constructor(private readonly models: ModelRepository) {}

  async execute(id: string, patch: ModelPatch): Promise<Model> {
    const updated = await this.models.update(id, patch);
    if (updated === 'conflict') throw aiErrors.modelConflict();
    if (!updated) throw aiErrors.modelNotFound();
    return updated;
  }
}

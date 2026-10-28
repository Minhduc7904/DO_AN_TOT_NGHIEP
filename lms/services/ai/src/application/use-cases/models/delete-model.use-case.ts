import { aiErrors } from '../../../domain/errors.js';
import type { ModelRepository } from '../../ports/repositories.js';

export class DeleteModelUseCase {
  constructor(private readonly models: ModelRepository) {}

  async execute(id: string): Promise<void> {
    const outcome = await this.models.delete(id);
    if (outcome === 'not-found') throw aiErrors.modelNotFound();
    if (outcome === 'in-use') throw aiErrors.modelInUse();
  }
}

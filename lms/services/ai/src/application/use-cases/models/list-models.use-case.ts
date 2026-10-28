import type { Model } from '../../../domain/ai.js';
import type { ModelFilter, ModelRepository, Paged } from '../../ports/repositories.js';

export class ListModelsUseCase {
  constructor(private readonly models: ModelRepository) {}

  execute(filter: ModelFilter, page: number, pageSize: number): Promise<Paged<Model>> {
    return this.models.list(filter, page, pageSize);
  }
}

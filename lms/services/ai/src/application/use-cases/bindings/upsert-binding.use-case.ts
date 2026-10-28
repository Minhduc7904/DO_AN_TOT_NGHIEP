import type { IdGenerator } from '@aiops-lms/common/ports';

import type { ServiceBinding, TaskKey } from '../../../domain/ai.js';
import { aiErrors } from '../../../domain/errors.js';
import type { BindingRepository, ModelRepository } from '../../ports/repositories.js';

export class UpsertBindingUseCase {
  constructor(
    private readonly bindings: BindingRepository,
    private readonly models: ModelRepository,
    private readonly ids: IdGenerator,
  ) {}

  /** Idempotent: gán lại cùng model không đổi kết quả. `created` = binding mới (201), ngược lại 200. */
  async execute(
    taskKey: TaskKey,
    modelId: string,
  ): Promise<{ binding: ServiceBinding; created: boolean }> {
    const model = await this.models.findById(modelId);
    if (!model) throw aiErrors.modelNotFound();
    if (model.status !== 'ACTIVE') throw aiErrors.referenceInactive('Model');
    if (model.providerStatus !== 'ACTIVE') throw aiErrors.referenceInactive('Provider của model');
    return this.bindings.upsert(this.ids.next(), taskKey, modelId);
  }
}

import type { ServiceBinding, TaskKey } from '../../../domain/ai.js';
import { aiErrors } from '../../../domain/errors.js';
import type { BindingRepository } from '../../ports/repositories.js';

export class GetBindingUseCase {
  constructor(private readonly bindings: BindingRepository) {}

  async execute(taskKey: TaskKey): Promise<ServiceBinding> {
    const binding = await this.bindings.findByTask(taskKey);
    if (!binding) throw aiErrors.bindingNotFound();
    return binding;
  }
}

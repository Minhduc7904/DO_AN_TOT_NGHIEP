import type { TaskKey } from '../../../domain/ai.js';
import { aiErrors } from '../../../domain/errors.js';
import type { BindingRepository } from '../../ports/repositories.js';

export class DeleteBindingUseCase {
  constructor(private readonly bindings: BindingRepository) {}

  async execute(taskKey: TaskKey): Promise<void> {
    if (!(await this.bindings.delete(taskKey))) throw aiErrors.bindingNotFound();
  }
}

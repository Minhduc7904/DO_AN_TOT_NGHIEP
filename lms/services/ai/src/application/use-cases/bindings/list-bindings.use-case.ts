import type { ServiceBinding } from '../../../domain/ai.js';
import type { BindingRepository } from '../../ports/repositories.js';

export class ListBindingsUseCase {
  constructor(private readonly bindings: BindingRepository) {}

  execute(): Promise<ServiceBinding[]> {
    return this.bindings.list();
  }
}

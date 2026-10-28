import { aiErrors } from '../../../domain/errors.js';
import type { ProviderRepository } from '../../ports/repositories.js';

export class DeleteProviderUseCase {
  constructor(private readonly providers: ProviderRepository) {}

  async execute(id: string): Promise<void> {
    const outcome = await this.providers.delete(id);
    if (outcome === 'not-found') throw aiErrors.providerNotFound();
    if (outcome === 'in-use') throw aiErrors.providerInUse();
  }
}

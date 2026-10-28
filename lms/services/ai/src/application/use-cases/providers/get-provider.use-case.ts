import type { Provider } from '../../../domain/ai.js';
import { aiErrors } from '../../../domain/errors.js';
import type { ProviderRepository } from '../../ports/repositories.js';

export class GetProviderUseCase {
  constructor(private readonly providers: ProviderRepository) {}

  async execute(id: string): Promise<Provider> {
    const provider = await this.providers.findById(id);
    if (!provider) throw aiErrors.providerNotFound();
    return provider;
  }
}

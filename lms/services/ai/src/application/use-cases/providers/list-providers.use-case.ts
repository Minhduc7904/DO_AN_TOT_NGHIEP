import type { Provider } from '../../../domain/ai.js';
import type { Paged, ProviderFilter, ProviderRepository } from '../../ports/repositories.js';

export class ListProvidersUseCase {
  constructor(private readonly providers: ProviderRepository) {}

  execute(filter: ProviderFilter, page: number, pageSize: number): Promise<Paged<Provider>> {
    return this.providers.list(filter, page, pageSize);
  }
}

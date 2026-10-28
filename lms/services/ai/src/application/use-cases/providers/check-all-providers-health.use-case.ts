import type { ProviderRepository } from '../../ports/repositories.js';
import type { ProviderHealth, ProviderHealthChecker } from './provider-health-checker.js';

export class CheckAllProvidersHealthUseCase {
  constructor(
    private readonly providers: ProviderRepository,
    private readonly checker: ProviderHealthChecker,
  ) {}

  async execute(): Promise<ProviderHealth[]> {
    const all = await this.providers.listCredentials();
    return Promise.all(all.map((provider) => this.checker.check(provider)));
  }
}

import { aiErrors } from '../../../domain/errors.js';
import type { ProviderRepository } from '../../ports/repositories.js';
import type { ProviderHealth, ProviderHealthChecker } from './provider-health-checker.js';

export class CheckProviderHealthUseCase {
  constructor(
    private readonly providers: ProviderRepository,
    private readonly checker: ProviderHealthChecker,
  ) {}

  async execute(id: string): Promise<ProviderHealth> {
    const provider = await this.providers.findCredentialById(id);
    if (!provider) throw aiErrors.providerNotFound();
    return this.checker.check(provider);
  }
}

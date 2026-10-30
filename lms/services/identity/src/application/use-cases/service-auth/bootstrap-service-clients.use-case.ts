import { hashPassword, verifyPassword } from '../../../domain/password.js';
import type { ServiceClientRepository } from '../../ports/service-client-repository.js';

export interface BootstrapServiceClient {
  clientId: string;
  clientSecret: string;
  audiences: readonly string[];
  scopes: readonly string[];
}

/**
 * Đồng bộ registry client từ cấu hình khởi động. Chỉ ghi khi client chưa có hoặc đã đổi
 * secret/audience/scope, nên khởi động lại không làm đổi băm vô ích.
 */
export class BootstrapServiceClientsUseCase {
  constructor(private readonly clients: ServiceClientRepository) {}

  async execute(inputs: readonly BootstrapServiceClient[]): Promise<{ written: string[] }> {
    const written: string[] = [];
    for (const input of inputs) {
      const existing = await this.clients.findById(input.clientId);
      const unchanged =
        existing !== null &&
        existing.active &&
        same(existing.allowedAudiences, input.audiences) &&
        same(existing.allowedScopes, input.scopes) &&
        (await verifyPassword(input.clientSecret, existing.secretHash));
      if (unchanged) continue;
      await this.clients.upsert({
        clientId: input.clientId,
        secretHash: await hashPassword(input.clientSecret),
        allowedAudiences: [...input.audiences],
        allowedScopes: [...input.scopes],
        active: true,
      });
      written.push(input.clientId);
    }
    return { written };
  }
}

function same(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && [...left].sort().join() === [...right].sort().join();
}

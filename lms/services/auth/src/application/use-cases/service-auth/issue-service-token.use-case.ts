import { AppError } from '@aiops-lms/common/errors';

import { verifyPassword } from '../../../domain/password.js';
import { grantScopes } from '../../../domain/service-client.js';
import type { ServiceClientRepository } from '../../ports/service-client-repository.js';
import type { TokenSigner } from '../../ports/token-signer.js';

export interface IssueServiceTokenInput {
  clientId: string;
  clientSecret: string;
  audience: string;
  scope?: string | undefined;
}

export interface ServiceTokenGrantResult {
  accessToken: string;
  expiresInSeconds: number;
  scope: string;
}

// Băm giả để so sánh khi client không tồn tại: thời gian phản hồi không lộ client nào có thật.
const UNKNOWN_CLIENT_HASH = 'scrypt$AAAAAAAAAAAAAAAAAAAAAA$AAAA';

/** Xác thực dịch vụ kiểu client-credentials: kiểm secret, audience, scope rồi ký service token. */
export class IssueServiceTokenUseCase {
  constructor(
    private readonly clients: ServiceClientRepository,
    private readonly signer: TokenSigner,
    private readonly ttlSeconds: number,
  ) {}

  async execute(input: IssueServiceTokenInput): Promise<ServiceTokenGrantResult> {
    const client = await this.clients.findById(input.clientId);
    const secretMatches = await verifyPassword(
      input.clientSecret,
      client?.secretHash ?? UNKNOWN_CLIENT_HASH,
    );
    if (!client || !client.active || !secretMatches) throw AppError.serviceClientInvalid();

    const grant = grantScopes(client, input.audience, input.scope);
    if (!grant.granted) {
      throw AppError.serviceScopeForbidden(input.scope?.split(/\s+/u).filter(Boolean) ?? []);
    }
    return {
      accessToken: this.signer.signServiceToken({
        subject: client.clientId,
        audience: input.audience,
        scopes: grant.scopes,
        expiresInSeconds: this.ttlSeconds,
      }),
      expiresInSeconds: this.ttlSeconds,
      scope: grant.scopes.join(' '),
    };
  }
}

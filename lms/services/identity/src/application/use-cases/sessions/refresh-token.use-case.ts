import { AppError } from '@aiops-lms/common/errors';

import { hashRefreshToken } from '../../../domain/token.js';
import type { RefreshTokenRepository } from '../../ports/refresh-token-repository.js';
import type { TokenIssuer, TokenPair } from '../../token-issuer.js';

export class RefreshTokenUseCase {
  constructor(
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly tokens: TokenIssuer,
  ) {}

  async execute(refreshToken: string): Promise<TokenPair> {
    const account = await this.refreshTokens.consume(hashRefreshToken(refreshToken));
    if (!account || account.status !== 'ACTIVE') {
      throw AppError.unauthorized('Refresh token không hợp lệ hoặc đã hết hạn');
    }
    return this.tokens.issue(account);
  }
}

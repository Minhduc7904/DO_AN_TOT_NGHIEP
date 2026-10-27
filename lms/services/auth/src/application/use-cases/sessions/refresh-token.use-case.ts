import { AppError } from '@aiops-lms/common/errors';

import { hashRefreshToken } from '../../../domain/token.js';
import type { RefreshTokenRepository } from '../../ports/refresh-token-repository.js';
import type { TokenSettings } from '../../token-settings.js';
import { issueTokenPair, type TokenPair } from './issue-token-pair.js';

export class RefreshTokenUseCase {
  constructor(
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly settings: TokenSettings,
  ) {}

  async execute(refreshToken: string): Promise<TokenPair> {
    const account = await this.refreshTokens.consume(hashRefreshToken(refreshToken));
    if (!account || account.status !== 'ACTIVE') {
      throw AppError.unauthorized('Refresh token không hợp lệ hoặc đã hết hạn');
    }
    return issueTokenPair(account, this.settings, this.refreshTokens);
  }
}

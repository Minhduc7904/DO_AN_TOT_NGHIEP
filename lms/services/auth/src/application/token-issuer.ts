import type { Account } from '../domain/account.js';
import { createRefreshToken, hashRefreshToken } from '../domain/token.js';
import type { RefreshTokenRepository } from './ports/refresh-token-repository.js';
import type { TokenSigner } from './ports/token-signer.js';
import type { TokenSettings } from './token-settings.js';

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in_seconds: number;
}

/** Cấp user access token (EdDSA) cùng refresh token mới; refresh token chỉ lưu dạng băm. */
export class TokenIssuer {
  constructor(
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly signer: TokenSigner,
    private readonly settings: TokenSettings,
  ) {}

  async issue(account: Account): Promise<TokenPair> {
    const refreshToken = createRefreshToken();
    await this.refreshTokens.save(
      account.id,
      hashRefreshToken(refreshToken),
      new Date(Date.now() + this.settings.refreshTtlSeconds * 1_000),
    );
    return {
      access_token: this.signer.signUserToken({
        subject: account.id,
        role: account.role,
        expiresInSeconds: this.settings.jwtTtlSeconds,
      }),
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in_seconds: this.settings.jwtTtlSeconds,
    };
  }
}

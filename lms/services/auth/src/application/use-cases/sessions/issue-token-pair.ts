import { createAccessToken, createRefreshToken, hashRefreshToken } from '../../../domain/token.js';
import type { Account } from '../../../domain/account.js';
import type { RefreshTokenRepository } from '../../ports/refresh-token-repository.js';
import type { TokenSettings } from '../../token-settings.js';

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in_seconds: number;
}

/** Cấp access token (JWT HS256) và refresh token mới, lưu băm của refresh token. */
export async function issueTokenPair(
  account: Account,
  settings: TokenSettings,
  refreshTokens: RefreshTokenRepository,
): Promise<TokenPair> {
  const refreshToken = createRefreshToken();
  await refreshTokens.save(
    account.id,
    hashRefreshToken(refreshToken),
    new Date(Date.now() + settings.refreshTtlSeconds * 1_000),
  );
  return {
    access_token: createAccessToken(
      account.id,
      account.role,
      settings.jwtSecret,
      settings.jwtTtlSeconds,
    ),
    refresh_token: refreshToken,
    token_type: 'Bearer',
    expires_in_seconds: settings.jwtTtlSeconds,
  };
}

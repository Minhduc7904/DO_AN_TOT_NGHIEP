export interface TokenSettings {
  /** TTL của user access token. */
  jwtTtlSeconds: number;
  refreshTtlSeconds: number;
  /** TTL của service access token (không có refresh token; lấy lại bằng client-credentials). */
  serviceTokenTtlSeconds: number;
}

export const TOKEN_SETTINGS = Symbol('TokenSettings');

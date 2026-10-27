export interface TokenSettings {
  jwtSecret: string;
  jwtTtlSeconds: number;
  refreshTtlSeconds: number;
}

export const TOKEN_SETTINGS = Symbol('TokenSettings');

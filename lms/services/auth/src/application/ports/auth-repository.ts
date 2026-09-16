export interface AuthUser {
  email: string;
  id: string;
  passwordHash: string;
  role: string;
}

export interface RefreshTokenRecord {
  expiresAt: Date;
  id: string;
  tokenHash: string;
  user: AuthUser;
}

export abstract class AuthRepository {
  abstract consumeRefreshToken(tokenHash: string): Promise<AuthUser | null>;
  abstract createRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  abstract findUserByEmail(email: string): Promise<AuthUser | null>;
}

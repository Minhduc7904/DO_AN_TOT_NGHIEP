import type { Account } from '../../domain/account.js';

export interface RefreshTokenRepository {
  save(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  /** Xóa token còn hạn và trả tài khoản chủ sở hữu; `null` nếu không có hoặc đã hết hạn. */
  consume(tokenHash: string): Promise<Account | null>;
}

export const REFRESH_TOKEN_REPOSITORY = Symbol('RefreshTokenRepository');

import { AppError } from '@aiops-lms/common/errors';

import { hashPassword, verifyPassword } from '../../../domain/password.js';
import type { Account } from '../../../domain/account.js';
import type { AccountRepository } from '../../ports/account-repository.js';
import type { RefreshTokenRepository } from '../../ports/refresh-token-repository.js';
import type { TokenSettings } from '../../token-settings.js';
import { issueTokenPair, type TokenPair } from './issue-token-pair.js';

export interface LoginResult extends TokenPair {
  principal: { id: string; role: Account['role'] };
}

const INVALID_CREDENTIALS = 'Thông tin đăng nhập không hợp lệ';

export class LoginUseCase {
  // Băm giả để thời gian phản hồi không lộ email có tồn tại hay không.
  private readonly decoyHash = hashPassword('decoy-password-for-timing');

  constructor(
    private readonly accounts: AccountRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly settings: TokenSettings,
  ) {}

  async execute(input: { email: string; password: string }): Promise<LoginResult> {
    const account = await this.accounts.findCredentialsByEmail(input.email.trim().toLowerCase());
    const passwordHash = account?.passwordHash ?? (await this.decoyHash);
    const matches = await verifyPassword(input.password, passwordHash);

    if (!account || !matches || account.status !== 'ACTIVE') {
      throw AppError.unauthorized(INVALID_CREDENTIALS);
    }

    const pair = await issueTokenPair(account, this.settings, this.refreshTokens);
    return { ...pair, principal: { id: account.id, role: account.role } };
  }
}

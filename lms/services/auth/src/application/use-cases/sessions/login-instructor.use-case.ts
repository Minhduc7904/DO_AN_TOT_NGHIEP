import type { RefreshTokenRepository } from '../../ports/refresh-token-repository.js';
import type { TokenSettings } from '../../token-settings.js';
import type { CredentialsAuthenticator } from './credentials-authenticator.js';
import { issueTokenPair } from './issue-token-pair.js';
import type { LoginInput, LoginResult } from './login-result.js';

/** Đăng nhập instructor: chỉ tài khoản role `instructor` đăng nhập được qua cửa này. */
export class LoginInstructorUseCase {
  constructor(
    private readonly authenticator: CredentialsAuthenticator,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly settings: TokenSettings,
  ) {}

  async execute(input: LoginInput): Promise<LoginResult> {
    const account = await this.authenticator.authenticate(input, 'instructor');
    const pair = await issueTokenPair(account, this.settings, this.refreshTokens);
    return { ...pair, principal: { id: account.id, role: account.role } };
  }
}

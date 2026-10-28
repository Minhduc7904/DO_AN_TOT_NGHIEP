import type { RefreshTokenRepository } from '../../ports/refresh-token-repository.js';
import type { TokenSettings } from '../../token-settings.js';
import type { CredentialsAuthenticator } from './credentials-authenticator.js';
import { issueTokenPair } from './issue-token-pair.js';
import type { LoginInput, LoginResult } from './login-result.js';

/** Đăng nhập admin: chỉ tài khoản role `admin` đăng nhập được qua cửa này. */
export class LoginAdminUseCase {
  constructor(
    private readonly authenticator: CredentialsAuthenticator,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly settings: TokenSettings,
  ) {}

  async execute(input: LoginInput): Promise<LoginResult> {
    const account = await this.authenticator.authenticate(input, 'admin');
    const pair = await issueTokenPair(account, this.settings, this.refreshTokens);
    return { ...pair, principal: { id: account.id, role: account.role } };
  }
}

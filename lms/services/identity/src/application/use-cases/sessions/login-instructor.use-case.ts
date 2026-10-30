import type { TokenIssuer } from '../../token-issuer.js';
import type { CredentialsAuthenticator } from './credentials-authenticator.js';
import type { LoginInput, LoginResult } from './login-result.js';

/** Đăng nhập instructor: chỉ tài khoản role `instructor` đăng nhập được qua cửa này. */
export class LoginInstructorUseCase {
  constructor(
    private readonly authenticator: CredentialsAuthenticator,
    private readonly tokens: TokenIssuer,
  ) {}

  async execute(input: LoginInput): Promise<LoginResult> {
    const account = await this.authenticator.authenticate(input, 'instructor');
    const pair = await this.tokens.issue(account);
    return { ...pair, principal: { id: account.id, role: account.role } };
  }
}

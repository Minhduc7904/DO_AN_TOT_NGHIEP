import { AppError } from '@aiops-lms/common/errors';

import type { TokenIssuer } from '../../token-issuer.js';
import type { CredentialsAuthenticator } from './credentials-authenticator.js';
import type { LoginInput, LoginResult } from './login-result.js';

/**
 * Đăng nhập student. Ngoài thông tin đăng nhập còn yêu cầu hồ sơ student `ACTIVE`; hồ sơ nằm
 * cùng DB với tài khoản nên được đọc trong cùng truy vấn xác thực.
 */
export class LoginStudentUseCase {
  constructor(
    private readonly authenticator: CredentialsAuthenticator,
    private readonly tokens: TokenIssuer,
  ) {}

  async execute(input: LoginInput): Promise<LoginResult> {
    const account = await this.authenticator.authenticate(input, 'student');
    if (account.studentStatus !== 'ACTIVE') {
      throw AppError.forbidden('Hồ sơ student không tồn tại hoặc không hoạt động');
    }

    const pair = await this.tokens.issue(account);
    return { ...pair, principal: { id: account.id, role: account.role } };
  }
}

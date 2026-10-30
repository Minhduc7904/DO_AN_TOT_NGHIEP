import { AppError } from '@aiops-lms/common/errors';
import type { Role } from '@aiops-lms/common/ports';

import { hashPassword, verifyPassword } from '../../../domain/password.js';
import type { AccountCredentials } from '../../../domain/account.js';
import type { AccountRepository } from '../../ports/account-repository.js';

export const INVALID_CREDENTIALS = 'Thông tin đăng nhập không hợp lệ';

/**
 * Xác thực email + mật khẩu cho đúng một role. Sai email, sai mật khẩu, tài khoản bị khóa hay
 * đúng mật khẩu nhưng sai role (ví dụ student vào cửa admin) đều trả cùng một lỗi 401 và luôn
 * băm một lần, để phản hồi không lộ tài khoản có tồn tại hay thuộc role nào.
 */
export class CredentialsAuthenticator {
  // Băm giả để thời gian phản hồi không lộ email có tồn tại hay không.
  private readonly decoyHash = hashPassword('decoy-password-for-timing');

  constructor(private readonly accounts: AccountRepository) {}

  async authenticate(
    input: { email: string; password: string },
    role: Role,
  ): Promise<AccountCredentials> {
    const account = await this.accounts.findCredentialsByEmail(input.email.trim().toLowerCase());
    const passwordHash = account?.passwordHash ?? (await this.decoyHash);
    const matches = await verifyPassword(input.password, passwordHash);

    if (!account || !matches || account.status !== 'ACTIVE' || account.role !== role) {
      throw AppError.unauthorized(INVALID_CREDENTIALS);
    }
    return account;
  }
}

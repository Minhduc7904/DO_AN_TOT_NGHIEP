import { AppError } from '@aiops-lms/common/errors';

import type { RefreshTokenRepository } from '../../ports/refresh-token-repository.js';
import type { StudentProfileClient } from '../../ports/student-profile-client.js';
import type { TokenSettings } from '../../token-settings.js';
import type { CredentialsAuthenticator } from './credentials-authenticator.js';
import { issueTokenPair } from './issue-token-pair.js';
import type { LoginInput, LoginResult } from './login-result.js';

/**
 * Đăng nhập student. Ngoài thông tin đăng nhập còn yêu cầu hồ sơ ở `student` tồn tại và `ACTIVE`;
 * student lỗi thì từ chối (503), không cấp token khi chưa kiểm tra được.
 */
export class LoginStudentUseCase {
  constructor(
    private readonly authenticator: CredentialsAuthenticator,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly settings: TokenSettings,
    private readonly students: StudentProfileClient,
  ) {}

  async execute(input: LoginInput): Promise<LoginResult> {
    const account = await this.authenticator.authenticate(input, 'student');

    const profileStatus = await this.students.findStatus(account.id);
    if (profileStatus !== 'ACTIVE') {
      throw AppError.forbidden('Hồ sơ student không tồn tại hoặc không hoạt động');
    }

    const pair = await issueTokenPair(account, this.settings, this.refreshTokens);
    return { ...pair, principal: { id: account.id, role: account.role } };
  }
}

import type { TokenVerifier } from '@aiops-lms/common/auth';
import { AppError } from '@aiops-lms/common/errors';
import { ROLES, type Principal, type Role } from '@aiops-lms/common/ports';
import { USER_TOKEN_AUDIENCE } from '@aiops-lms/contracts/http/common';

import type { UserTokenVerifier } from '../../application/ports/user-token-verifier.js';

/**
 * Verify user token (EdDSA) bằng JWKS của auth. Service token bị `TOKEN_TYPE_MISMATCH`: token
 * của dịch vụ không bao giờ được dùng như danh tính người dùng.
 */
export class JwksUserTokenVerifier implements UserTokenVerifier {
  constructor(private readonly verifier: TokenVerifier) {}

  async verify(token: string): Promise<Principal> {
    const verified = await this.verifier.verify(token, {
      type: 'user',
      audience: USER_TOKEN_AUDIENCE,
    });
    if (!verified.role || !(ROLES as readonly string[]).includes(verified.role)) {
      throw AppError.unauthorized('Bearer JWT không hợp lệ hoặc đã hết hạn');
    }
    return { id: verified.subject, role: verified.role as Role };
  }
}

import type { Principal } from '@aiops-lms/common/ports';

/** Xác thực user access token của client và trả danh tính; ném `AppError` 401 nếu không hợp lệ. */
export interface UserTokenVerifier {
  verify(token: string): Promise<Principal>;
}

export const USER_TOKEN_VERIFIER = Symbol('UserTokenVerifier');

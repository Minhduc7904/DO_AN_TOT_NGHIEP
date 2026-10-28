import type { Jwks } from '@aiops-lms/contracts/http/common';

/** Ký access token; khóa riêng chỉ nằm trong adapter, `jwks()` công bố khóa công khai. */
export interface TokenSigner {
  signUserToken(input: { subject: string; role: string; expiresInSeconds: number }): string;
  signServiceToken(input: {
    subject: string;
    audience: string;
    scopes: readonly string[];
    expiresInSeconds: number;
  }): string;
  jwks(): Jwks;
}

export const TOKEN_SIGNER = Symbol('TokenSigner');

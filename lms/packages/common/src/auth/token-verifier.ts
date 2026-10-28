import { tokenClaimsSchema, TOKEN_ISSUER, type TokenType } from '@aiops-lms/contracts/http/common';

import { AppError } from '../errors/index.js';
import { parseJwt, verifyJwtSignature } from './jwt.js';
import type { KeyProvider } from './keys.js';

export interface VerifiedToken {
  type: TokenType;
  /** `sub`: user id (user token) hoặc tên service (service token). */
  subject: string;
  audiences: readonly string[];
  /** Scope của service token; rỗng với user token. */
  scopes: readonly string[];
  role?: string;
  expiresAt: number;
  tokenId: string;
}

export interface VerifyTokenOptions {
  /** Loại token route này chấp nhận; token loại khác bị `TOKEN_TYPE_MISMATCH`. */
  type: TokenType;
  audience: string;
}

function invalid(type: TokenType): AppError {
  return type === 'service'
    ? AppError.serviceTokenInvalid()
    : AppError.unauthorized('Bearer JWT không hợp lệ hoặc đã hết hạn');
}

/** Verify chữ ký EdDSA qua JWKS rồi kiểm `iss`, `exp`, `typ`, `aud`. Không gọi mạng nếu đã có khóa. */
export class TokenVerifier {
  constructor(
    private readonly keys: KeyProvider,
    private readonly now: () => number = Date.now,
  ) {}

  async verify(token: string, options: VerifyTokenOptions): Promise<VerifiedToken> {
    const parsed = parseJwt(token);
    if (!parsed) throw invalid(options.type);
    const key = await this.keys.getKey(parsed.header.kid);
    if (!key || !verifyJwtSignature(parsed, key)) throw invalid(options.type);

    const claims = tokenClaimsSchema.safeParse(parsed.payload);
    if (
      !claims.success ||
      claims.data.iss !== TOKEN_ISSUER ||
      claims.data.exp <= Math.floor(this.now() / 1_000)
    ) {
      throw invalid(options.type);
    }
    if (claims.data.typ !== options.type) throw AppError.tokenTypeMismatch(options.type);

    const audiences = Array.isArray(claims.data.aud) ? claims.data.aud : [claims.data.aud];
    if (!audiences.includes(options.audience)) throw invalid(options.type);

    const common = {
      type: claims.data.typ,
      subject: claims.data.sub,
      audiences,
      expiresAt: claims.data.exp,
      tokenId: claims.data.jti,
    };
    return claims.data.typ === 'service'
      ? { ...common, scopes: claims.data.scope.split(' ').filter(Boolean) }
      : { ...common, scopes: [], role: claims.data.role };
  }
}

import type { KeyObject } from 'node:crypto';

import {
  computeKid,
  type KeyProvider,
  signJwt,
  type SigningKey,
  StaticKeyProvider,
  toJwk,
} from '@aiops-lms/common/auth';
import { TOKEN_ISSUER, USER_TOKEN_AUDIENCE, type Jwks } from '@aiops-lms/contracts/http/common';

import type { TokenSigner } from '../../application/ports/token-signer.js';

/**
 * Ký token EdDSA bằng khóa hiện tại. `previousPublicKeys` là khóa công khai của khóa cũ: vẫn
 * được công bố trong JWKS để token đã cấp còn hạn không bị từ chối khi xoay khóa.
 */
export class Ed25519TokenSigner implements TokenSigner {
  constructor(
    private readonly current: SigningKey,
    private readonly previousPublicKeys: readonly KeyObject[] = [],
  ) {}

  signUserToken(input: { subject: string; role: string; expiresInSeconds: number }): string {
    return signJwt({
      privateKey: this.current.privateKey,
      kid: this.current.kid,
      expiresInSeconds: input.expiresInSeconds,
      claims: {
        iss: TOKEN_ISSUER,
        typ: 'user',
        sub: input.subject,
        aud: USER_TOKEN_AUDIENCE,
        role: input.role,
      },
    });
  }

  signServiceToken(input: {
    subject: string;
    audience: string;
    scopes: readonly string[];
    expiresInSeconds: number;
  }): string {
    return signJwt({
      privateKey: this.current.privateKey,
      kid: this.current.kid,
      expiresInSeconds: input.expiresInSeconds,
      claims: {
        iss: TOKEN_ISSUER,
        typ: 'service',
        sub: input.subject,
        aud: input.audience,
        scope: input.scopes.join(' '),
      },
    });
  }

  jwks(): Jwks {
    return {
      keys: [this.current.publicKey, ...this.previousPublicKeys].map((key) => toJwk(key)),
    };
  }

  /** Auth tự verify token của chính nó bằng khóa cục bộ, không gọi HTTP tới JWKS của mình. */
  keyProvider(): KeyProvider {
    return new StaticKeyProvider([
      this.current,
      ...this.previousPublicKeys.map((publicKey) => ({ kid: computeKid(publicKey), publicKey })),
    ]);
  }
}

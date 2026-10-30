import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  type KeyObject,
} from 'node:crypto';

import type { Jwk } from '@aiops-lms/contracts/http/common';

export interface SigningKey {
  kid: string;
  privateKey: KeyObject;
  publicKey: KeyObject;
}

/** `kid` là thumbprint (SHA-256, rút gọn) của public key: cùng khóa luôn cho cùng `kid`. */
export function computeKid(publicKey: KeyObject): string {
  const jwk = publicKey.export({ format: 'jwk' });
  const canonical = JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x });
  return createHash('sha256').update(canonical).digest('base64url').slice(0, 16);
}

export function toJwk(publicKey: KeyObject): Jwk {
  const jwk = publicKey.export({ format: 'jwk' });
  return {
    kty: 'OKP',
    crv: 'Ed25519',
    x: String(jwk.x),
    kid: computeKid(publicKey),
    alg: 'EdDSA',
    use: 'sig',
  };
}

export function signingKeyFromPem(pem: string): SigningKey {
  const privateKey = createPrivateKey(pem);
  if (privateKey.asymmetricKeyType !== 'ed25519') {
    throw new Error('IDENTITY_SIGNING_KEY_PEM phải là khóa Ed25519 (PKCS8)');
  }
  const publicKey = createPublicKey(privateKey);
  return { kid: computeKid(publicKey), privateKey, publicKey };
}

export function generateSigningKey(): SigningKey {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return { kid: computeKid(publicKey), privateKey, publicKey };
}

/** Nguồn khóa công khai để verify token theo `kid`. */
export interface KeyProvider {
  getKey(kid: string): Promise<KeyObject | undefined>;
}

/** Nguồn khóa cố định, dùng ở auth (khóa của chính nó) và trong test. */
export class StaticKeyProvider implements KeyProvider {
  private readonly keys = new Map<string, KeyObject>();

  constructor(keys: readonly SigningKey[] | readonly { kid: string; publicKey: KeyObject }[]) {
    for (const key of keys) this.keys.set(key.kid, key.publicKey);
  }

  getKey(kid: string): Promise<KeyObject | undefined> {
    return Promise.resolve(this.keys.get(kid));
  }
}

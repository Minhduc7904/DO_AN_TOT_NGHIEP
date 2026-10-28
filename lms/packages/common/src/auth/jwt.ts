import {
  createPublicKey,
  type KeyObject,
  randomUUID,
  sign as cryptoSign,
  verify as cryptoVerify,
} from 'node:crypto';

/** JWT EdDSA (Ed25519) tối giản: chỉ ký/verify chữ ký và đọc claim thô, không thêm thư viện. */
export interface JwtHeader {
  alg: 'EdDSA';
  typ: 'JWT';
  kid: string;
}

export interface SignJwtOptions {
  privateKey: KeyObject;
  kid: string;
  claims: Record<string, unknown>;
  expiresInSeconds: number;
  now?: number;
}

function encode(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decode(segment: string): unknown {
  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
  } catch {
    return undefined;
  }
}

export function signJwt(options: SignJwtOptions): string {
  const issuedAt = Math.floor((options.now ?? Date.now()) / 1_000);
  const header: JwtHeader = { alg: 'EdDSA', typ: 'JWT', kid: options.kid };
  const payload = {
    jti: randomUUID(),
    ...options.claims,
    iat: issuedAt,
    exp: issuedAt + options.expiresInSeconds,
  };
  const signingInput = `${encode(header)}.${encode(payload)}`;
  const signature = cryptoSign(null, Buffer.from(signingInput), options.privateKey);
  return `${signingInput}.${signature.toString('base64url')}`;
}

export interface ParsedJwt {
  header: JwtHeader;
  payload: Record<string, unknown>;
  signingInput: string;
  signature: Buffer;
}

/** Tách token và kiểm cấu trúc header; chưa kiểm chữ ký. Trả `undefined` nếu sai định dạng. */
export function parseJwt(token: string): ParsedJwt | undefined {
  const parts = token.split('.');
  const [headerSegment, payloadSegment, signatureSegment] = parts;
  if (parts.length !== 3 || !headerSegment || !payloadSegment || !signatureSegment) {
    return undefined;
  }
  const header = decode(headerSegment);
  const payload = decode(payloadSegment);
  if (
    typeof header !== 'object' ||
    header === null ||
    (header as Record<string, unknown>).alg !== 'EdDSA' ||
    typeof (header as Record<string, unknown>).kid !== 'string' ||
    typeof payload !== 'object' ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return undefined;
  }
  return {
    header: header as JwtHeader,
    payload: payload as Record<string, unknown>,
    signingInput: `${headerSegment}.${payloadSegment}`,
    signature: Buffer.from(signatureSegment, 'base64url'),
  };
}

export function verifyJwtSignature(parsed: ParsedJwt, publicKey: KeyObject): boolean {
  return cryptoVerify(null, Buffer.from(parsed.signingInput), publicKey, parsed.signature);
}

export function publicKeyFromJwkX(x: string): KeyObject {
  return createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x }, format: 'jwk' });
}

import { createHmac, randomBytes, randomUUID } from 'node:crypto';

export interface AccessTokenClaims {
  exp: number;
  role: string;
  sub: string;
}

function encodeJson(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function createAccessToken(
  subject: string,
  role: string,
  secret: string,
  expiresInSeconds: number,
): string {
  const now = Math.floor(Date.now() / 1_000);
  const header = encodeJson({ alg: 'HS256', typ: 'JWT' });
  const payload = encodeJson({
    sub: subject,
    role,
    iat: now,
    exp: now + expiresInSeconds,
    jti: randomUUID(),
  });
  const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

export function createRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHmac('sha256', 'auth-refresh-token-store-v1').update(token).digest('hex');
}

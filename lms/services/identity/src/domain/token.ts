import { createHmac, randomBytes } from 'node:crypto';

export function createRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHmac('sha256', 'auth-refresh-token-store-v1').update(token).digest('hex');
}

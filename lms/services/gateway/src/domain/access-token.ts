import { createHmac, timingSafeEqual } from 'node:crypto';

export interface Principal {
  id: string;
  role: string;
}

interface AccessTokenClaims {
  exp: number;
  role: unknown;
  sub: unknown;
}

function parseJsonSegment(segment: string): unknown {
  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
  } catch {
    return undefined;
  }
}

function isClaims(value: unknown): value is AccessTokenClaims {
  return typeof value === 'object' && value !== null && 'exp' in value && 'role' in value && 'sub' in value;
}

export function verifyAccessToken(token: string, secret: string, now = Date.now()): Principal | null {
  const parts = token.split('.');
  const [headerSegment, payloadSegment, signature] = parts;

  if (!headerSegment || !payloadSegment || !signature || parts.length !== 3) {
    return null;
  }

  const header = parseJsonSegment(headerSegment);
  const payload = parseJsonSegment(payloadSegment);

  if (
    typeof header !== 'object' ||
    header === null ||
    !('alg' in header) ||
    header.alg !== 'HS256' ||
    !isClaims(payload) ||
    typeof payload.sub !== 'string' ||
    payload.sub.trim().length === 0 ||
    typeof payload.role !== 'string' ||
    payload.role.trim().length === 0 ||
    !Number.isFinite(payload.exp) ||
    payload.exp <= Math.floor(now / 1_000)
  ) {
    return null;
  }

  const expectedSignature = createHmac('sha256', secret)
    .update(`${headerSegment}.${payloadSegment}`)
    .digest('base64url');

  const expectedBuffer = Buffer.from(expectedSignature);
  const actualBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    return null;
  }

  return { id: payload.sub, role: payload.role };
}

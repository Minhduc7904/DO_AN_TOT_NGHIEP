import { createHmac } from 'node:crypto';

import { verifyAccessToken } from '../../src/domain/access-token.js';

const secret = 'local-development-only-jwt-secret-change-before-production';

function createToken(claims: Record<string, unknown>, signingSecret = secret): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = createHmac('sha256', signingSecret)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

describe('verifyAccessToken', () => {
  it('accepts a signed, unexpired token with the principal claims required by Gateway', () => {
    const token = createToken({ exp: 1_900_000_000, role: 'student', sub: 'student-001' });

    expect(verifyAccessToken(token, secret, 1_800_000_000_000)).toEqual({
      id: 'student-001',
      role: 'student',
    });
  });

  it('rejects altered signatures, expired tokens, and missing principal claims', () => {
    const validClaims = { exp: 1_900_000_000, role: 'student', sub: 'student-001' };

    expect(
      verifyAccessToken(createToken(validClaims, `${secret}-other`), secret, 1_800_000_000_000),
    ).toBeNull();
    expect(
      verifyAccessToken(
        createToken({ ...validClaims, exp: 1_700_000_000 }),
        secret,
        1_800_000_000_000,
      ),
    ).toBeNull();
    expect(
      verifyAccessToken(
        createToken({ exp: 1_900_000_000, role: 'student' }),
        secret,
        1_800_000_000_000,
      ),
    ).toBeNull();
  });
});

import {
  AuthService,
  InvalidAuthPayloadError,
  InvalidCredentialsError,
} from '../../src/application/auth.service.js';
import type {
  AuthRepository,
  RefreshTokenRecord,
} from '../../src/application/ports/auth-repository.js';
import { hashPassword } from '../../src/domain/password.js';
import { hashRefreshToken } from '../../src/domain/token.js';

class InMemoryAuthRepository implements AuthRepository {
  readonly refreshTokens = new Map<string, RefreshTokenRecord>();
  readonly user = {
    id: 'student-001',
    email: 'student@example.test',
    passwordHash: '',
    role: 'student',
  };

  async createRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    this.refreshTokens.set(tokenHash, {
      id: `refresh-${this.refreshTokens.size + 1}`,
      tokenHash,
      expiresAt,
      user: this.user,
    });
  }

  async findUserByEmail(email: string): Promise<typeof this.user | null> {
    return email === this.user.email ? this.user : null;
  }

  async consumeRefreshToken(tokenHash: string): Promise<typeof this.user | null> {
    const token = this.refreshTokens.get(tokenHash);
    if (!token || token.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    return this.refreshTokens.delete(tokenHash) ? token.user : null;
  }
}

describe('AuthService', () => {
  let repository: InMemoryAuthRepository;
  let service: AuthService;

  beforeEach(async () => {
    repository = new InMemoryAuthRepository();
    repository.user.passwordHash = await hashPassword('example-password');
    service = new AuthService(repository, {
      jwtSecret: 'test-only-jwt-secret-with-at-least-thirty-two-characters',
      jwtTtlSeconds: 3600,
      refreshTtlSeconds: 3600,
    });
  });

  it('issues a JWT and rotates an opaque refresh token for the seeded user', async () => {
    const login = await service.login({
      email: 'student@example.test',
      password: 'example-password',
    });
    const refreshed = await service.refresh({ refresh_token: login.refresh_token });

    expect(login.token_type).toBe('Bearer');
    expect(login.expires_in_seconds).toBe(3600);
    expect(login.principal).toEqual({ id: 'student-001', role: 'student' });
    expect(login.access_token.split('.')).toHaveLength(3);
    expect(refreshed.access_token).not.toBe(login.access_token);
    expect(refreshed.refresh_token).not.toBe(login.refresh_token);
    await expect(service.refresh({ refresh_token: login.refresh_token })).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
  });

  it('rejects invalid credentials and malformed request bodies without returning a token', async () => {
    await expect(
      service.login({ email: 'student@example.test', password: 'incorrect-password' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(service.login({ email: 'student@example.test' })).rejects.toBeInstanceOf(
      InvalidAuthPayloadError,
    );
    await expect(service.refresh({ refresh_token: '' })).rejects.toBeInstanceOf(
      InvalidAuthPayloadError,
    );
  });

  it('rejects an expired refresh token without issuing a replacement', async () => {
    const refreshToken = 'expired-refresh-token';
    repository.refreshTokens.set(hashRefreshToken(refreshToken), {
      id: 'expired-refresh-1',
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(0),
      user: repository.user,
    });

    await expect(service.refresh({ refresh_token: refreshToken })).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
  });

  it('consumes a refresh token exactly once when requests race', async () => {
    const login = await service.login({
      email: 'student@example.test',
      password: 'example-password',
    });
    const outcomes = await Promise.allSettled([
      service.refresh({ refresh_token: login.refresh_token }),
      service.refresh({ refresh_token: login.refresh_token }),
    ]);

    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);
  });
});

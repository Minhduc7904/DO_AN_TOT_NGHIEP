import { hashRefreshToken, createAccessToken, createRefreshToken } from '../domain/token.js';
import { verifyPassword } from '../domain/password.js';
import { AuthRepository, type AuthUser } from './ports/auth-repository.js';

export interface AuthTokenConfiguration {
  jwtSecret: string;
  jwtTtlSeconds: number;
  refreshTtlSeconds: number;
}

export class InvalidAuthPayloadError extends Error {}
export class InvalidCredentialsError extends Error {}

export interface LoginResponse {
  access_token: string;
  expires_in_seconds: number;
  principal: { id: string; role: string };
  refresh_token: string;
  token_type: 'Bearer';
}

export interface RefreshResponse {
  access_token: string;
  expires_in_seconds: number;
  refresh_token: string;
  token_type: 'Bearer';
}

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly configuration: AuthTokenConfiguration,
  ) {}

  async login(payload: unknown): Promise<LoginResponse> {
    const { email, password } = this.parseLoginPayload(payload);
    const user = await this.repository.findUserByEmail(email);

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new InvalidCredentialsError('Thông tin đăng nhập không hợp lệ');
    }

    return this.issueTokenPair(user, true);
  }

  async refresh(payload: unknown): Promise<RefreshResponse> {
    const refreshToken = this.parseRefreshPayload(payload);
    const user = await this.repository.consumeRefreshToken(hashRefreshToken(refreshToken));

    if (!user) {
      throw new InvalidCredentialsError('Refresh token không hợp lệ hoặc đã hết hạn');
    }

    return this.issueTokenPair(user, false);
  }

  private async issueTokenPair(user: AuthUser, includePrincipal: true): Promise<LoginResponse>;
  private async issueTokenPair(user: AuthUser, includePrincipal: false): Promise<RefreshResponse>;
  private async issueTokenPair(
    user: AuthUser,
    includePrincipal: boolean,
  ): Promise<LoginResponse | RefreshResponse> {
    const expiresInSeconds = this.configuration.jwtTtlSeconds;
    const refreshTtlSeconds = this.configuration.refreshTtlSeconds;
    const secret = this.configuration.jwtSecret;
    const refreshToken = createRefreshToken();
    const accessToken = createAccessToken(user.id, user.role, secret, expiresInSeconds);

    await this.repository.createRefreshToken(
      user.id,
      hashRefreshToken(refreshToken),
      new Date(Date.now() + refreshTtlSeconds * 1_000),
    );

    const response = {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer' as const,
      expires_in_seconds: expiresInSeconds,
    };

    return includePrincipal
      ? { ...response, principal: { id: user.id, role: user.role } }
      : response;
  }

  private parseLoginPayload(payload: unknown): { email: string; password: string } {
    if (
      !this.isRecord(payload) ||
      typeof payload.email !== 'string' ||
      typeof payload.password !== 'string'
    ) {
      throw new InvalidAuthPayloadError('email và password là bắt buộc');
    }

    const email = payload.email.trim().toLowerCase();
    if (!email || !email.includes('@') || payload.password.length < 8) {
      throw new InvalidAuthPayloadError('Thông tin đăng nhập không hợp lệ');
    }

    return { email, password: payload.password };
  }

  private parseRefreshPayload(payload: unknown): string {
    if (
      !this.isRecord(payload) ||
      typeof payload.refresh_token !== 'string' ||
      !payload.refresh_token.trim()
    ) {
      throw new InvalidAuthPayloadError('refresh_token là bắt buộc');
    }

    return payload.refresh_token;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module.js';
import { HttpExceptionFilter } from '../../src/adapters/http/http-exception.filter.js';
import {
  AuthRepository,
  type RefreshTokenRecord,
} from '../../src/application/ports/auth-repository.js';
import { hashPassword } from '../../src/domain/password.js';

class TestAuthRepository implements AuthRepository {
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

describe('Auth HTTP contract', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const repository = new TestAuthRepository();
    repository.user.passwordHash = await hashPassword('example-password');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AuthRepository)
      .useValue(repository)
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the W1 login response without exposing the password', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'student@example.test', password: 'example-password' })
      .expect(200);

    expect(response.body).toMatchObject({
      token_type: 'Bearer',
      expires_in_seconds: 3600,
      principal: { id: 'student-001', role: 'student' },
    });
    expect(response.body.access_token.split('.')).toHaveLength(3);
    expect(response.body.refresh_token).toEqual(expect.any(String));
    expect(JSON.stringify(response.body)).not.toContain('example-password');
  });

  it('returns the canonical envelope for invalid credentials', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'student@example.test', password: 'wrong-password' })
      .expect(401);

    expect(response.body).toMatchObject({
      code: 'UNAUTHORIZED',
      details: null,
      trace_id: expect.any(String),
    });
    expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);
  });
});

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

import { AuthRepository, type AuthUser } from '../../application/ports/auth-repository.js';

interface UserRow {
  email: string;
  id: string;
  password_hash: string;
  role: string;
}

@Injectable()
export class PostgresAuthRepository extends AuthRepository implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(config: ConfigService) {
    super();
    this.pool = new Pool({ connectionString: config.getOrThrow<string>('AUTH_DATABASE_URL') });
  }

  async createRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.pool.query(
      `INSERT INTO auth_refresh_tokens (id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [randomUUID(), userId, tokenHash, expiresAt],
    );
  }

  async consumeRefreshToken(tokenHash: string): Promise<AuthUser | null> {
    const result = await this.pool.query<UserRow>(
      `WITH consumed_token AS (
         DELETE FROM auth_refresh_tokens
         WHERE token_hash = $1
           AND expires_at > now()
         RETURNING user_id
       )
       SELECT app_user.id, app_user.email, app_user.password_hash, app_user.role
       FROM consumed_token
       INNER JOIN auth_users AS app_user ON app_user.id = consumed_token.user_id`,
      [tokenHash],
    );
    const row = result.rows[0];
    return row ? this.toUser(row) : null;
  }

  async findUserByEmail(email: string): Promise<AuthUser | null> {
    const result = await this.pool.query<UserRow>(
      `SELECT id, email, password_hash, role
       FROM auth_users
       WHERE email = $1`,
      [email],
    );
    const row = result.rows[0];
    return row ? this.toUser(row) : null;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  private toUser(row: UserRow): AuthUser {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role,
    };
  }
}

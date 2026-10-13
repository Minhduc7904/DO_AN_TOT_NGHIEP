import { Pool } from 'pg';

import { validateEnvironment } from '../config/env.schema.js';
import { hashPassword } from '../domain/password.js';

const environment = validateEnvironment(process.env);
const pool = new Pool({ connectionString: environment.AUTH_DATABASE_URL });

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id uuid PRIMARY KEY,
      email text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      role text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      token_hash text NOT NULL UNIQUE,
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(
    'CREATE INDEX IF NOT EXISTS auth_refresh_tokens_token_hash_idx ON auth_refresh_tokens (token_hash)',
  );

  const seedUsers = [
    {
      createdAt: '2026-08-27T09:00:00Z',
      email: 'student@example.test',
      id: '11111111-1111-4111-8111-111111111111',
      role: 'student',
    },
    {
      createdAt: '2026-08-27T09:00:00Z',
      email: 'instructor@example.test',
      id: '22222222-2222-4222-8222-222222222222',
      role: 'instructor',
    },
  ];
  for (const { createdAt, email, id, role } of seedUsers) {
    const existing = await pool.query<{ id: string }>(
      'SELECT id FROM auth_users WHERE email = $1',
      [email],
    );
    if (!existing.rows[0]) {
      await pool.query(
        `INSERT INTO auth_users (id, email, password_hash, role, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, email, await hashPassword('example-password'), role, createdAt],
      );
    }
  }
} finally {
  await pool.end();
}

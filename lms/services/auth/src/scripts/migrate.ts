import { randomUUID } from 'node:crypto';

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

  const email = 'student@example.test';
  const existing = await pool.query<{ id: string }>('SELECT id FROM auth_users WHERE email = $1', [
    email,
  ]);
  if (!existing.rows[0]) {
    await pool.query(
      `INSERT INTO auth_users (id, email, password_hash, role)
       VALUES ($1, $2, $3, $4)`,
      [randomUUID(), email, await hashPassword('example-password'), 'student'],
    );
  }
} finally {
  await pool.end();
}

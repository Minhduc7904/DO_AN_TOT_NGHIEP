import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { Pool } from 'pg';

const databaseUrl = process.env.W1_AUTH_DATABASE_URL;

if (!databaseUrl) {
  throw new Error('W1_AUTH_DATABASE_URL là bắt buộc cho kiểm thử PostgreSQL W1.');
}

const pool = new Pool({ connectionString: databaseUrl });

try {
  await pool.query('DROP TABLE IF EXISTS auth_refresh_tokens');
  await pool.query('DROP TABLE IF EXISTS auth_users');
} finally {
  await pool.end();
}

execFileSync(
  process.execPath,
  [fileURLToPath(new URL('../dist/scripts/migrate.js', import.meta.url))],
  {
    env: { ...process.env, AUTH_DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  },
);

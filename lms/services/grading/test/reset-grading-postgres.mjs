import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { Pool } from 'pg';

const adminUrl = process.env.W1_AUTH_DATABASE_URL;
const gradingUrl = process.env.GRADING_DATABASE_URL;
if (!adminUrl || !gradingUrl) {
  throw new Error('W1_AUTH_DATABASE_URL và GRADING_DATABASE_URL là bắt buộc');
}

const admin = new Pool({ connectionString: adminUrl });
try {
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = 'grading_db'");
  if (exists.rowCount === 0) await admin.query('CREATE DATABASE grading_db');
} finally {
  await admin.end();
}

const gradingDb = new Pool({ connectionString: gradingUrl });
try {
  await gradingDb.query('DROP TABLE IF EXISTS grades');
} finally {
  await gradingDb.end();
}

execFileSync(
  process.execPath,
  [fileURLToPath(new URL('../dist/scripts/migrate.js', import.meta.url))],
  {
    env: process.env,
    stdio: 'inherit',
  },
);

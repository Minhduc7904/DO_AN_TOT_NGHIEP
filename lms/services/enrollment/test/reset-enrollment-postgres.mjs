import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { Pool } from 'pg';

const adminUrl = process.env.W1_AUTH_DATABASE_URL;
const enrollmentUrl = process.env.ENROLLMENT_DATABASE_URL;
if (!adminUrl || !enrollmentUrl)
  throw new Error('W1_AUTH_DATABASE_URL và ENROLLMENT_DATABASE_URL là bắt buộc');

const admin = new Pool({ connectionString: adminUrl });
try {
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = 'enrollment_db'");
  if (exists.rowCount === 0) await admin.query('CREATE DATABASE enrollment_db');
} finally {
  await admin.end();
}

const enrollmentDb = new Pool({ connectionString: enrollmentUrl });
try {
  await enrollmentDb.query('DROP TABLE IF EXISTS enrollments');
} finally {
  await enrollmentDb.end();
}

execFileSync(
  process.execPath,
  [fileURLToPath(new URL('../dist/scripts/migrate.js', import.meta.url))],
  {
    env: process.env,
    stdio: 'inherit',
  },
);

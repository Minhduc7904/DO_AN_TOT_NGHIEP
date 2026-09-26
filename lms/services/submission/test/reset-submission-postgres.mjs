import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { Pool } from 'pg';

const adminUrl = process.env.W1_AUTH_DATABASE_URL;
const submissionUrl = process.env.SUBMISSION_DATABASE_URL;
if (!adminUrl || !submissionUrl) {
  throw new Error('W1_AUTH_DATABASE_URL và SUBMISSION_DATABASE_URL là bắt buộc');
}

const admin = new Pool({ connectionString: adminUrl });
try {
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = 'submission_db'");
  if (exists.rowCount === 0) await admin.query('CREATE DATABASE submission_db');
} finally {
  await admin.end();
}

const submissionDb = new Pool({ connectionString: submissionUrl });
try {
  await submissionDb.query('DROP TABLE IF EXISTS submissions');
} finally {
  await submissionDb.end();
}

execFileSync(
  process.execPath,
  [fileURLToPath(new URL('../dist/scripts/migrate.js', import.meta.url))],
  {
    env: process.env,
    stdio: 'inherit',
  },
);

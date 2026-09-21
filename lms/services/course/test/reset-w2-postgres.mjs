import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { Pool } from 'pg';

const adminUrl = process.env.W1_AUTH_DATABASE_URL;
const courseUrl = process.env.COURSE_DATABASE_URL;
if (!adminUrl || !courseUrl)
  throw new Error('W1_AUTH_DATABASE_URL và COURSE_DATABASE_URL là bắt buộc');

const admin = new Pool({ connectionString: adminUrl });
try {
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = 'course_db'");
  if (exists.rowCount === 0) await admin.query('CREATE DATABASE course_db');
} finally {
  await admin.end();
}

const course = new Pool({ connectionString: courseUrl });
try {
  await course.query('DROP TABLE IF EXISTS courses');
} finally {
  await course.end();
}

execFileSync(
  process.execPath,
  [fileURLToPath(new URL('../dist/scripts/migrate.js', import.meta.url))],
  {
    env: process.env,
    stdio: 'inherit',
  },
);

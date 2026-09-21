import { Pool } from 'pg';

import { validateEnvironment } from '../config/env.schema.js';

const environment = validateEnvironment(process.env);
const pool = new Pool({ connectionString: environment.COURSE_DATABASE_URL });

try {
  await pool.query(`CREATE TABLE IF NOT EXISTS courses (
    id text PRIMARY KEY,
    title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  await pool.query(
    `INSERT INTO courses (id, title, created_at)
     VALUES ('course-001', 'Distributed Systems Basics', '2026-08-27T10:00:00Z')
     ON CONFLICT (id) DO NOTHING`,
  );
} finally {
  await pool.end();
}

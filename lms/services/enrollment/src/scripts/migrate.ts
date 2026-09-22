import { Pool } from 'pg';

import { validateEnvironment } from '../config/env.schema.js';

const environment = validateEnvironment(process.env);
const pool = new Pool({ connectionString: environment.ENROLLMENT_DATABASE_URL });

try {
  await pool.query(`CREATE TABLE IF NOT EXISTS enrollments (
    id text PRIMARY KEY,
    principal_id text NOT NULL CHECK (length(trim(principal_id)) BETWEEN 1 AND 200),
    course_id text NOT NULL CHECK (length(trim(course_id)) BETWEEN 1 AND 200),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (principal_id, course_id)
  )`);
  await pool.query(
    `INSERT INTO enrollments (id, principal_id, course_id, created_at)
     VALUES ('enrollment-001', 'student-001', 'course-001', '2026-08-27T10:05:00Z')
     ON CONFLICT (id) DO NOTHING`,
  );
} finally {
  await pool.end();
}

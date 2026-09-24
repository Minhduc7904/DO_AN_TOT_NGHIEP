import { Pool } from 'pg';

import { validateEnvironment } from '../config/env.schema.js';

const environment = validateEnvironment(process.env);
const pool = new Pool({ connectionString: environment.SUBMISSION_DATABASE_URL });

try {
  await pool.query(`CREATE TABLE IF NOT EXISTS submissions (
    id text PRIMARY KEY,
    principal_id text NOT NULL CHECK (length(trim(principal_id)) BETWEEN 1 AND 200),
    course_id text NOT NULL CHECK (length(trim(course_id)) BETWEEN 1 AND 200),
    storage_object_key text NOT NULL UNIQUE CHECK (length(trim(storage_object_key)) BETWEEN 1 AND 500),
    submitted_at timestamptz NOT NULL DEFAULT now()
  )`);
  await pool.query(
    `INSERT INTO submissions (id, principal_id, course_id, storage_object_key, submitted_at)
     VALUES ('submission-001', 'student-001', 'course-001', 'submissions/submission-001', '2026-08-27T10:10:00Z')
     ON CONFLICT (id) DO NOTHING`,
  );
} finally {
  await pool.end();
}

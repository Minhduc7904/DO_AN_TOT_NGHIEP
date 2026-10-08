import { Pool } from 'pg';

import { validateEnvironment } from '../config/env.schema.js';

const environment = validateEnvironment(process.env);
const pool = new Pool({ connectionString: environment.GRADING_DATABASE_URL });

try {
  await pool.query(`CREATE TABLE IF NOT EXISTS grades (
    id uuid PRIMARY KEY,
    submission_id text NOT NULL UNIQUE CHECK (length(trim(submission_id)) BETWEEN 1 AND 200),
    principal_id text NOT NULL CHECK (length(trim(principal_id)) BETWEEN 1 AND 200),
    course_id text NOT NULL CHECK (length(trim(course_id)) BETWEEN 1 AND 200),
    score numeric(7, 4) NOT NULL CHECK (score >= 0 AND score <= 100),
    completed_at timestamptz NOT NULL DEFAULT now()
  )`);
  await pool.query(
    `INSERT INTO grades (id, submission_id, principal_id, course_id, score, completed_at)
     VALUES ('7d1f3a52-0c4e-4b8a-9d36-5a2e8f10c001', 'submission-001', 'student-001', 'course-001', 85.5, '2026-08-27T10:15:00Z')
     ON CONFLICT DO NOTHING`,
  );
} finally {
  await pool.end();
}

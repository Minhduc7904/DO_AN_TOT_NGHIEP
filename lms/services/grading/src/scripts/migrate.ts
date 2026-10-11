import { Pool } from 'pg';

import { validateEnvironment } from '../config/env.schema.js';

const environment = validateEnvironment(process.env);
const pool = new Pool({ connectionString: environment.GRADING_DATABASE_URL });

const client = await pool.connect();
try {
  // Toàn bộ migration chạy trong một transaction để lỡ dừng giữa chừng không để lại schema nửa vời.
  await client.query('BEGIN');
  await client.query(`CREATE TABLE IF NOT EXISTS grades (
    id uuid PRIMARY KEY,
    submission_id text NOT NULL UNIQUE CHECK (length(trim(submission_id)) BETWEEN 1 AND 200),
    principal_id text NOT NULL CHECK (length(trim(principal_id)) BETWEEN 1 AND 200),
    course_id text NOT NULL CHECK (length(trim(course_id)) BETWEEN 1 AND 200),
    score numeric(7, 4) NOT NULL CHECK (score >= 0 AND score <= 100),
    completed_at timestamptz NOT NULL DEFAULT now()
  )`);

  // Publication state của event grade.completed nằm ngay trong grades (không dùng outbox riêng).
  // Cột được thêm với default 'published' để grade có sẵn trước migration được coi là lịch sử và
  // không bị phát lại; ngay sau đó default đổi thành 'pending' cho grade mới.
  await client.query(`ALTER TABLE grades
    ADD COLUMN IF NOT EXISTS event_id uuid UNIQUE,
    ADD COLUMN IF NOT EXISTS publish_status text NOT NULL DEFAULT 'published'
      CHECK (publish_status IN ('pending', 'published')),
    ADD COLUMN IF NOT EXISTS publish_attempts integer NOT NULL DEFAULT 0
      CHECK (publish_attempts >= 0),
    ADD COLUMN IF NOT EXISTS last_publish_error_code text,
    ADD COLUMN IF NOT EXISTS published_at timestamptz`);
  await client.query(`ALTER TABLE grades ALTER COLUMN publish_status SET DEFAULT 'pending'`);
  await client.query(
    `UPDATE grades
        SET event_id = gen_random_uuid(), publish_status = 'published', published_at = completed_at
      WHERE event_id IS NULL`,
  );
  await client.query('ALTER TABLE grades ALTER COLUMN event_id SET NOT NULL');
  await client.query(
    `CREATE INDEX IF NOT EXISTS grades_pending_publication_idx
       ON grades (completed_at, id) WHERE publish_status = 'pending'`,
  );

  await client.query(
    `INSERT INTO grades (id, submission_id, principal_id, course_id, score, completed_at,
                         event_id, publish_status, published_at)
     VALUES ('7d1f3a52-0c4e-4b8a-9d36-5a2e8f10c001', 'submission-001', 'student-001', 'course-001', 85.5,
             '2026-08-27T10:15:00Z', '3b0c6f4e-1a52-4d8e-9f17-6c2a5e7d9b01', 'published',
             '2026-08-27T10:15:00Z')
     ON CONFLICT DO NOTHING`,
  );
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally {
  client.release();
  await pool.end();
}

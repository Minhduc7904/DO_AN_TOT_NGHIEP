import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

import { Pool } from 'pg';

import { PostgresSubmissionRepository } from '../dist/adapters/persistence/postgres-submission.repository.js';

const adminUrl = process.env.W1_AUTH_DATABASE_URL;
const submissionUrl = process.env.SUBMISSION_DATABASE_URL;
if (!adminUrl || !submissionUrl) {
  throw new Error('W1_AUTH_DATABASE_URL và SUBMISSION_DATABASE_URL là bắt buộc');
}

const admin = new Pool({ connectionString: adminUrl });
const submissionDb = new Pool({ connectionString: submissionUrl });
try {
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = 'submission_db'");
  if (exists.rowCount === 0) await admin.query('CREATE DATABASE submission_db');
  await submissionDb.query('DROP TABLE IF EXISTS submissions');
  for (let attempt = 0; attempt < 2; attempt++) {
    const run = spawnSync(process.execPath, ['services/submission/dist/scripts/migrate.js'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: process.env,
    });
    assert.equal(run.status, 0, run.stderr);
  }

  const repository = new PostgresSubmissionRepository({ getOrThrow: () => submissionUrl });
  try {
    assert.equal((await repository.findById('submission-001'))?.course_id, 'course-001');
    const id = randomUUID();
    const created = await repository.create({
      courseId: 'course-001',
      id,
      principalId: 'student-002',
      storageObjectKey: `submissions/${id}`,
    });
    assert.equal(created.id, id);
    assert.equal((await repository.findById(id))?.storage_object_key, `submissions/${id}`);
    assert.equal(await repository.findById('missing'), null);
  } finally {
    await repository.onModuleDestroy();
  }
  console.log('Submission PostgreSQL migration, seed và repository integration đạt.');
} finally {
  await submissionDb.end();
  await admin.end();
}

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

import { Pool } from 'pg';

import { PostgresEnrollmentRepository } from '../dist/adapters/persistence/postgres-enrollment.repository.js';

const adminUrl = process.env.W1_AUTH_DATABASE_URL;
const enrollmentUrl = process.env.ENROLLMENT_DATABASE_URL;
if (!adminUrl || !enrollmentUrl) {
  throw new Error('W1_AUTH_DATABASE_URL và ENROLLMENT_DATABASE_URL là bắt buộc');
}

const admin = new Pool({ connectionString: adminUrl });
const enrollmentDb = new Pool({ connectionString: enrollmentUrl });
try {
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = 'enrollment_db'");
  if (exists.rowCount === 0) await admin.query('CREATE DATABASE enrollment_db');
  await enrollmentDb.query('DROP TABLE IF EXISTS enrollments');
  for (let attempt = 0; attempt < 2; attempt++) {
    const run = spawnSync(process.execPath, ['services/enrollment/dist/scripts/migrate.js'], {
      cwd: process.cwd(),
      env: process.env,
      encoding: 'utf8',
    });
    assert.equal(run.status, 0, run.stderr);
  }

  const repository = new PostgresEnrollmentRepository({
    getOrThrow: () => enrollmentUrl,
  });
  try {
    const seedCheck = await repository.findByPrincipalAndCourse('student-001', 'course-001');
    assert.equal(seedCheck?.id, 'enrollment-001');
    const created = await repository.create('student-002', randomUUID());
    assert.equal(
      (await repository.findByPrincipalAndCourse('student-002', created.course_id))?.id,
      created.id,
    );
    assert.ok(
      (await repository.list({ principalId: 'student-002' }, 100)).some(
        (item) => item.id === created.id,
      ),
    );
    assert.equal(await repository.findByPrincipalAndCourse('student-002', 'missing'), null);
    await assert.rejects(repository.create('student-001', 'course-001'));
  } finally {
    await repository.onModuleDestroy();
  }
  console.log('Enrollment PostgreSQL migration, seed và repository integration đạt.');
} finally {
  await enrollmentDb.end();
  await admin.end();
}

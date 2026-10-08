import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';

import { Pool } from 'pg';

import { PostgresGradeRepository } from '../dist/adapters/persistence/postgres-grade.repository.js';
import { GradeConflictError } from '../dist/application/grade-conflict-error.js';
import { GradingDependencyError } from '../dist/application/grading-dependency-error.js';

const adminUrl = process.env.W1_AUTH_DATABASE_URL;
const gradingUrl = process.env.GRADING_DATABASE_URL;
if (!adminUrl || !gradingUrl) {
  throw new Error('W1_AUTH_DATABASE_URL và GRADING_DATABASE_URL là bắt buộc');
}

function migrate() {
  const run = spawnSync(process.execPath, ['services/grading/dist/scripts/migrate.js'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: process.env,
  });
  assert.equal(run.status, 0, run.stderr);
}

const admin = new Pool({ connectionString: adminUrl });
const gradingDb = new Pool({ connectionString: gradingUrl });
try {
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = 'grading_db'");
  if (exists.rowCount === 0) await admin.query('CREATE DATABASE grading_db');
  await gradingDb.query('DROP TABLE IF EXISTS grades');
  migrate();
  migrate();
  const seeded = await gradingDb.query('SELECT submission_id FROM grades');
  assert.deepEqual(
    seeded.rows.map((row) => row.submission_id),
    ['submission-001'],
  );

  const repository = new PostgresGradeRepository({ getOrThrow: () => gradingUrl });
  try {
    const seed = await repository.findById('7d1f3a52-0c4e-4b8a-9d36-5a2e8f10c001');
    assert.equal(seed?.submission_id, 'submission-001');
    assert.equal(seed?.principal_id, 'student-001');
    assert.equal(seed?.course_id, 'course-001');
    assert.equal(seed?.score, 85.5);
    assert.equal(seed?.completed_at, '2026-08-27T10:15:00.000Z');

    const id = randomUUID();
    const submissionId = `submission-${id}`;
    const created = await repository.create({
      courseId: 'course-001',
      id,
      principalId: 'student-002',
      score: 92.5,
      submissionId,
    });
    assert.equal(created.id, id);
    assert.equal(typeof created.score, 'number');
    assert.equal(created.score, 92.5);
    assert.deepEqual(await repository.findById(id), created);
    assert.equal(await repository.findById(randomUUID()), null);

    await assert.rejects(
      repository.create({
        courseId: 'course-001',
        id: randomUUID(),
        principalId: 'student-002',
        score: 10,
        submissionId,
      }),
      GradeConflictError,
    );
    await assert.rejects(
      repository.create({
        courseId: 'course-001',
        id: randomUUID(),
        principalId: 'student-002',
        score: 100.5,
        submissionId: `submission-${randomUUID()}`,
      }),
      (error) => error instanceof GradingDependencyError && error.kind === 'unavailable',
    );
    const afterMigrations = await gradingDb.query('SELECT count(*)::int AS total FROM grades');
    assert.equal(afterMigrations.rows[0].total, 2);
  } finally {
    await repository.onModuleDestroy();
  }

  const closed = createServer();
  closed.listen(0, '127.0.0.1');
  await new Promise((resolve) => closed.once('listening', resolve));
  const closedPort = closed.address().port;
  await new Promise((resolve) => closed.close(resolve));
  const unavailable = new PostgresGradeRepository({
    getOrThrow: () => `postgresql://w1_test:unused@127.0.0.1:${closedPort}/grading_db`,
  });
  try {
    await assert.rejects(
      unavailable.findById(randomUUID()),
      (error) =>
        error instanceof GradingDependencyError &&
        error.dependency === 'grading-postgres' &&
        error.kind === 'unavailable',
    );
  } finally {
    await unavailable.onModuleDestroy();
  }

  const sockets = new Set();
  const silent = createServer((socket) => {
    sockets.add(socket);
    socket.on('error', () => undefined);
  });
  silent.listen(0, '127.0.0.1');
  await new Promise((resolve) => silent.once('listening', resolve));
  const timeoutRepository = new PostgresGradeRepository({
    getOrThrow: () => `postgresql://w1_test:unused@127.0.0.1:${silent.address().port}/grading_db`,
  });
  try {
    await assert.rejects(
      timeoutRepository.findById(randomUUID()),
      (error) =>
        error instanceof GradingDependencyError &&
        error.dependency === 'grading-postgres' &&
        error.kind === 'timeout',
    );
  } finally {
    await timeoutRepository.onModuleDestroy();
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => silent.close(resolve));
  }
  console.log('Grading PostgreSQL migration, seed và repository integration đạt.');
} finally {
  await gradingDb.end();
  await admin.end();
}

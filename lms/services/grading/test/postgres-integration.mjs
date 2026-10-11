import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';

import { Pool } from 'pg';

import { PostgresGradeRepository } from '../dist/adapters/persistence/postgres-grade.repository.js';
import { GradeConflictError } from '../dist/application/grade-conflict-error.js';
import { GradeEventPublishError } from '../dist/application/grade-event-publish-error.js';
import { GradePublicationCoordinator } from '../dist/application/grade-publication.coordinator.js';
import { GradingDependencyError } from '../dist/application/grading-dependency-error.js';
import { PendingGradeEventWorker } from '../dist/adapters/messaging/pending-grade-event.worker.js';

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
  // Nâng cấp từ schema của task-04 (chưa có publication state): grade lịch sử phải là published.
  await gradingDb.query('DROP TABLE IF EXISTS grades');
  await gradingDb.query(`CREATE TABLE grades (
    id uuid PRIMARY KEY,
    submission_id text NOT NULL UNIQUE CHECK (length(trim(submission_id)) BETWEEN 1 AND 200),
    principal_id text NOT NULL CHECK (length(trim(principal_id)) BETWEEN 1 AND 200),
    course_id text NOT NULL CHECK (length(trim(course_id)) BETWEEN 1 AND 200),
    score numeric(7, 4) NOT NULL CHECK (score >= 0 AND score <= 100),
    completed_at timestamptz NOT NULL DEFAULT now()
  )`);
  await gradingDb.query(`INSERT INTO grades (id, submission_id, principal_id, course_id, score, completed_at)
    VALUES ('7d1f3a52-0c4e-4b8a-9d36-5a2e8f10c001', 'submission-001', 'student-001', 'course-001', 85.5, '2026-08-27T10:15:00Z'),
           ('7d1f3a52-0c4e-4b8a-9d36-5a2e8f10c002', 'submission-legacy', 'student-009', 'course-001', 70, '2026-09-01T00:00:00Z')`);
  migrate();
  migrate();
  const legacy = await gradingDb.query(
    'SELECT submission_id, event_id, publish_status, publish_attempts, published_at, completed_at FROM grades ORDER BY submission_id',
  );
  assert.deepEqual(
    legacy.rows.map((row) => row.submission_id),
    ['submission-001', 'submission-legacy'],
  );
  for (const row of legacy.rows) {
    assert.match(row.event_id, /^[0-9a-f-]{36}$/u);
    assert.equal(row.publish_status, 'published');
    assert.equal(row.publish_attempts, 0);
    assert.equal(row.published_at.toISOString(), row.completed_at.toISOString());
  }
  assert.equal(new Set(legacy.rows.map((row) => row.event_id)).size, 2);
  const eventIdsBefore = legacy.rows.map((row) => row.event_id);
  migrate();
  const again = await gradingDb.query('SELECT event_id FROM grades ORDER BY submission_id');
  assert.deepEqual(
    again.rows.map((row) => row.event_id),
    eventIdsBefore,
  );

  // Trạng thái sạch: schema mới + seed idempotent.
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

    assert.deepEqual(await repository.findPending(10), []);
    assert.equal(await repository.countPending(), 0);
    const seedState = await gradingDb.query(
      "SELECT publish_status, published_at FROM grades WHERE id = '7d1f3a52-0c4e-4b8a-9d36-5a2e8f10c001'",
    );
    assert.equal(seedState.rows[0].publish_status, 'published');

    const id = randomUUID();
    const eventId = randomUUID();
    const submissionId = `submission-${id}`;
    const created = await repository.create({
      courseId: 'course-001',
      eventId,
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
    const stored = await gradingDb.query(
      'SELECT event_id, publish_status, publish_attempts, last_publish_error_code, published_at FROM grades WHERE id = $1',
      [id],
    );
    assert.deepEqual(stored.rows[0], {
      event_id: eventId,
      last_publish_error_code: null,
      publish_attempts: 0,
      publish_status: 'pending',
      published_at: null,
    });
    const pendingSnapshots = await repository.findPending(10);
    assert.deepEqual(pendingSnapshots, [
      {
        completedAt: created.completed_at,
        courseId: 'course-001',
        eventId,
        gradeId: id,
        principalId: 'student-002',
        score: 92.5,
        submissionId,
      },
    ]);
    assert.equal(await repository.countPending(), 1);

    await assert.rejects(
      repository.create({
        courseId: 'course-001',
        eventId: randomUUID(),
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
        eventId: randomUUID(),
        id: randomUUID(),
        principalId: 'student-002',
        score: 100.5,
        submissionId: `submission-${randomUUID()}`,
      }),
      (error) => error instanceof GradingDependencyError && error.kind === 'unavailable',
    );
    const afterMigrations = await gradingDb.query('SELECT count(*)::int AS total FROM grades');
    assert.equal(afterMigrations.rows[0].total, 2);

    // event_id là duy nhất: không thể hai grade cùng event.
    await assert.rejects(
      repository.create({
        courseId: 'course-001',
        eventId,
        id: randomUUID(),
        principalId: 'student-002',
        score: 10,
        submissionId: `submission-${randomUUID()}`,
      }),
      (error) => error instanceof GradingDependencyError && error.kind === 'unavailable',
    );

    // Vòng đời publication: attempt tăng trước publish, lỗi giữ pending, retry dùng cùng event_id.
    assert.equal(await repository.recordAttempt(eventId), true);
    await repository.markFailed(eventId, 'BROKER_UNAVAILABLE');
    const failed = await gradingDb.query(
      'SELECT publish_status, publish_attempts, last_publish_error_code FROM grades WHERE event_id = $1',
      [eventId],
    );
    assert.deepEqual(failed.rows[0], {
      last_publish_error_code: 'BROKER_UNAVAILABLE',
      publish_attempts: 1,
      publish_status: 'pending',
    });

    const delivered = [];
    let failing = true;
    const publisher = {
      publish: async (snapshot) => {
        delivered.push(snapshot.eventId);
        if (failing) throw new GradeEventPublishError('PUBLISH_TIMEOUT');
      },
    };
    const coordinator = new GradePublicationCoordinator(repository, publisher);
    const worker = new PendingGradeEventWorker(repository, coordinator, {
      getOrThrow: (key) => (key === 'GRADING_EVENT_RETRY_BATCH_SIZE' ? 20 : 1000),
    });
    await worker.runCycle();
    await worker.runCycle();
    assert.deepEqual(delivered, [eventId, eventId]);
    const retried = await gradingDb.query(
      'SELECT publish_status, publish_attempts, last_publish_error_code FROM grades WHERE event_id = $1',
      [eventId],
    );
    assert.deepEqual(retried.rows[0], {
      last_publish_error_code: 'PUBLISH_TIMEOUT',
      publish_attempts: 3,
      publish_status: 'pending',
    });
    assert.equal(
      (await gradingDb.query('SELECT count(*)::int AS total FROM grades')).rows[0].total,
      2,
    );

    failing = false;
    await worker.runCycle();
    const recovered = await gradingDb.query(
      'SELECT publish_status, publish_attempts, last_publish_error_code, published_at FROM grades WHERE event_id = $1',
      [eventId],
    );
    assert.equal(recovered.rows[0].publish_status, 'published');
    assert.equal(recovered.rows[0].publish_attempts, 4);
    assert.equal(recovered.rows[0].last_publish_error_code, null);
    assert.ok(recovered.rows[0].published_at instanceof Date);
    assert.equal(await repository.countPending(), 0);
    // Đã published thì không bị phát lại và không bị tăng attempt.
    assert.equal(await repository.recordAttempt(eventId), false);
    await worker.runCycle();
    assert.deepEqual(delivered, [eventId, eventId, eventId]);
    await worker.stop();
  } finally {
    await repository.onApplicationShutdown();
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
    await unavailable.onApplicationShutdown();
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
    await timeoutRepository.onApplicationShutdown();
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => silent.close(resolve));
  }
  console.log(
    'Grading PostgreSQL migration, seed, publication state và repository integration đạt.',
  );
} finally {
  await gradingDb.end();
  await admin.end();
}

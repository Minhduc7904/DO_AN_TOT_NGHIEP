import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

import { Pool } from 'pg';

import { PostgresCourseRepository } from '../dist/adapters/persistence/postgres-course.repository.js';

const adminUrl = process.env.W1_AUTH_DATABASE_URL;
const courseUrl = process.env.COURSE_DATABASE_URL;
if (!adminUrl || !courseUrl) {
  throw new Error('W1_AUTH_DATABASE_URL và COURSE_DATABASE_URL là bắt buộc');
}

const admin = new Pool({ connectionString: adminUrl });
const course = new Pool({ connectionString: courseUrl });
try {
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = 'course_db'");
  if (exists.rowCount === 0) await admin.query('CREATE DATABASE course_db');
  await course.query('DROP TABLE IF EXISTS courses');
  for (let attempt = 0; attempt < 2; attempt++) {
    const run = spawnSync(process.execPath, ['services/course/dist/scripts/migrate.js'], {
      cwd: process.cwd(),
      env: process.env,
      encoding: 'utf8',
    });
    assert.equal(run.status, 0, run.stderr);
  }

  const repository = new PostgresCourseRepository({
    getOrThrow: () => courseUrl,
  });
  try {
    assert.equal((await repository.findById('course-001'))?.title, 'Distributed Systems Basics');
    const title = `Integration ${randomUUID()}`;
    const created = await repository.create(title);
    assert.equal((await repository.findById(created.id))?.title, title);
    assert.ok((await repository.list(100)).some((item) => item.id === created.id));
    assert.equal(await repository.findById('missing'), null);
  } finally {
    await repository.onModuleDestroy();
  }
  console.log('Course PostgreSQL migration, seed và repository integration đạt.');
} finally {
  await course.end();
  await admin.end();
}

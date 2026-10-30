// Kiểm chứng seeder trên PostgreSQL thật (cần các database đã migrate, ví dụ stack compose sau reset
// hoặc Postgres tạm đã chạy migration). Nhận cùng cờ kết nối với seed-data.mjs.
//
//   node test/seed-data/seed-data-db-smoke.mjs --port 5432 --user lms --password lms-local-only
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, promisify } from 'node:util';

import pg from 'pg';

const run = promisify(execFile);
const SCRIPT = resolve(
  fileURLToPath(import.meta.url),
  '..',
  '..',
  '..',
  'scripts',
  'seed-data.mjs',
);
const { values } = parseArgs({
  options: {
    host: { type: 'string', default: 'localhost' },
    port: { type: 'string', default: '5432' },
    user: { type: 'string', default: 'lms' },
    password: { type: 'string', default: 'lms-local-only' },
  },
});

const connectionFlags = [
  '--host',
  values.host,
  '--port',
  values.port,
  '--user',
  values.user,
  '--password',
  values.password,
];

async function connect(database) {
  const client = new pg.Client({
    host: values.host,
    port: Number(values.port),
    user: values.user,
    password: values.password,
    database,
  });
  await client.connect();
  return client;
}

async function seed(extra, reportPath) {
  const args = [
    SCRIPT,
    '--environment',
    'test',
    '--non-interactive',
    '--yes',
    '--seed',
    '42',
    '--report',
    reportPath,
    ...connectionFlags,
    ...extra,
  ];
  const { stdout } = await run('node', args, { maxBuffer: 64 * 1024 * 1024 });
  return { report: JSON.parse(readFileSync(reportPath, 'utf8')), stdout };
}

const scalar = async (client, sql) => Number((await client.query(sql)).rows[0].value);
const SEED = "id::text LIKE '5eed%'";

const directory = mkdtempSync(join(tmpdir(), 'seed-data-smoke-'));
const small = ['--profile', 'small'];
const identity = await connect('identity_db');
const course = await connect('course_db');
const media = await connect('media_db');
const notification = await connect('notification_db');

try {
  // Dòng không thuộc seed phải còn nguyên sau khi seeder dọn và nạp lại.
  await identity.query(
    `INSERT INTO identity_users (id, email, password_hash, full_name, role, updated_at)
     VALUES ('00000000-0000-4000-8000-0000000000aa', 'smoke-keep@example.test', 'x', 'Giữ nguyên', 'student', now())
     ON CONFLICT (id) DO NOTHING`,
  );

  const first = await seed(small, join(directory, 'first.json'));
  const second = await seed(small, join(directory, 'second.json'));
  assert.equal(
    second.report.fingerprint,
    first.report.fingerprint,
    'fingerprint phải giống nhau giữa hai lần chạy cùng cấu hình',
  );
  console.log(`✔ cùng fingerprint hai lần chạy: ${first.report.fingerprint}`);

  const different = await seed([...small, '--seed', '7'], join(directory, 'seed7.json'));
  assert.notEqual(
    different.report.fingerprint,
    first.report.fingerprint,
    'đổi seed phải đổi dữ liệu',
  );
  console.log('✔ đổi --seed cho fingerprint khác');

  assert.equal(
    await scalar(
      identity,
      "SELECT count(*) AS value FROM identity_users WHERE email = 'smoke-keep@example.test'",
    ),
    1,
  );
  console.log('✔ dòng không thuộc seed còn nguyên');

  // Số dòng trong DB khớp báo cáo.
  const reported = new Map(
    first.report.databases.flatMap((database) =>
      database.seeded.map((entry) => [entry.key, entry.rows]),
    ),
  );
  assert.equal(
    await scalar(identity, `SELECT count(*) AS value FROM identity_users WHERE ${SEED}`),
    reported.get('identity.students') + reported.get('identity.instructors'),
  );
  assert.equal(
    await scalar(
      identity,
      "SELECT count(*) AS value FROM identity_student_profiles WHERE user_id::text LIKE '5eed%'",
    ),
    reported.get('identity.student_profiles'),
  );
  assert.equal(
    await scalar(course, `SELECT count(*) AS value FROM enrollments WHERE ${SEED}`),
    reported.get('course.enrollments'),
  );
  assert.equal(
    await scalar(notification, `SELECT count(*) AS value FROM notifications WHERE ${SEED}`),
    reported.get('notification.single') + reported.get('notification.bulk'),
  );
  console.log('✔ số dòng trong database khớp báo cáo');

  // Chấm điểm độc lập: tập đáp án đã chọn bằng đúng tập đáp án đúng thì mới có điểm câu đó.
  const grading = await course.query(`
    WITH q AS (
      SELECT qq.id AS question_id, qq.quiz_id, qq.points,
             (SELECT array_agg(o.id ORDER BY o.id) FROM quiz_options o WHERE o.question_id = qq.id AND o.is_correct) AS correct
      FROM quiz_questions qq),
    chosen AS (
      SELECT attempt_id, question_id, array_agg(selected_option_id ORDER BY selected_option_id) AS picked
      FROM quiz_attempt_answers GROUP BY attempt_id, question_id),
    graded AS (
      SELECT a.id, a.score, a.max_score,
             COALESCE(sum(q.points) FILTER (WHERE chosen.picked = q.correct), 0) AS expected_score,
             COALESCE(sum(q.points), 0) AS expected_max
      FROM quiz_attempts a
      JOIN q ON q.quiz_id = a.quiz_id
      LEFT JOIN chosen ON chosen.attempt_id = a.id AND chosen.question_id = q.question_id
      WHERE a.id::text LIKE '5eed%'
      GROUP BY a.id)
    SELECT count(*)::int AS attempts,
           count(*) FILTER (WHERE score <> expected_score OR max_score <> expected_max)::int AS wrong
    FROM graded`);
  assert.ok(grading.rows[0].attempts > 0);
  assert.equal(grading.rows[0].wrong, 0, 'điểm và đáp án phải khớp');
  console.log(`✔ điểm khớp đáp án trên ${grading.rows[0].attempts} lượt làm bài`);

  const invalid = await scalar(
    course,
    `SELECT count(*) AS value FROM quiz_questions q WHERE ${SEED}
       AND (SELECT count(*) FROM quiz_options o WHERE o.question_id = q.id) NOT BETWEEN 2 AND 10`,
  );
  assert.equal(invalid, 0, 'mỗi câu hỏi phải có 2 đến 10 phương án');
  const noCorrect = await scalar(
    course,
    `SELECT count(*) AS value FROM quiz_questions q WHERE ${SEED}
       AND (SELECT count(*) FROM quiz_options o WHERE o.question_id = q.id AND o.is_correct) = 0`,
  );
  assert.equal(noCorrect, 0, 'mỗi câu hỏi phải có ít nhất một đáp án đúng');
  console.log('✔ quiz hợp lệ (2–10 phương án, có đáp án đúng)');

  // Mọi media gốc có usage, và không có dòng nào ở trạng thái xử lý dở.
  const orphanMedia = await scalar(
    media,
    `SELECT count(*) AS value FROM media_objects m WHERE m.source_media_id IS NULL AND m.id::text LIKE '5eed%'
       AND NOT EXISTS (SELECT 1 FROM media_usages u WHERE u.media_id = m.id)`,
  );
  assert.equal(orphanMedia, 0, 'mọi tệp gốc seed phải có usage');
  const pending = await scalar(
    notification,
    `SELECT count(*) AS value FROM notification_batches WHERE ${SEED} AND status <> 'COMPLETED'`,
  );
  assert.equal(pending, 0);
  console.log('✔ media có usage, không có đợt thông báo đang xử lý');

  // Chạy lại với số lượng nhỏ hơn: dữ liệu seed cũ phải được dọn.
  const smaller = await seed(
    [
      ...small,
      '--count',
      'course.enrollments=100',
      '--count',
      'course.progresses=100',
      '--count',
      'course.attempts=50',
    ],
    join(directory, 'smaller.json'),
  );
  assert.equal(
    await scalar(course, `SELECT count(*) AS value FROM enrollments WHERE ${SEED}`),
    100,
  );
  assert.notEqual(smaller.report.fingerprint, first.report.fingerprint);
  console.log('✔ chạy lại với số lượng nhỏ hơn thì dữ liệu cũ được dọn');

  // Vượt trần phải bị từ chối trước khi ghi gì.
  await assert.rejects(
    run('node', [
      SCRIPT,
      '--environment',
      'test',
      '--non-interactive',
      '--yes',
      ...connectionFlags,
      '--profile',
      'small',
      '--count',
      'course.enrollments=999999999',
    ]),
    (error) => /tối đa/u.test(error.stderr) || /tối đa/u.test(error.stdout),
  );
  console.log('✔ số lượng vượt trần bị từ chối');
  console.log('\nseed-data-db-smoke: tất cả kiểm tra đạt');
} finally {
  await identity.query(
    "DELETE FROM identity_users WHERE id = '00000000-0000-4000-8000-0000000000aa'",
  );
  await Promise.all([identity.end(), course.end(), media.end(), notification.end()]);
}

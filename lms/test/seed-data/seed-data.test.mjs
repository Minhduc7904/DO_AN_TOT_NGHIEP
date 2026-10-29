import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  DATABASES,
  DATASETS,
  countStatement,
  fingerprintStatement,
  findDataset,
  wipeStatement,
} from '../../scripts/seed-data/catalogue.mjs';
import {
  assertLocalHost,
  clientConfig,
  parseEnvFile,
} from '../../scripts/seed-data/connection.mjs';
import {
  courseContent,
  courseOfEnrollment,
  documentCount,
  enrollmentCapacities,
  perParent,
  thumbnailCount,
} from '../../scripts/seed-data/distribution.mjs';
import {
  hashedIdSql,
  idSql,
  kindRangeSql,
  randomSql,
  seedRangeSql,
} from '../../scripts/seed-data/ids.mjs';
import {
  createContext,
  resolveCounts,
  suggestCount,
  validatePlan,
} from '../../scripts/seed-data/planner.mjs';
import {
  createProgress,
  formatNumber,
  renderBar,
  renderLine,
} from '../../scripts/seed-data/progress.mjs';
import { chooseCounts, chooseDatabases } from '../../scripts/seed-data/prompts.mjs';
import { seedDatabase } from '../../scripts/seed-data/runner.mjs';
import { main, parseOptions } from '../../scripts/seed-data.mjs';

const LMS_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const EXISTING = Object.fromEntries(DATASETS.map((dataset) => [dataset.key, 0]));
const COMMON = { seed: 42, passwordHash: 'scrypt$salt$hash', existing: EXISTING };
const allKeys = DATABASES.map((database) => database.key);

// ---- ids -------------------------------------------------------------------------------------

test('idSql tạo uuid có tiền tố seed và khoảng id theo loại bản ghi', () => {
  assert.match(idSql('user', 'g.i'), /^\('5eed0001-0000-4000-8000-' \|\| lpad\(/u);
  assert.match(hashedIdSql('answer', 'x'), /^\('5eed0018-' \|\| substr\(md5\(x\), 1, 4\)/u);
  assert.match(kindRangeSql('course'), /5eed0010-.*5eed0011-/u);
  assert.match(seedRangeSql(), /5eed0000-.*5eee0000-/u);
  assert.throws(() => idSql('khong-ton-tai', '1'), /không hợp lệ/u);
});

test('randomSql nhúng seed vào khóa băm để đổi seed thì đổi dữ liệu', () => {
  assert.notEqual(randomSql(1, 'k', 10), randomSql(2, 'k', 10));
  assert.equal(randomSql(7, 'k', 10), randomSql(7, 'k', 10));
});

// ---- distribution ----------------------------------------------------------------------------

test('perParent chia đều và tổng bằng số con', () => {
  const parents = 7;
  const total = Array.from({ length: parents }, (_, index) => perParent(31, parents, index + 1));
  assert.equal(
    total.reduce((sum, value) => sum + value, 0),
    31,
  );
  assert.deepEqual(total, [5, 5, 5, 4, 4, 4, 4]);
});

test('thumbnailCount và documentCount khớp phép đếm trực tiếp theo quy tắc 10 tệp', () => {
  for (const media of [0, 1, 5, 6, 8, 9, 10, 17, 25, 500]) {
    let thumbnails = 0;
    let documents = 0;
    for (let z = 0; z < media; z += 1) {
      if ([0, 1, 2, 3, 4, 7].includes(z % 10)) thumbnails += 1;
      if ([5, 6].includes(z % 10)) documents += 1;
    }
    assert.equal(thumbnailCount(media), thumbnails, `thumbnail ${media}`);
    assert.equal(documentCount(media), documents, `document ${media}`);
  }
});

test('enrollmentCapacities khớp phép đếm trực tiếp và enrollment không trùng cặp', () => {
  const input = { students: 5, courses: 4, lessons: 10, quizzes: 7, enrollments: 20 };
  const content = courseContent(input);
  let progresses = 0;
  let attempts = 0;
  const pairs = new Set();
  for (let i = 1; i <= input.enrollments; i += 1) {
    const course = courseOfEnrollment(i, input.students, input.courses);
    pairs.add(`${((i - 1) % input.students) + 1}:${course}`);
    progresses += content.lessonCount[course];
    attempts += content.quizCount[course];
  }
  assert.equal(pairs.size, input.enrollments);
  assert.deepEqual(enrollmentCapacities(input), { progresses, attempts });
  assert.deepEqual(enrollmentCapacities({ ...input, enrollments: 0 }), {
    progresses: 0,
    attempts: 0,
  });
});

// ---- catalogue -------------------------------------------------------------------------------

test('catalogue có khóa duy nhất, cha đứng trước con và loại id không trùng trong một bảng', () => {
  const keys = DATASETS.map((dataset) => dataset.key);
  assert.equal(new Set(keys).size, keys.length);
  const seen = new Set();
  for (const dataset of DATASETS) {
    for (const need of dataset.needs ?? []) {
      assert.ok(
        seen.has(need) || findDataset(need),
        `${dataset.key} cần mục không tồn tại: ${need}`,
      );
      assert.ok(seen.has(need), `${dataset.key} phải đứng sau ${need}`);
    }
    seen.add(dataset.key);
  }
  const kinds = DATASETS.map((dataset) => `${dataset.db}.${dataset.table}.${dataset.kind}`);
  assert.equal(new Set(kinds).size, kinds.length);
  for (const dataset of DATASETS) {
    assert.equal(
      dataset.derived ? dataset.count !== undefined : dataset.defaults !== undefined,
      true,
    );
  }
});

// Đọc schema.prisma để bắt trường hợp schema đổi mà catalogue chưa theo kịp.
function readPrismaTables(serviceKey) {
  const source = readFileSync(
    resolve(LMS_ROOT, 'services', serviceKey, 'prisma', 'schema.prisma'),
    'utf8',
  );
  const enums = new Set([...source.matchAll(/^enum (\w+)/gmu)].map((match) => match[1]));
  const scalars = new Set([
    'String',
    'Int',
    'BigInt',
    'Float',
    'Decimal',
    'Boolean',
    'DateTime',
    'Json',
    ...enums,
  ]);
  const tables = new Map();
  for (const model of source.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gmu)) {
    const body = model[2];
    const table = body.match(/@@map\("(\w+)"\)/u)?.[1] ?? model[1];
    const columns = new Map();
    for (const line of body.split('\n')) {
      const field = line.trim().match(/^(\w+)\s+(\w+)(\[\])?(\?)?(.*)$/u);
      if (!field || line.trim().startsWith('@@') || line.trim().startsWith('//')) continue;
      const [, name, type, list, optional, attributes] = field;
      if (!scalars.has(type)) continue;
      const column = attributes.match(/@map\("(\w+)"\)/u)?.[1] ?? name;
      columns.set(column, !optional && !list && !attributes.includes('@default('));
    }
    tables.set(table, columns);
  }
  return tables;
}

test('catalogue khớp schema.prisma: bảng, cột tồn tại và mọi cột bắt buộc đều được điền', () => {
  const probeContext = {
    seed: 1,
    passwordHash: 'x',
    get: () => 2,
    capacities: () => ({ progresses: 1, attempts: 1 }),
  };
  for (const database of DATABASES) {
    const tables = readPrismaTables(database.key);
    for (const table of database.wipe)
      assert.ok(tables.has(table), `${database.key}: thiếu bảng ${table}`);
    for (const dataset of database.datasets) {
      for (const statement of dataset.statements(probeContext, 1, 1)) {
        const columns = tables.get(statement.table);
        assert.ok(columns, `${dataset.key}: bảng ${statement.table} không có trong schema.prisma`);
        for (const column of Object.keys(statement.columns)) {
          assert.ok(
            columns.has(column),
            `${dataset.key}: cột ${statement.table}.${column} không có`,
          );
        }
        for (const [column, required] of columns) {
          if (required) {
            assert.ok(
              column in statement.columns,
              `${dataset.key}: thiếu cột bắt buộc ${statement.table}.${column}`,
            );
          }
        }
      }
    }
  }
});

test('câu lệnh dọn, đếm và băm đều giới hạn theo khoảng id seed', () => {
  assert.match(wipeStatement('lessons'), /^DELETE FROM lessons WHERE id >= '5eed0000/u);
  assert.match(countStatement(findDataset('course.courses')), /5eed0010/u);
  assert.match(fingerprintStatement(findDataset('course.courses')), /ORDER BY t\.id/u);
});

// ---- planner ---------------------------------------------------------------------------------

test('resolveCounts cho từng profile luôn hợp lệ khi chọn mọi database', () => {
  for (const profileName of ['small', 'medium', 'large']) {
    const counts = resolveCounts({ ...COMMON, selected: allKeys, profileName });
    const plan = validatePlan({ ...COMMON, selected: allKeys, counts });
    assert.deepEqual(plan.errors, [], profileName);
    assert.equal(plan.items.length, DATASETS.length);
  }
});

test('validatePlan báo lỗi khi vượt trần, thiếu cha hoặc dưới sàn', () => {
  const base = resolveCounts({ ...COMMON, selected: allKeys, profileName: 'small' });
  const tooMany = validatePlan({
    ...COMMON,
    selected: allKeys,
    counts: {
      ...base,
      'course.enrollments': base['student.students'] * base['course.courses'] + 1,
    },
  });
  assert.match(tooMany.errors.join('\n'), /enrollments: tối đa/u);

  const onlyCourse = validatePlan({
    ...COMMON,
    selected: ['course'],
    counts: resolveCounts({ ...COMMON, selected: ['course'], profileName: 'small' }),
  });
  assert.match(onlyCourse.errors.join('\n'), /cần "auth_users \(giảng viên\)"/u);

  const fewOptions = validatePlan({
    ...COMMON,
    selected: allKeys,
    counts: { ...base, 'course.options': 1 },
  });
  assert.match(fewOptions.errors.join('\n'), /quiz_options: tối thiểu/u);
});

test('DB không được chọn lấy số dòng seed đang có để làm cha', () => {
  const existing = {
    ...EXISTING,
    'auth.instructors': 5,
    'auth.students': 100,
    'student.students': 100,
  };
  const selected = ['course'];
  const counts = resolveCounts({ ...COMMON, existing, selected, profileName: 'small' });
  assert.deepEqual(validatePlan({ ...COMMON, existing, selected, counts }).errors, []);
  assert.equal(
    counts['course.enrollments'],
    2_000 > 100 * 20 ? 2_000 : counts['course.enrollments'],
  );
});

test('mục dẫn xuất tự tính và student.students mặc định bằng số học viên auth', () => {
  const counts = resolveCounts({ ...COMMON, selected: allKeys, profileName: 'small' });
  assert.equal(counts['student.students'], counts['auth.students']);
  const context = createContext({ ...COMMON, counts, selected: allKeys });
  assert.equal(context.get('media.thumbnails'), thumbnailCount(counts['media.objects']));
  assert.equal(context.get('notification.bulk'), counts['notification.items']);
  assert.ok(context.get('course.answers') > 0);
  const student = findDataset('student.students');
  assert.equal(suggestCount(student, context, 'large'), counts['auth.students']);
});

test('cảnh báo khi số hồ sơ student lớn hơn số tài khoản auth', () => {
  const counts = resolveCounts({ ...COMMON, selected: allKeys, profileName: 'small' });
  const plan = validatePlan({
    ...COMMON,
    selected: allKeys,
    counts: { ...counts, 'student.students': counts['auth.students'] + 5 },
  });
  assert.match(plan.warnings.join('\n'), /student\.students lớn hơn/u);
});

// ---- progress --------------------------------------------------------------------------------

function fakeStream() {
  const chunks = [];
  return { chunks, isTTY: false, write: (value) => chunks.push(value) };
}

test('renderLine và renderBar mô tả đúng từng trạng thái', () => {
  assert.equal(renderBar(0.5, 10), '█████░░░░░');
  assert.match(
    renderLine({ label: 'a', state: 'done', rows: 1500, ms: 1200 }),
    /✔ a\s+1\.500 dòng · 1,2s · thành công/u,
  );
  assert.match(renderLine({ label: 'a', state: 'failed', message: 'hỏng' }), /✖ a\s+lỗi: hỏng/u);
  assert.match(renderLine({ label: 'a', state: 'skipped' }), /– a\s+bỏ qua/u);
  assert.match(
    renderLine({ label: 'a', state: 'running', units: 100, done: 50, rows: 50, ms: 500 }),
    / 50% 50 dòng · 100 dòng\/s/u,
  );
  assert.equal(formatNumber(1234567), '1.234.567');
});

test('progress không TTY in từng dòng bắt đầu và thành công, không có mã điều khiển', () => {
  const stream = fakeStream();
  const progress = createProgress({ stream, tty: false, clock: () => 0 });
  progress.start('k', 'bảng', 10);
  progress.update('k', { done: 5, rows: 5 });
  progress.done('k', 10);
  progress.start('e', 'bảng lỗi', 5);
  progress.fail('e', 'hỏng');
  const output = stream.chunks.join('');
  assert.match(output, /\[seed\] bảng bắt đầu/u);
  assert.match(output, /✔ bảng/u);
  assert.match(output, /✖ bảng lỗi\s+lỗi: hỏng/u);
  assert.doesNotMatch(output, /\u001b/u);
});

test('progress TTY vẽ lại khối dòng bằng mã điều khiển', () => {
  const stream = fakeStream();
  let now = 0;
  const progress = createProgress({ stream, tty: true, clock: () => (now += 100) });
  progress.start('k', 'bảng', 10);
  progress.update('k', { done: 5, rows: 5 });
  progress.done('k', 10);
  const output = stream.chunks.join('');
  assert.match(output, /\u001b\[1A/u);
  assert.match(output, /✔ bảng/u);
});

// ---- runner ----------------------------------------------------------------------------------

function fakeClient({ failOn } = {}) {
  const queries = [];
  return {
    queries,
    async query(sql) {
      queries.push(sql);
      if (failOn && sql.includes(failOn)) throw new Error('lỗi giả lập');
      const range = sql.match(/generate_series\((\d+)::bigint, (\d+)::bigint\)/u);
      if (sql.startsWith('INSERT') && range)
        return { rowCount: Number(range[2]) - Number(range[1]) + 1, rows: [] };
      if (sql.includes('md5(string_agg')) return { rows: [{ count: 0, hash: '' }], rowCount: 1 };
      return { rowCount: 3, rows: [] };
    },
  };
}

const stubDataset = {
  key: 'x.rows',
  db: 'x',
  table: 'rows',
  kind: 'user',
  label: 'rows',
  statements: (_context, from, to) => [
    {
      table: 'rows',
      columns: { id: 'g.i' },
      from: `FROM generate_series(${from}::bigint, ${to}::bigint) AS g(i)`,
    },
  ],
};
const stubDatabase = { key: 'x', label: 'x_db', wipe: ['rows'], datasets: [stubDataset] };

test('seedDatabase dọn rồi nạp theo chunk trong một transaction và commit', async () => {
  const client = fakeClient();
  const progress = createProgress({ stream: fakeStream(), tty: false });
  const result = await seedDatabase({
    database: stubDatabase,
    items: [{ dataset: stubDataset, count: 25, units: 25 }],
    context: {},
    client,
    chunkSize: 10,
    progress,
  });
  assert.equal(client.queries[0], 'BEGIN');
  assert.ok(client.queries.some((sql) => /^DELETE FROM rows/u.test(sql)));
  assert.equal(client.queries.filter((sql) => sql.startsWith('INSERT')).length, 3);
  assert.ok(client.queries.includes('COMMIT'));
  assert.equal(result.seeded[0].rows, 25);
  assert.deepEqual(result.wiped, [{ table: 'rows', rows: 3 }]);
});

test('seedDatabase rollback khi lỗi và khi số dòng nạp lệch dự kiến', async () => {
  const failing = fakeClient({ failOn: 'INSERT' });
  const progress = createProgress({ stream: fakeStream(), tty: false });
  await assert.rejects(
    seedDatabase({
      database: stubDatabase,
      items: [{ dataset: stubDataset, count: 5, units: 5 }],
      context: {},
      client: failing,
      progress,
    }),
    /lỗi giả lập/u,
  );
  assert.ok(failing.queries.includes('ROLLBACK'));
  assert.ok(!failing.queries.includes('COMMIT'));

  const mismatch = fakeClient();
  await assert.rejects(
    seedDatabase({
      database: stubDatabase,
      items: [{ dataset: stubDataset, count: 99, units: 5 }],
      context: {},
      client: mismatch,
      progress,
    }),
    /dự kiến 99 dòng nhưng nạp được 5/u,
  );
  assert.ok(mismatch.queries.includes('ROLLBACK'));
});

// ---- connection và CLI -----------------------------------------------------------------------

test('assertLocalHost chỉ cho phép host local và clientConfig áp dụng guard cho URL', () => {
  for (const host of ['localhost', '127.0.0.1', '::1', 'postgres'])
    assert.doesNotThrow(() => assertLocalHost(host));
  assert.throws(() => assertLocalHost('db.example.com'), /không được phép/u);
  const database = DATABASES[0];
  assert.throws(
    () =>
      clientConfig(
        database,
        { host: 'localhost' },
        { AUTH_DATABASE_URL: 'postgresql://u:p@db.example.com:5432/auth_db' },
      ),
    /không được phép/u,
  );
  assert.deepEqual(
    clientConfig(database, { host: 'localhost', port: 1, user: 'u', password: 'p' }, {}),
    { host: 'localhost', port: 1, user: 'u', password: 'p', database: 'auth_db' },
  );
});

test('parseEnvFile đọc cặp KEY=VALUE, bỏ chú thích và nháy', () => {
  const path = resolve(LMS_ROOT, '..', 'docker-compose', '.env.example');
  const values = parseEnvFile(path);
  assert.equal(values.POSTGRES_USER, 'lms');
});

test('parseOptions kiểm tra môi trường, profile, --count và database', () => {
  assert.throws(() => parseOptions([]), /--environment/u);
  assert.throws(() => parseOptions(['--environment', 'production']), /--environment/u);
  assert.throws(() => parseOptions(['--environment', 'local', '--profile', 'huge']), /--profile/u);
  assert.throws(
    () => parseOptions(['--environment', 'local', '--count', 'khong.co=1']),
    /--count/u,
  );
  assert.throws(
    () => parseOptions(['--environment', 'local', '--count', 'media.thumbnails=1']),
    /dẫn xuất/u,
  );
  assert.throws(
    () => parseOptions(['--environment', 'local', '--databases', 'auth,nope']),
    /không tồn tại/u,
  );
  const options = parseOptions([
    '--',
    '--environment',
    'test',
    '--count',
    'course.enrollments=10',
    '--seed',
    '7',
  ]);
  assert.equal(options.overrides['course.enrollments'], 10);
  assert.equal(options.seed, 7);
});

test('main hiện hướng dẫn và từ chối ghi khi không tương tác mà thiếu --yes', async () => {
  const lines = [];
  assert.equal(await main(['--help'], { log: (line) => lines.push(line) }), 0);
  assert.match(lines.join('\n'), /Seeder dữ liệu quy mô lớn/u);
  await assert.rejects(
    main(['--environment', 'local', '--non-interactive'], { log() {} }),
    /--yes/u,
  );
  await assert.rejects(
    main(['--environment', 'local', '--non-interactive', '--yes', '--host', 'evil.example.com'], {
      log() {},
    }),
    /không được phép/u,
  );
});

// ---- prompts ---------------------------------------------------------------------------------

test('chooseDatabases khóa database không dùng được và chọn sẵn database sẵn sàng', async () => {
  const probes = Object.fromEntries(
    DATABASES.map((database) => [database.key, { status: 'ok', detail: '', existing: {} }]),
  );
  probes.media = { status: 'unmigrated', detail: 'chưa migrate service media', existing: {} };
  let captured;
  await chooseDatabases(probes, async (config) => {
    captured = config;
    return [];
  });
  const media = captured.choices.find((choice) => choice.value === 'media');
  const auth = captured.choices.find((choice) => choice.value === 'auth');
  assert.match(media.disabled, /chưa migrate/u);
  assert.equal(auth.disabled, false);
  assert.equal(auth.checked, true);
  assert.notEqual(captured.validate([]), true);
});

test('chooseCounts hỏi theo thứ tự cha trước con, truyền trần và gợi ý theo profile', async () => {
  const asked = [];
  const counts = await chooseCounts({
    ...COMMON,
    selected: allKeys,
    profileName: 'small',
    log() {},
    ask: async (config) => {
      asked.push(config.message);
      return config.default;
    },
  });
  assert.ok(asked[0].startsWith('auth_users (học viên)'));
  const plan = validatePlan({ ...COMMON, selected: allKeys, counts });
  assert.deepEqual(plan.errors, []);
  assert.ok(
    asked.findIndex((message) => message.startsWith('courses')) <
      asked.findIndex((message) => message.startsWith('lessons')),
  );
  assert.ok(!asked.some((message) => message.startsWith('quiz_attempt_answers')));
});

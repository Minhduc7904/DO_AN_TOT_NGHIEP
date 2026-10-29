import { randomUUID, scrypt as scryptCallback } from 'node:crypto';
import { existsSync, realpathSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, promisify } from 'node:util';

import { DATABASES, PROFILES, SEED_PASSWORD, findDataset } from './seed-data/catalogue.mjs';
import {
  assertLocalHost,
  defaultCreateClient,
  probeDatabase,
  resolveConnection,
} from './seed-data/connection.mjs';
import { allDatabaseKeys, resolveCounts, validatePlan } from './seed-data/planner.mjs';
import { createProgress, formatDuration, formatNumber } from './seed-data/progress.mjs';
import { DEFAULT_CHUNK_SIZE, runSeed } from './seed-data/runner.mjs';

const scrypt = promisify(scryptCallback);
const ALLOWED_ENVIRONMENTS = new Set(['local', 'test']);
const DEFAULT_SEED = 42;
// Salt cố định để mọi tài khoản seed dùng chung một hash và fingerprint không đổi giữa các lần chạy.
const PASSWORD_SALT = Buffer.from('aiops-seed-salt!', 'utf8');

const HELP = `Seeder dữ liệu quy mô lớn cho các database PostgreSQL của LMS.

Dùng (từ thư mục lms/):
  pnpm run seed:data -- --environment local                # giao diện chọn database và số lượng
  pnpm run seed:data -- --environment local --non-interactive --profile medium --yes

Tùy chọn:
  --environment local|test   Bắt buộc. Seeder từ chối chạy ngoài môi trường local/test.
  --compose-env-file <path>  Đọc POSTGRES_PORT/USER/PASSWORD từ file env của compose.
  --host --port --user --password   Ghi đè kết nối (host chỉ được localhost, 127.0.0.1, ::1, postgres).
  --non-interactive          Không hỏi đáp; dùng cùng --yes. Tự bật khi không có TTY.
  --databases a,b            Danh sách database (${allDatabaseKeys().join(', ')}); mặc định mọi DB sẵn sàng.
  --profile ${PROFILES.join('|')}     Số lượng mặc định (mặc định: medium).
  --count <db.bảng>=<số>     Ghi đè số lượng một mục, lặp lại được (ví dụ course.enrollments=1000).
  --seed <số>                Hạt giống sinh dữ liệu (mặc định ${DEFAULT_SEED}); cùng cấu hình cho cùng dữ liệu.
  --chunk-size <số>          Số dòng mỗi lần ghi (mặc định ${DEFAULT_CHUNK_SIZE}).
  --report <path>            Ghi báo cáo JSON (số dòng, thời gian, fingerprint).
  --yes                      Xác nhận ghi (bắt buộc khi không tương tác).
  --help                     Hiện hướng dẫn.

Seeder dọn dữ liệu seed cũ (id bắt đầu bằng 5eed) rồi nạp lại; không đụng dữ liệu khác.`;

function fail(message) {
  throw new Error(message);
}

export function parseOptions(argv) {
  const { values } = parseArgs({
    args: argv[0] === '--' ? argv.slice(1) : argv,
    strict: true,
    options: {
      environment: { type: 'string' },
      'compose-env-file': { type: 'string' },
      host: { type: 'string' },
      port: { type: 'string' },
      user: { type: 'string' },
      password: { type: 'string' },
      'non-interactive': { type: 'boolean', default: false },
      databases: { type: 'string' },
      profile: { type: 'string', default: 'medium' },
      count: { type: 'string', multiple: true, default: [] },
      seed: { type: 'string', default: String(DEFAULT_SEED) },
      'chunk-size': { type: 'string', default: String(DEFAULT_CHUNK_SIZE) },
      report: { type: 'string' },
      yes: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help) return { help: true };
  if (!ALLOWED_ENVIRONMENTS.has(values.environment ?? '')) {
    fail('Thiếu hoặc sai --environment: chỉ chấp nhận local hoặc test.');
  }
  if (!PROFILES.includes(values.profile))
    fail(`--profile phải là một trong: ${PROFILES.join(', ')}.`);
  const seed = Number(values.seed);
  const chunkSize = Number(values['chunk-size']);
  if (!Number.isInteger(seed) || seed < 0) fail('--seed phải là số nguyên không âm.');
  if (!Number.isInteger(chunkSize) || chunkSize < 1) fail('--chunk-size phải là số nguyên dương.');

  const overrides = {};
  for (const entry of values.count) {
    const [key, raw, ...rest] = entry.split('=');
    const dataset = findDataset(key);
    if (!dataset || rest.length > 0 || raw === undefined) fail(`--count không hợp lệ: ${entry}`);
    if (dataset.derived) fail(`--count không áp dụng cho mục dẫn xuất: ${key}`);
    overrides[key] = Number(raw);
  }

  const databases = values.databases?.split(',').map((entry) => entry.trim());
  for (const key of databases ?? []) {
    if (!DATABASES.some((database) => database.key === key)) fail(`Database không tồn tại: ${key}`);
  }
  return {
    environment: values.environment,
    envFile: values['compose-env-file'] ? resolve(values['compose-env-file']) : undefined,
    flags: Object.fromEntries(
      ['host', 'port', 'user', 'password']
        .filter((name) => values[name])
        .map((name) => [name, values[name]]),
    ),
    nonInteractive: values['non-interactive'],
    databases,
    profileName: values.profile,
    overrides,
    seed,
    chunkSize,
    report: values.report ? resolve(values.report) : undefined,
    yes: values.yes,
  };
}

async function hashSeedPassword() {
  const derived = await scrypt(SEED_PASSWORD, PASSWORD_SALT, 64);
  return `scrypt$${PASSWORD_SALT.toString('base64url')}$${derived.toString('base64url')}`;
}

function printSummary(plan, log) {
  log('\nKế hoạch seed:');
  for (const database of DATABASES) {
    const items = plan.items.filter((item) => item.dataset.db === database.key);
    if (items.length === 0) continue;
    log(`  ${database.label}`);
    for (const item of items) {
      const estimate = item.dataset.estimated ? '≈ ' : '';
      const note = item.dataset.derived ? ' (tự tính)' : '';
      log(
        `    ${item.dataset.label.padEnd(44)} ${estimate}${formatNumber(item.count)} dòng${note}`,
      );
    }
  }
}

function printReport(report, log) {
  log('\nBáo cáo:');
  for (const database of report.databases) {
    log(
      `  ${database.key}: ${formatDuration(database.ms)} · fingerprint ${database.fingerprint.hash.slice(0, 16)}`,
    );
    for (const entry of database.seeded) {
      log(
        `    ${entry.label.padEnd(40)} ${formatNumber(entry.rows).padStart(12)} dòng ${formatDuration(entry.ms).padStart(8)}`,
      );
    }
  }
  log(`  Tổng thời gian: ${formatDuration(report.ms)}`);
  log(`  Fingerprint tổng: ${report.fingerprint}`);
}

export async function main(argv, deps = {}) {
  const log = deps.log ?? console.log;
  const options = parseOptions(argv);
  if (options.help) {
    log(HELP);
    return 0;
  }
  const interactive = !options.nonInteractive && (deps.isTTY ?? process.stdin.isTTY) === true;
  if (!interactive && !options.yes) fail('Chế độ không tương tác cần --yes để xác nhận ghi.');
  if (options.envFile && !existsSync(options.envFile))
    fail(`Không thấy file env: ${options.envFile}`);

  const connection = resolveConnection({ flags: options.flags, envFile: options.envFile });
  assertLocalHost(connection.host);
  const createClient =
    deps.createClient ?? ((database) => defaultCreateClient(database, connection));
  const passwordHash = await hashSeedPassword();

  log('Kiểm tra kết nối các database...');
  const probes = {};
  for (const database of DATABASES)
    probes[database.key] = await probeDatabase(database, createClient);
  const existing = Object.assign({}, ...Object.values(probes).map((probe) => probe.existing));

  let selected;
  let counts;
  if (interactive) {
    const prompts = deps.prompts ?? (await import('./seed-data/prompts.mjs'));
    selected = await prompts.chooseDatabases(probes);
    counts = await prompts.chooseCounts({
      selected,
      existing,
      profileName: options.profileName,
      seed: options.seed,
      passwordHash,
      log,
    });
  } else {
    selected = options.databases ?? allDatabaseKeys().filter((key) => probes[key].status === 'ok');
    for (const key of selected) {
      if (probes[key].status !== 'ok')
        fail(`Database ${key} không dùng được: ${probes[key].detail}`);
    }
    counts = resolveCounts({
      selected,
      profileName: options.profileName,
      overrides: options.overrides,
      existing,
      seed: options.seed,
      passwordHash,
    });
  }
  if (selected.length === 0) fail('Chưa chọn database nào.');

  const plan = validatePlan({ selected, counts, existing, seed: options.seed, passwordHash });
  if (plan.errors.length > 0)
    fail(`Số lượng không hợp lệ:\n${plan.errors.map((error) => `  - ${error}`).join('\n')}`);
  printSummary(plan, log);
  for (const warning of plan.warnings) log(`Cảnh báo: ${warning}`);

  if (interactive) {
    const prompts = deps.prompts ?? (await import('./seed-data/prompts.mjs'));
    const wiping = selected.map((key) => DATABASES.find((database) => database.key === key).label);
    const accepted = await prompts.askConfirm(
      `Dọn dữ liệu seed cũ và nạp dữ liệu mới vào ${wiping.join(', ')}?`,
    );
    if (!accepted) {
      log('Đã hủy, chưa ghi gì.');
      return 0;
    }
  }

  const progress = createProgress({ stream: deps.stdout ?? process.stdout, tty: deps.tty });
  let report;
  try {
    report = await runSeed({
      plan,
      selected,
      createClient,
      chunkSize: options.chunkSize,
      progress,
      databases: DATABASES,
    });
  } catch (error) {
    const done = error.completedDatabases ?? [];
    log(`\nSeed thất bại: ${error.message}`);
    log(
      done.length > 0
        ? `Đã nạp xong: ${done.join(', ')}. Database lỗi đã rollback, các database khác không bị ảnh hưởng.`
        : 'Chưa database nào được ghi (đã rollback).',
    );
    return 1;
  }
  printReport(report, log);
  if (options.report) {
    writeFileSync(
      options.report,
      `${JSON.stringify({ id: randomUUID(), seed: options.seed, profile: options.profileName, ...report }, null, 2)}\n`,
    );
    log(`  Đã ghi báo cáo: ${options.report}`);
  }
  return 0;
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(`[seed:data] ${error.message}`);
      process.exitCode = 1;
    },
  );
}

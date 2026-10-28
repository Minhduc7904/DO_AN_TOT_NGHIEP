import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));
const lmsRoot = resolve(repositoryRoot, 'lms');
const envFile = resolve(repositoryRoot, 'docker-compose', '.env.example');
const composeFile = resolve(repositoryRoot, 'docker-compose', 'compose.full.yaml');
const project = 'aiops-lms-test-reset-seed';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repositoryRoot,
    encoding: 'utf8',
    shell: false,
    stdio: options.inherit ? 'inherit' : 'pipe',
    timeout: options.timeout ?? 25 * 60 * 1_000,
  });
  assert.notEqual(result.error?.code, 'ETIMEDOUT', `${command} vượt quá timeout hữu hạn.`);
  assert.equal(result.status, 0, `${command} ${args.join(' ')}\n${result.stderr ?? ''}`);
  return result.stdout ?? '';
}

const baseArguments = [
  '--environment',
  'test',
  '--project',
  project,
  '--confirm',
  project,
  '--compose-env-file',
  envFile,
];
const composeArguments = [
  'compose',
  '--project-name',
  project,
  '--env-file',
  envFile,
  '--file',
  composeFile,
];

function reset() {
  const output = run(process.execPath, ['scripts/reset-and-seed.mjs', ...baseArguments], {
    cwd: lmsRoot,
  });
  process.stdout.write(output);
  const match = output.match(/^TESTBED_FINGERPRINT_SHA256=([a-f0-9]{64})$/mu);
  assert.ok(match, 'Reset phải xuất fingerprint SHA-256.');
  return match[1];
}

function verifyObservability() {
  const services = run('docker', [...composeArguments, 'ps', '--format', 'json'])
    .trim()
    .split(/\r?\n/u)
    .map((line) => JSON.parse(line));
  assert.equal(services.length, 22, 'Toàn bộ 22 thành phần phải được khởi động.');
  for (const service of services) assert.equal(service.Health, 'healthy', service.Service);
  const output = run(process.execPath, ['test/observability/stack-smoke.mjs'], { cwd: lmsRoot });
  process.stdout.write(output);
  return JSON.parse(output.trim().split(/\r?\n/u).at(-1));
}

try {
  const first = reset();
  const firstSmoke = verifyObservability();

  // Làm bẩn course_db bằng một khóa học lạ; reset phải xóa volume nên fingerprint không đổi.
  run('docker', [
    ...composeArguments,
    'exec',
    '-T',
    'postgres',
    'sh',
    '-c',
    `psql --username "$POSTGRES_USER" --dbname course_db --command "INSERT INTO courses (id, name, status, instructor_id, updated_at) VALUES (gen_random_uuid(), 'dirty', 'DRAFT', gen_random_uuid(), now())"`,
  ]);

  const second = reset();
  assert.equal(second, first, 'Hai lần reset phải tạo cùng fingerprint đã sort.');
  verifyObservability();
  const oldTrace = await fetch(`http://127.0.0.1:3200/api/traces/${firstSmoke.traceId}`, {
    signal: AbortSignal.timeout(5_000),
  });
  assert.equal(oldTrace.status, 404, 'Reset phải xóa telemetry volume của project đã xác nhận.');
  console.log(`Testbed reset hai lần ổn định với fingerprint ${second}.`);
} catch (error) {
  process.stderr.write(run('docker', [...composeArguments, 'logs', '--no-color', '--tail', '80']));
  throw error;
} finally {
  run('docker', [...composeArguments, 'down', '--volumes', '--remove-orphans'], { inherit: true });
}

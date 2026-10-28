import { createHash } from 'node:crypto';
import { existsSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

export const REQUIRED_SERVICES = Object.freeze([
  'auth',
  'course',
  'gateway',
  'notification',
  'postgres',
  'rabbitmq',
  'student',
]);

const SCRIPT_PATH = fileURLToPath(import.meta.url);
export const REPOSITORY_ROOT = realpathSync(resolve(SCRIPT_PATH, '..', '..', '..'));
// File bọc ghép LMS với stack thu thập dữ liệu trong aiops-platform (qua `include`).
export const COMPOSE_FILE = resolve(REPOSITORY_ROOT, 'docker-compose', 'compose.full.yaml');
const ALLOWED_PROJECT = /^(?:aiops-lms-local|aiops-lms-test-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)$/u;
const ALLOWED_ENVIRONMENTS = new Set(['local', 'test']);

function fail(message) {
  throw new Error(message);
}

export function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    // `pnpm run <script> -- ...` forwards its separator on some platforms.
    // Accept exactly one leading separator, while keeping every real option fail-closed.
    if (index === 0 && argument === '--') continue;
    if (!argument.startsWith('--')) fail(`Tham số không hợp lệ: ${argument}`);
    if (
      !['--environment', '--project', '--confirm', '--compose-env-file', '--env-file'].includes(
        argument,
      )
    ) {
      fail(`Tham số không được hỗ trợ: ${argument}`);
    }
    if (values.has(argument)) fail(`Tham số bị lặp: ${argument}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) fail(`Thiếu giá trị cho ${argument}`);
    values.set(argument, value);
    index += 1;
  }

  const composeEnvFile = values.get('--compose-env-file');
  const legacyEnvFile = values.get('--env-file');
  if (composeEnvFile && legacyEnvFile) {
    fail('Không truyền đồng thời --compose-env-file và --env-file.');
  }

  return {
    confirm: values.get('--confirm'),
    envFile: composeEnvFile ?? legacyEnvFile,
    environment: values.get('--environment'),
    legacyEnvFile: Boolean(legacyEnvFile),
    project: values.get('--project'),
  };
}

function isInside(parent, candidate) {
  const pathFromParent = relative(parent, candidate);
  return pathFromParent === '' || (!pathFromParent.startsWith('..') && !isAbsolute(pathFromParent));
}

export function validateOptions(raw, context = {}) {
  const repositoryRoot = context.repositoryRoot ?? REPOSITORY_ROOT;
  const composeFile =
    context.composeFile ?? resolve(repositoryRoot, 'docker-compose', 'compose.full.yaml');
  const pathExists = context.pathExists ?? existsSync;

  if (!raw.environment) fail('Bắt buộc truyền --environment.');
  if (raw.environment === 'production') fail('Từ chối reset môi trường production.');
  if (!ALLOWED_ENVIRONMENTS.has(raw.environment)) {
    fail('--environment chỉ chấp nhận local hoặc test.');
  }
  if (!raw.project) fail('Bắt buộc truyền --project.');
  if (!ALLOWED_PROJECT.test(raw.project)) {
    fail('Project chỉ được là aiops-lms-local hoặc aiops-lms-test-*.');
  }
  if (!raw.confirm || raw.confirm !== raw.project) {
    fail('--confirm phải khớp chính xác --project.');
  }
  if (!raw.envFile) fail('Bắt buộc truyền --compose-env-file.');

  const resolvedRepository = realpathSync(repositoryRoot);
  const envCandidate = resolve(process.cwd(), raw.envFile);
  if (!pathExists(envCandidate)) fail('Không tìm thấy env file đã chỉ định.');
  const envFile = realpathSync(envCandidate);
  const resolvedCompose = realpathSync(composeFile);
  if (!isInside(resolvedRepository, envFile) || !isInside(resolvedRepository, resolvedCompose)) {
    fail('Compose file và env file phải nằm trong repository.');
  }

  return Object.freeze({
    composeFile: resolvedCompose,
    confirm: raw.confirm,
    envFile,
    environment: raw.environment,
    project: raw.project,
    repositoryRoot: resolvedRepository,
  });
}

export function composeArguments(options, command) {
  return [
    'compose',
    '--project-name',
    options.project,
    '--env-file',
    options.envFile,
    '--file',
    options.composeFile,
    ...command,
  ];
}

export function runProcess(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const timeoutMs = options.timeoutMs ?? 20 * 60 * 1_000;
    const child = spawn(command, args, {
      cwd: options.cwd ?? REPOSITORY_ROOT,
      env: options.env ?? process.env,
      shell: false,
      stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      reject(new Error(`${command} vượt quá timeout ${timeoutMs} ms.`));
    }, timeoutMs);
    child.stdout?.on('data', (chunk) => (stdout += chunk));
    child.stderr?.on('data', (chunk) => (stderr += chunk));
    child.once('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
    child.once('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code !== 0) {
        reject(
          new Error(
            `${command} thất bại với exit code ${code}${stderr ? `: ${stderr.trim()}` : ''}`,
          ),
        );
        return;
      }
      resolvePromise({ stderr, stdout });
    });
  });
}

function parseComposePs(stdout) {
  const trimmed = stdout.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return trimmed
      .split(/\r?\n/u)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }
}

export async function verifyHealth(options, runner = runProcess) {
  const { stdout } = await runner(
    'docker',
    composeArguments(options, ['ps', '--all', '--format', 'json']),
    { capture: true, cwd: options.repositoryRoot },
  );
  const containers = parseComposePs(stdout);
  const byService = new Map(containers.map((container) => [container.Service, container]));
  for (const service of REQUIRED_SERVICES) {
    const container = byService.get(service);
    if (!container) fail(`Thiếu container cho service ${service}.`);
    if (container.State !== 'running') fail(`Service ${service} không running.`);
    if (container.Health && container.Health !== 'healthy') {
      fail(`Service ${service} chưa healthy.`);
    }
  }
  return REQUIRED_SERVICES.map((service) => ({ health: byService.get(service).Health, service }));
}

async function composeExec(options, runner, service, args) {
  const { stdout } = await runner(
    'docker',
    composeArguments(options, ['exec', '-T', service, ...args]),
    { capture: true, cwd: options.repositoryRoot },
  );
  return stdout.trim();
}

async function queryPostgres(options, runner, user, database, query) {
  return composeExec(options, runner, 'postgres', [
    'psql',
    '--username',
    user,
    '--dbname',
    database,
    '--tuples-only',
    '--no-align',
    '--field-separator',
    '|',
    '--command',
    query,
  ]);
}

function lines(value) {
  return value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .sort();
}

async function waitForRabbitBaseline(options, runner) {
  let lastError;
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      const output = await composeExec(options, runner, 'rabbitmq', [
        'rabbitmqctl',
        '--quiet',
        '--formatter',
        'json',
        'list_queues',
        'name',
        'durable',
        'messages_ready',
        'messages_unacknowledged',
      ]);
      const queues = JSON.parse(output);
      const notificationQueue = queues.find(
        (queue) => queue.name === 'notification.grade-completed.v1',
      );
      if (
        notificationQueue?.durable === true &&
        Number(notificationQueue.messages_ready) === 0 &&
        Number(notificationQueue.messages_unacknowledged) === 0
      ) {
        return queues
          .map(({ durable, messages_ready, messages_unacknowledged, name }) => ({
            durable,
            messages_ready: Number(messages_ready),
            messages_unacknowledged: Number(messages_unacknowledged),
            name,
          }))
          .sort((left, right) => left.name.localeCompare(right.name));
      }
      lastError = new Error('Queue Notification chưa ở baseline rỗng và durable.');
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_000));
  }
  throw lastError ?? new Error('Không đọc được RabbitMQ baseline.');
}

export async function collectFingerprint(options, runner = runProcess) {
  const postgresUser = await composeExec(options, runner, 'postgres', [
    'printenv',
    'POSTGRES_USER',
  ]);
  const [auth, students, courses, enrollments, rabbit] = await Promise.all([
    queryPostgres(
      options,
      runner,
      postgresUser,
      'auth_db',
      "SELECT id::text,email,role::text,created_at AT TIME ZONE 'UTC' FROM auth_users ORDER BY email;",
    ),
    queryPostgres(
      options,
      runner,
      postgresUser,
      'student_db',
      'SELECT id::text,email,full_name,status::text FROM students ORDER BY email;',
    ),
    queryPostgres(
      options,
      runner,
      postgresUser,
      'course_db',
      'SELECT id::text,name,status::text,instructor_id::text FROM courses ORDER BY id;',
    ),
    queryPostgres(
      options,
      runner,
      postgresUser,
      'course_db',
      'SELECT id::text,course_id::text,student_id::text FROM enrollments ORDER BY id;',
    ),
    waitForRabbitBaseline(options, runner),
  ]);

  const fingerprint = {
    auth: lines(auth),
    courses: lines(courses),
    enrollments: lines(enrollments),
    rabbit,
    students: lines(students),
  };
  const canonical = JSON.stringify(fingerprint);
  return { fingerprint, sha256: createHash('sha256').update(canonical).digest('hex') };
}

export async function resetAndSeed(options, dependencies = {}) {
  const runner = dependencies.runner ?? runProcess;
  const healthCheck = dependencies.healthCheck ?? verifyHealth;
  const fingerprintCollector = dependencies.fingerprintCollector ?? collectFingerprint;
  const runCompose = (command) =>
    runner('docker', composeArguments(options, command), {
      cwd: options.repositoryRoot,
    });

  console.log(`[testbed:reset] Project đã xác nhận: ${options.project}`);
  console.log('[testbed:reset] Bước 1/3: xóa containers, networks và volumes của project.');
  await runCompose(['down', '--volumes', '--remove-orphans']);
  console.log('[testbed:reset] Bước 2/3: build và khởi động Testbed, chờ health checks.');
  await runCompose(['up', '--build', '-d', '--wait']);
  console.log('[testbed:reset] Bước 3/3: xác minh health và fingerprint seed.');
  const health = await healthCheck(options, runner);
  const result = await fingerprintCollector(options, runner);
  console.log(`TESTBED_FINGERPRINT_SHA256=${result.sha256}`);
  console.log(JSON.stringify({ fingerprint: result.fingerprint, health }, null, 2));
  console.log('[testbed:reset] Hoàn tất reset/seed và xác minh thành công.');
  return result;
}

export async function main(argv = process.argv.slice(2)) {
  try {
    const parsed = parseArguments(argv);
    if (parsed.legacyEnvFile) {
      console.warn(
        '[testbed:reset] CẢNH BÁO: --env-file chỉ còn là alias tương thích; hãy dùng --compose-env-file.',
      );
    }
    const options = validateOptions(parsed);
    await resetAndSeed(options);
  } catch (error) {
    console.error(
      `[testbed:reset] THẤT BẠI: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === SCRIPT_PATH) await main();

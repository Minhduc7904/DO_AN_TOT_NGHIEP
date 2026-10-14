import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  parseArguments,
  resetAndSeed,
  runProcess,
  validateOptions,
} from '../../scripts/reset-and-seed.mjs';

const LMS_ROOT = resolve(import.meta.dirname, '..', '..');
const PNPM = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

function parseEnvFile(path) {
  const values = {};
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) throw new Error(`Dòng env không hợp lệ: ${rawLine}`);
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function required(values, key) {
  const value = process.env[key] ?? values[key];
  if (!value) throw new Error(`Thiếu ${key} trong môi trường hoặc Compose env file.`);
  return value;
}

function regressionEnvironment(envFile) {
  const values = parseEnvFile(envFile);
  const postgresHost = '127.0.0.1';
  const postgresPort = required(values, 'POSTGRES_PORT');
  const postgresUser = encodeURIComponent(required(values, 'POSTGRES_USER'));
  const postgresCredential = encodeURIComponent(required(values, 'POSTGRES_PASSWORD'));
  const authUser = encodeURIComponent(required(values, 'AUTH_POSTGRES_USER'));
  const authCredential = encodeURIComponent(required(values, 'AUTH_POSTGRES_PASSWORD'));
  const postgresUrl = (user, credential, database) =>
    `postgresql://${user}:${credential}@${postgresHost}:${postgresPort}/${database}`;
  const rabbitUser = encodeURIComponent(required(values, 'RABBITMQ_DEFAULT_USER'));
  const rabbitCredential = encodeURIComponent(required(values, 'RABBITMQ_DEFAULT_PASS'));
  const rabbitPort = required(values, 'RABBITMQ_PORT');

  return {
    ...process.env,
    COURSE_DATABASE_URL: postgresUrl(postgresUser, postgresCredential, 'course_db'),
    ENROLLMENT_DATABASE_URL: postgresUrl(postgresUser, postgresCredential, 'enrollment_db'),
    GRADING_DATABASE_URL: postgresUrl(postgresUser, postgresCredential, 'grading_db'),
    GRADING_RABBITMQ_URL: `amqp://${rabbitUser}:${rabbitCredential}@127.0.0.1:${rabbitPort}`,
    NOTIFICATION_RABBITMQ_URL: `amqp://${rabbitUser}:${rabbitCredential}@127.0.0.1:${rabbitPort}`,
    SUBMISSION_DATABASE_URL: postgresUrl(postgresUser, postgresCredential, 'submission_db'),
    W1_AUTH_DATABASE_URL: postgresUrl(authUser, authCredential, 'auth_db'),
    W2_REDIS_URL: `redis://127.0.0.1:${required(values, 'REDIS_PORT')}`,
  };
}

async function runStep(name, command, args, env = process.env) {
  const startedAt = Date.now();
  console.info(`[regression] ${name}...`);
  await runProcess(command, args, { cwd: LMS_ROOT, env });
  console.info(`[regression] ${name} xong (${Date.now() - startedAt} ms)`);
}

async function main() {
  const argv = process.argv.slice(2);
  const separators = argv.filter((argument) => argument === '--').length;
  if (separators > 1) throw new Error('Chỉ chấp nhận một dấu phân cách --.');
  const options = validateOptions(parseArguments(argv.filter((argument) => argument !== '--')));
  const env = regressionEnvironment(options.envFile);

  await runStep('build toàn bộ workspace', PNPM, ['run', 'build']);
  await resetAndSeed(options);
  await runStep(
    'hai workflow, topology, timeout và unavailable',
    process.execPath,
    [
      '--experimental-vm-modules',
      './node_modules/jest/bin/jest.js',
      '--config',
      'jest.regression.config.ts',
      '--runInBand',
    ],
    env,
  );
  await runStep(
    'messaging failure/recovery ba vòng',
    process.execPath,
    ['services/notification/test/messaging-stability.mjs'],
    env,
  );
  console.info('[regression] Testbed MVP regression hoàn tất.');
}

main().catch((error) => {
  console.error(`[regression] THẤT BẠI: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

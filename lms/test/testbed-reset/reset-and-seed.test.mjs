import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  COMPOSE_FILE,
  REPOSITORY_ROOT,
  composeArguments,
  parseArguments,
  resetAndSeed,
  validateOptions,
} from '../../scripts/reset-and-seed.mjs';

const exampleEnv = resolve(REPOSITORY_ROOT, 'docker-compose', '.env.example');
const validArguments = [
  '--environment',
  'local',
  '--project',
  'aiops-lms-local',
  '--confirm',
  'aiops-lms-local',
  '--compose-env-file',
  exampleEnv,
];

test('parse và validate target local fail-closed hợp lệ', () => {
  const options = validateOptions(parseArguments(validArguments));
  assert.equal(options.environment, 'local');
  assert.equal(options.project, 'aiops-lms-local');
  assert.equal(options.composeFile, COMPOSE_FILE);
  assert.equal(options.envFile, exampleEnv);
});

for (const [name, args, expected] of [
  ['thiếu project', ['--environment', 'local', '--compose-env-file', exampleEnv], /--project/u],
  [
    'confirm không khớp',
    validArguments.map((value, index) =>
      index === validArguments.indexOf('--confirm') + 1 ? 'aiops-lms-test-other' : value,
    ),
    /--confirm/u,
  ],
  [
    'production',
    validArguments.map((value) => (value === 'local' ? 'production' : value)),
    /production/u,
  ],
  [
    'project ngoài allowlist',
    validArguments.map((value) => (value === 'aiops-lms-local' ? 'shared-production' : value)),
    /Project/u,
  ],
]) {
  test(`từ chối ${name}`, () => {
    assert.throws(() => validateOptions(parseArguments(args)), expected);
  });
}

test('từ chối env file tồn tại nhưng nằm ngoài repository', () => {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'aiops-reset-'));
  const outsideEnv = join(temporaryDirectory, '.env');
  writeFileSync(outsideEnv, 'POSTGRES_USER=test\n');
  const args = validArguments.map((value) => (value === exampleEnv ? outsideEnv : value));
  assert.throws(() => validateOptions(parseArguments(args)), /phải nằm trong repository/u);
});

test('compose arguments luôn khóa đúng project, env và compose file', () => {
  const options = validateOptions(parseArguments(validArguments));
  assert.deepEqual(composeArguments(options, ['down', '--volumes', '--remove-orphans']), [
    'compose',
    '--project-name',
    'aiops-lms-local',
    '--env-file',
    exampleEnv,
    '--file',
    COMPOSE_FILE,
    'down',
    '--volumes',
    '--remove-orphans',
  ]);
});

test('orchestrator dừng ngay khi down thất bại và không báo fingerprint', async () => {
  const calls = [];
  const failure = new Error('down failed');
  await assert.rejects(
    resetAndSeed(
      {
        composeFile: COMPOSE_FILE,
        envFile: exampleEnv,
        project: 'aiops-lms-local',
        repositoryRoot: REPOSITORY_ROOT,
      },
      {
        fingerprintCollector: async () => assert.fail('không được tạo fingerprint'),
        healthCheck: async () => assert.fail('không được kiểm tra health'),
        runner: async (command, args) => {
          calls.push([command, args]);
          throw failure;
        },
      },
    ),
    failure,
  );
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0][1].slice(-3), ['down', '--volumes', '--remove-orphans']);
});

test('CLI guard lỗi trả nonzero và không báo thành công giả', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/reset-and-seed.mjs', '--environment', 'production'],
    {
      cwd: resolve(REPOSITORY_ROOT, 'lms'),
      encoding: 'utf8',
    },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /THẤT BẠI/u);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /Hoàn tất reset\/seed/u);
});

test('canonical pnpm command từ repository root đi qua command resolution tới CLI guard', () => {
  const args = [
    '--dir',
    'lms',
    'run',
    'testbed:reset',
    '--',
    '--environment',
    'production',
    '--project',
    'aiops-lms-local',
    '--confirm',
    'aiops-lms-local',
    '--compose-env-file',
    '../docker-compose/.env',
  ];
  const result =
    process.platform === 'win32'
      ? spawnSync(
          'powershell.exe',
          [
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            `pnpm ${args.map((argument) => `'${argument}'`).join(' ')}`,
          ],
          { cwd: REPOSITORY_ROOT, encoding: 'utf8' },
        )
      : spawnSync('pnpm', args, { cwd: REPOSITORY_ROOT, encoding: 'utf8' });
  const output = `${result.stdout}${result.stderr}`;
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.match(output, /Từ chối reset môi trường production/u);
  assert.doesNotMatch(output, /not found|không tìm thấy env file/iu);
  assert.doesNotMatch(output, /Hoàn tất reset\/seed/u);
});

test('--env-file cũ chỉ là alias tương thích cho direct invocation', () => {
  const parsed = parseArguments([
    '--environment',
    'local',
    '--project',
    'aiops-lms-local',
    '--confirm',
    'aiops-lms-local',
    '--env-file',
    exampleEnv,
  ]);
  assert.equal(parsed.envFile, exampleEnv);
  assert.equal(parsed.legacyEnvFile, true);
  assert.throws(
    () => parseArguments(['--compose-env-file', exampleEnv, '--env-file', exampleEnv]),
    /Không truyền đồng thời/u,
  );
});

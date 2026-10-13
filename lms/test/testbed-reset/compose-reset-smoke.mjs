import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));
const lmsRoot = resolve(repositoryRoot, 'lms');
const envFile = resolve(repositoryRoot, 'docker-compose', '.env.example');
const composeFile = resolve(repositoryRoot, 'docker-compose', 'compose.yaml');
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
  '--env-file',
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

try {
  const first = reset();

  run('docker', [...composeArguments, 'exec', '-T', 'redis', 'redis-cli', 'SET', 'dirty-key', '1']);
  run('docker', [
    ...composeArguments,
    'exec',
    '-T',
    'submission-storage-mock',
    'node',
    '-e',
    "fetch('http://127.0.0.1:3005/api/v1/objects/dirty-object',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({content:'dirty'})}).then(response=>{if(!response.ok)process.exit(1)}).catch(()=>process.exit(1))",
  ]);

  const second = reset();
  assert.equal(second, first, 'Hai lần reset phải tạo cùng fingerprint đã sort.');
  console.log(`Testbed reset hai lần ổn định với fingerprint ${second}.`);
} finally {
  run('docker', [...composeArguments, 'down', '--volumes', '--remove-orphans'], { inherit: true });
}

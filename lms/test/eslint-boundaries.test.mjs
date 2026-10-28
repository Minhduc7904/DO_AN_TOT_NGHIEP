import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';

const workspaceRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const eslint = new ESLint({ cwd: workspaceRoot, overrideConfigFile: 'eslint.config.mjs' });
const courseFilePath = 'services/course/src/boundary-check.ts';

async function lintImport(source) {
  const [result] = await eslint.lintText(`import '${source}';`, { filePath: courseFilePath });

  return result.messages.filter(
    (message) => message.ruleId === 'architecture/no-cross-service-imports',
  );
}

test('chặn import tương đối sang source của service khác', async () => {
  const messages = await lintImport('../../user/src/foo.js');

  assert.equal(messages.length, 1);
});

test('chặn import package của service khác', async () => {
  const messages = await lintImport('@aiops-lms/user');

  assert.equal(messages.length, 1);
});

test('cho phép import published contract', async () => {
  const messages = await lintImport('@aiops-lms/contracts/http/course');

  assert.deepEqual(messages, []);
});

test('cho phép import shared technical package', async () => {
  const messages = await lintImport('@aiops-lms/observability');

  assert.deepEqual(messages, []);
});

const domainFilePath = 'services/student/src/domain/boundary-check.ts';
const applicationFilePath = 'services/student/src/application/use-cases/boundary-check.ts';

async function lintRestricted(source, filePath) {
  const [result] = await eslint.lintText(`import '${source}';`, { filePath });

  return result.messages.filter((message) => message.ruleId === 'no-restricted-imports');
}

test('cho phép shared package common trong service', async () => {
  const messages = await lintImport('@aiops-lms/common/http');

  assert.deepEqual(messages, []);
});

for (const source of [
  '@nestjs/common',
  '@prisma/client',
  '../adapters/persistence/generated/client.js',
  '@aiops-lms/common/http',
  '@aiops-lms/common/messaging',
  '@aiops-lms/observability',
  'amqplib',
]) {
  test(`domain cấm import ${source}`, async () => {
    assert.equal((await lintRestricted(source, domainFilePath)).length, 1);
  });

  test(`application cấm import ${source}`, async () => {
    assert.equal((await lintRestricted(source, applicationFilePath)).length, 1);
  });
}

for (const source of ['@aiops-lms/common/errors', '@aiops-lms/common/ports', 'zod']) {
  test(`application cho phép import ${source}`, async () => {
    assert.deepEqual(await lintRestricted(source, applicationFilePath), []);
  });
}

test('domain cấm import adapters và application', async () => {
  assert.equal((await lintRestricted('../adapters/x.js', domainFilePath)).length, 1);
  assert.equal((await lintRestricted('../application/x.js', domainFilePath)).length, 1);
});

test('application cấm import adapters', async () => {
  assert.equal((await lintRestricted('../../adapters/x.js', applicationFilePath)).length, 1);
});

const publicControllerPath = 'services/student/src/adapters/http/public/boundary-check.ts';
const internalControllerPath = 'services/student/src/adapters/http/internal/boundary-check.ts';

test('controller public cấm import controller internal và ngược lại', async () => {
  assert.equal(
    (await lintRestricted('../internal/student-lookup.controller.js', publicControllerPath)).length,
    1,
  );
  assert.equal(
    (await lintRestricted('../public/student.controller.js', internalControllerPath)).length,
    1,
  );
});

test('hai bề mặt được import presenter dùng chung', async () => {
  assert.deepEqual(
    await lintRestricted('../shared/student.presenter.js', publicControllerPath),
    [],
  );
  assert.deepEqual(
    await lintRestricted('../shared/student.presenter.js', internalControllerPath),
    [],
  );
});

test('domain và application cấm import @aiops-lms/common/auth', async () => {
  assert.equal((await lintRestricted('@aiops-lms/common/auth', domainFilePath)).length, 1);
  assert.equal((await lintRestricted('@aiops-lms/common/auth', applicationFilePath)).length, 1);
});

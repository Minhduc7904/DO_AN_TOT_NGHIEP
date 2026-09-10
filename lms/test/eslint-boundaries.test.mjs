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

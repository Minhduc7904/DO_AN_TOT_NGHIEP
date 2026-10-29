import { resolve } from 'node:path';

import { REPOSITORY_ROOT } from '../../scripts/reset-and-seed.mjs';
import { PNPM, step, withComposeStack } from '../support/compose-stack.mjs';

const POSTMAN_DIR = resolve(REPOSITORY_ROOT, 'postman');
const USAGE = `Dùng: node test/postman/run-postman.mjs --environment test --project aiops-lms-test-<tên> --confirm aiops-lms-test-<tên> [--compose-env-file <file>] [--keep]

Dựng stack LMS (docker-compose/compose.yaml, không observability) từ trạng thái sạch, chạy collection
Postman v2 bằng newman rồi dọn stack. --keep giữ lại stack sau khi chạy để điều tra.`;

async function runCollection(context) {
  await step('newman: postman/lms-v2.postman_collection.json', PNPM, [
    'exec',
    'newman',
    'run',
    resolve(POSTMAN_DIR, 'lms-v2.postman_collection.json'),
    '--environment',
    resolve(POSTMAN_DIR, 'lms-v2.postman_environment.json'),
    '--env-var',
    `gateway_url=${context.gatewayUrl}`,
    '--env-var',
    `mailpit_url=${context.mailpitUrl}`,
    // `fixtures/sample-note.txt` của request upload được tìm tương đối với thư mục này.
    '--working-dir',
    POSTMAN_DIR,
    '--timeout-request',
    '30000',
    '--reporters',
    'cli',
  ]);
  console.info('[postman] Postman v2 hoàn tất.');
}

withComposeStack(process.argv.slice(2), { usage: USAGE, run: runCollection }).catch((error) => {
  console.error(`[postman] THẤT BẠI: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

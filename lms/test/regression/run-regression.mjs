import { resolve } from 'node:path';

import {
  PNPM,
  removeFakeAiProvider,
  startFakeAiProvider,
  step,
  withComposeStack,
} from '../support/compose-stack.mjs';

const WORKFLOWS = [
  'auth-register-login',
  'course-authoring',
  'enroll-and-learn',
  'media-upload',
  'notification-batch-email',
  'ai-lesson',
  'media-cleanup-scheduler',
];

const USAGE = `Dùng: node test/regression/run-regression.mjs --environment test --project aiops-lms-test-<tên> --confirm aiops-lms-test-<tên> [--compose-env-file <file>] [--keep]

Dựng stack LMS (docker-compose/compose.yaml, không observability) từ trạng thái sạch, chạy bảy workflow
regression qua Gateway rồi dọn stack. --keep giữ lại stack sau khi chạy để điều tra.`;

async function runWorkflows(context) {
  await step('build contracts (schema dùng kiểm response)', PNPM, [
    '--filter',
    '@aiops-lms/contracts',
    'build',
  ]);
  const providerEnv = await startFakeAiProvider(context);
  await step(
    'bảy workflow regression qua Gateway',
    process.execPath,
    [
      '--test',
      '--test-concurrency=1',
      '--test-timeout=600000',
      ...WORKFLOWS.map((name) => resolve(import.meta.dirname, `${name}.regression.mjs`)),
    ],
    {
      env: {
        ...process.env,
        REGRESSION_GATEWAY_URL: context.gatewayUrl,
        REGRESSION_MAILPIT_URL: context.mailpitUrl,
        ...providerEnv,
      },
    },
  );
  console.info('[regression] Regression LMS hoàn tất.');
}

withComposeStack(process.argv.slice(2), {
  usage: USAGE,
  run: runWorkflows,
  cleanup: removeFakeAiProvider,
}).catch((error) => {
  console.error(`[regression] THẤT BẠI: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

import { resolve } from 'node:path';

import { runProcess } from '../../scripts/reset-and-seed.mjs';
import { LMS_ROOT, PNPM, step, withComposeStack } from '../support/compose-stack.mjs';

const PROVIDER_SCRIPT = resolve(import.meta.dirname, 'support', 'fake-ai-provider.mjs');
const PROVIDER_IMAGE = 'node:22.13.1-alpine';
const PROVIDER_HOST_PORT = process.env.REGRESSION_AI_PROVIDER_HOST_PORT ?? '18081';
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

const providerNameOf = (context) => `${context.project}-ai-provider`;

async function removeProvider(context) {
  await runProcess('docker', ['rm', '-f', providerNameOf(context)], { cwd: LMS_ROOT });
}

async function runWorkflows(context) {
  const providerName = providerNameOf(context);
  await step('build contracts (schema dùng kiểm response)', PNPM, [
    '--filter',
    '@aiops-lms/contracts',
    'build',
  ]);
  await removeProvider(context).catch(() => undefined);
  await step('dựng provider AI giả', 'docker', [
    'run',
    '-d',
    '--name',
    providerName,
    '--network',
    context.network,
    '-p',
    `127.0.0.1:${PROVIDER_HOST_PORT}:8080`,
    '-v',
    `${PROVIDER_SCRIPT}:/app/provider.mjs:ro`,
    PROVIDER_IMAGE,
    'node',
    '/app/provider.mjs',
  ]);
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
        REGRESSION_AI_PROVIDER_URL: `http://${providerName}:8080/v1`,
        REGRESSION_AI_PROVIDER_STATS_URL: `http://127.0.0.1:${PROVIDER_HOST_PORT}/__seen`,
      },
    },
  );
  console.info('[regression] Regression LMS hoàn tất.');
}

withComposeStack(process.argv.slice(2), {
  usage: USAGE,
  run: runWorkflows,
  cleanup: removeProvider,
}).catch((error) => {
  console.error(`[regression] THẤT BẠI: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

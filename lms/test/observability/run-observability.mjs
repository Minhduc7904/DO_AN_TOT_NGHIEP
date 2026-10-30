import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import {
  PNPM,
  removeFakeAiProvider,
  startFakeAiProvider,
  step,
  withComposeStack,
} from '../support/compose-stack.mjs';

const REGRESSION_DIR = resolve(import.meta.dirname, '..', 'regression');
const WORKFLOWS = [
  'auth-register-login',
  'course-authoring',
  'enroll-and-learn',
  'media-upload',
  'notification-batch-email',
  'ai-lesson',
  'media-cleanup-scheduler',
];
// Thứ tự có ý nghĩa: tracing tạo lỗi (identity treo) cho logs/acceptance dùng, metrics dừng một worker nên
// chạy cuối.
const SMOKES = ['stack', 'tracing', 'logs', 'acceptance', 'metrics'];

const USAGE = `Dùng: node test/observability/run-observability.mjs --environment test --project aiops-lms-test-<tên> --confirm aiops-lms-test-<tên> [--compose-env-file <file>] [--keep]

Dựng stack LMS + observability (docker-compose/compose.full.yaml) từ trạng thái sạch với telemetry bật và
TTL service token 60 giây, chạy bảy workflow regression làm traffic, rồi năm smoke observability
(stack, tracing, logs, acceptance, metrics) và dọn stack. --keep giữ stack để điều tra.`;

async function runSmokes(context) {
  await step('build contracts (schema dùng kiểm response và queue)', PNPM, [
    '--filter',
    '@aiops-lms/contracts',
    'build',
  ]);
  const providerEnv = await startFakeAiProvider(context);
  await step(
    'bảy workflow regression làm traffic',
    process.execPath,
    [
      '--test',
      '--test-concurrency=1',
      '--test-timeout=600000',
      ...WORKFLOWS.map((name) => resolve(REGRESSION_DIR, `${name}.regression.mjs`)),
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
  // Chờ một chu kỳ export (metric 5 giây + batch 1 giây + scrape 5 giây) để telemetry vào backend.
  await delay(15_000);
  const { options } = context;
  for (const name of SMOKES) {
    const args = [resolve(import.meta.dirname, `${name}-smoke.mjs`)];
    if (name !== 'stack') {
      args.push(
        '--environment',
        options.environment,
        '--project',
        options.project,
        '--confirm',
        options.confirm,
        '--compose-env-file',
        options.envFile,
      );
    }
    await step(`smoke observability ${name}`, process.execPath, args);
  }
  console.info('[observability] Smoke observability hoàn tất.');
}

withComposeStack(process.argv.slice(2), {
  usage: USAGE,
  run: runSmokes,
  cleanup: removeFakeAiProvider,
  stack: 'full',
  telemetry: true,
  extraEnv: { IDENTITY_SERVICE_TOKEN_TTL_SECONDS: '60' },
}).catch((error) => {
  console.error(
    `[observability] THẤT BẠI: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});

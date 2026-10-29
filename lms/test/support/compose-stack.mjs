import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  REPOSITORY_ROOT,
  composeArguments,
  parseArguments,
  runProcess,
  validateOptions,
} from '../../scripts/reset-and-seed.mjs';

export const LMS_ROOT = resolve(import.meta.dirname, '..', '..');
export const PNPM = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
// `lms`: chỉ LMS (không có Collector nên không có telemetry); `full`: LMS ghép observability.
const COMPOSE_FILES = {
  lms: resolve(REPOSITORY_ROOT, 'docker-compose', 'compose.yaml'),
  full: resolve(REPOSITORY_ROOT, 'docker-compose', 'compose.full.yaml'),
};
const DEFAULT_ENV_FILE = resolve(REPOSITORY_ROOT, 'docker-compose', '.env.example');

export function parseEnvFile(path) {
  const values = {};
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
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

export async function step(name, command, args, options = {}) {
  const startedAt = Date.now();
  console.info(`[stack] ${name}...`);
  await runProcess(command, args, { cwd: LMS_ROOT, ...options });
  console.info(`[stack] ${name} xong (${Date.now() - startedAt} ms)`);
}

const FAKE_AI_PROVIDER_SCRIPT = resolve(
  import.meta.dirname,
  '..',
  'regression',
  'support',
  'fake-ai-provider.mjs',
);
const FAKE_AI_PROVIDER_IMAGE = 'node:22.13.1-alpine';
const FAKE_AI_PROVIDER_HOST_PORT = process.env.REGRESSION_AI_PROVIDER_HOST_PORT ?? '18081';
const fakeAiProviderName = (context) => `${context.project}-ai-provider`;

export async function removeFakeAiProvider(context) {
  await runProcess('docker', ['rm', '-f', fakeAiProviderName(context)], { cwd: LMS_ROOT });
}

/**
 * Chạy provider AI giả (HTTP stub OpenAI-compatible) trong network của stack để `ai`/`ai-worker` gọi
 * tới. Trả biến môi trường `REGRESSION_AI_PROVIDER_*` mà workflow `ai-lesson` cần.
 */
export async function startFakeAiProvider(context) {
  const name = fakeAiProviderName(context);
  await removeFakeAiProvider(context).catch(() => undefined);
  await step('dựng provider AI giả', 'docker', [
    'run',
    '-d',
    '--name',
    name,
    '--network',
    context.network,
    '-p',
    `127.0.0.1:${FAKE_AI_PROVIDER_HOST_PORT}:8080`,
    '-v',
    `${FAKE_AI_PROVIDER_SCRIPT}:/app/provider.mjs:ro`,
    FAKE_AI_PROVIDER_IMAGE,
    'node',
    '/app/provider.mjs',
  ]);
  return {
    REGRESSION_AI_PROVIDER_URL: `http://${name}:8080/v1`,
    REGRESSION_AI_PROVIDER_STATS_URL: `http://127.0.0.1:${FAKE_AI_PROVIDER_HOST_PORT}/__seen`,
  };
}

/**
 * Dựng stack từ trạng thái sạch, gọi `run(context)` rồi dọn stack; `--keep` giữ stack để điều tra.
 * Mặc định chỉ dựng LMS (`docker-compose/compose.yaml`) và tắt OTel, dùng cho regression và Postman.
 * `stack: 'full'` dựng thêm observability (`compose.full.yaml`) và `telemetry: true` giữ OTel bật;
 * `extraEnv` ghi đè biến môi trường của lệnh compose (ví dụ TTL service token ngắn).
 * `context` gồm `options`, `envValues` (env file), `project`, `network`, `gatewayUrl`, `mailpitUrl`,
 * và `observability` (URL Prometheus/Tempo/Loki/Grafana/RabbitMQ management) khi `stack: 'full'`.
 */
export async function withComposeStack(
  argv,
  { usage, run, cleanup, stack = 'lms', telemetry = false, extraEnv = {} },
) {
  const args = argv.filter((argument) => argument !== '--');
  if (args.includes('--help')) return console.info(usage);
  const keep = args.includes('--keep');
  const parsed = parseArguments(args.filter((argument) => argument !== '--keep'));
  const options = validateOptions(
    { ...parsed, envFile: parsed.envFile ?? DEFAULT_ENV_FILE },
    { composeFile: COMPOSE_FILES[stack] },
  );
  const envValues = parseEnvFile(options.envFile);
  // Mặc định chỉ kiểm chức năng: tắt export OTLP để khỏi phụ thuộc collector không có trong stack.
  // Job dọn media chạy với retention_hours=0 thay vì chờ media đủ tuổi.
  const composeEnv = {
    ...process.env,
    ...(telemetry ? {} : { OTEL_SDK_DISABLED: 'true' }),
    MEDIA_CLEANUP_MIN_RETENTION_HOURS: '0',
    ...extraEnv,
  };
  const compose = (command) =>
    step(`docker compose ${command[0]}`, 'docker', composeArguments(options, command), {
      cwd: REPOSITORY_ROOT,
      env: composeEnv,
    });
  const context = {
    options,
    envValues,
    project: options.project,
    network: `${options.project}_lms-network`,
    gatewayUrl: `http://127.0.0.1:${envValues.GATEWAY_PORT ?? '3000'}`,
    mailpitUrl: `http://127.0.0.1:${envValues.MAILPIT_UI_PORT ?? '8025'}`,
    // Cổng host của observability lấy từ biến shell như compose (mặc định theo `.env.example`).
    observability: {
      prometheusUrl: `http://127.0.0.1:${process.env.PROMETHEUS_PORT ?? '9090'}`,
      tempoUrl: `http://127.0.0.1:${process.env.TEMPO_PORT ?? '3200'}`,
      lokiUrl: `http://127.0.0.1:${process.env.LOKI_PORT ?? '3100'}`,
      grafanaUrl: `http://127.0.0.1:${process.env.GRAFANA_PORT ?? '3008'}`,
      rabbitmqUrl: `http://127.0.0.1:${envValues.RABBITMQ_MANAGEMENT_PORT ?? '15672'}`,
    },
  };

  let failure;
  try {
    await compose(['down', '--volumes', '--remove-orphans']);
    await compose(['up', '--build', '-d', '--wait']);
    await run(context);
  } catch (error) {
    failure = error;
    // Stack sắp bị dọn nên in log container trước, nếu không CI chỉ còn thông báo lỗi trống.
    await compose(['logs', '--no-color', '--tail', '200']).catch(() => undefined);
  } finally {
    if (!keep) {
      await cleanup?.(context)?.catch(() => undefined);
      await compose(['down', '--volumes', '--remove-orphans']).catch(() => undefined);
    }
  }
  if (failure) throw failure;
}

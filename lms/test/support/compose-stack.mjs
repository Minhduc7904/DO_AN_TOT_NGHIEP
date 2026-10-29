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
const COMPOSE_FILE = resolve(REPOSITORY_ROOT, 'docker-compose', 'compose.yaml');
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

/**
 * Dựng stack LMS từ trạng thái sạch (chỉ `docker-compose/compose.yaml`, không observability), gọi
 * `run(context)` rồi dọn stack; `--keep` giữ stack để điều tra. Dùng chung cho regression và Postman.
 * `context` gồm `options`, `envValues` (env file), `project`, `network`, `gatewayUrl`, `mailpitUrl`.
 */
export async function withComposeStack(argv, { usage, run, cleanup }) {
  const args = argv.filter((argument) => argument !== '--');
  if (args.includes('--help')) return console.info(usage);
  const keep = args.includes('--keep');
  const parsed = parseArguments(args.filter((argument) => argument !== '--keep'));
  const options = validateOptions(
    { ...parsed, envFile: parsed.envFile ?? DEFAULT_ENV_FILE },
    { composeFile: COMPOSE_FILE },
  );
  const envValues = parseEnvFile(options.envFile);
  // Chỉ kiểm chức năng: tắt export OTLP để khỏi phụ thuộc collector không có trong stack, và cho
  // job dọn media chạy với retention_hours=0 thay vì chờ media đủ tuổi.
  const composeEnv = {
    ...process.env,
    OTEL_SDK_DISABLED: 'true',
    MEDIA_CLEANUP_MIN_RETENTION_HOURS: '0',
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

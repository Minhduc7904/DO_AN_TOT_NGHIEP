#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

/**
 * CLI bật/tắt fault cho thí nghiệm. Không phụ thuộc thư viện ngoài; gọi HTTP API của toxiproxy và
 * endpoint điều khiển của LLM stub. Mỗi lệnh in đúng một dòng JSON (thời điểm UTC, hành động, kết quả)
 * để runner ghi vào nhật ký run làm dấu vết thời điểm fault thật.
 */

export const USAGE = `Dùng: node aiops-platform/faults/fault-control.mjs <lệnh> [tham số]

Lệnh proxy (tên proxy: course-to-postgres, media-to-minio, media-worker-to-minio):
  status                                   trạng thái mọi proxy và LLM stub
  latency <proxy> <ms> [--jitter <ms>]     chèn trễ chiều server → client (thay toxic cũ nếu có)
  disconnect <proxy>                       tắt proxy: cắt kết nối đang mở, từ chối kết nối mới
  reconnect <proxy>                        bật lại proxy
  clear [<proxy>]                          gỡ mọi toxic và bật lại (không có tên: mọi proxy)

Lệnh container (C6; chỉ service runtime của LMS):
  container pause|unpause <service>        docker pause/unpause container của service
Lệnh LLM stub:
  llm set [--latency-ms N] [--jitter-ms N] [--error-rate R] [--error-mode status|disconnect]
          [--error-status S] [--affect-models true|false] [--seed N]
  llm reset                                về mặc định (không trễ, không lỗi)

Biến môi trường: TOXIPROXY_URL (mặc định http://127.0.0.1:8474),
                 LLM_STUB_CONTROL_URL (mặc định http://127.0.0.1:18081),
                 COMPOSE_PROJECT_NAME (mặc định aiops-lms; container là <project>-<service>-1).`;

/** Service runtime được phép pause (catalogue topology v2); không cho pause hạ tầng hay observability. */
export const PAUSABLE_SERVICES = Object.freeze([
  'gateway',
  'identity',
  'course',
  'media',
  'media-worker',
  'notification',
  'notification-worker',
  'ai',
  'ai-worker',
  'scheduler',
  'scheduler-worker',
]);

const LATENCY_TOXIC = 'latency';

class UsageError extends Error {}

function parseOptions(tokens) {
  const options = {};
  const positional = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.startsWith('--')) {
      const value = tokens[index + 1];
      if (value === undefined || value.startsWith('--'))
        throw new UsageError(`Thiếu giá trị cho ${token}`);
      options[token.slice(2)] = value;
      index += 1;
    } else {
      positional.push(token);
    }
  }
  return { options, positional };
}

function nonNegativeInt(name, raw) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0)
    throw new UsageError(`${name} phải là số nguyên ≥ 0, nhận ${raw}`);
  return value;
}

const LLM_OPTION_PARSERS = {
  'latency-ms': ['latency_ms', (raw) => nonNegativeInt('--latency-ms', raw)],
  'jitter-ms': ['jitter_ms', (raw) => nonNegativeInt('--jitter-ms', raw)],
  'error-rate': ['error_rate', Number],
  'error-mode': ['error_mode', String],
  'error-status': ['error_status', Number],
  'affect-models': [
    'affect_models',
    (raw) => {
      if (raw !== 'true' && raw !== 'false')
        throw new UsageError(`--affect-models phải là true/false, nhận ${raw}`);
      return raw === 'true';
    },
  ],
  seed: ['seed', Number],
};

/** Chuyển dòng lệnh thành danh sách lời gọi HTTP cần thực hiện (thuần, để test). */
export function planCommand(argv) {
  const [command, ...rest] = argv;
  const { options, positional } = parseOptions(rest);
  const proxyName = () => {
    if (!positional[0]) throw new UsageError(`Lệnh ${command} cần tên proxy`);
    return positional[0];
  };

  switch (command) {
    case 'status':
      return { action: 'status' };
    case 'latency': {
      const proxy = proxyName();
      if (positional[1] === undefined) throw new UsageError('Lệnh latency cần số mili giây');
      const latency = nonNegativeInt('latency', positional[1]);
      const jitter = options.jitter === undefined ? 0 : nonNegativeInt('--jitter', options.jitter);
      return { action: 'latency', proxy, latency, jitter };
    }
    case 'disconnect':
      return { action: 'set-enabled', proxy: proxyName(), enabled: false };
    case 'reconnect':
      return { action: 'set-enabled', proxy: proxyName(), enabled: true };
    case 'clear':
      return { action: 'clear', proxy: positional[0] ?? null };
    case 'container': {
      const [operation, service] = positional;
      if (operation !== 'pause' && operation !== 'unpause') {
        throw new UsageError('Lệnh container cần pause hoặc unpause');
      }
      if (!PAUSABLE_SERVICES.includes(service)) {
        throw new UsageError(`Service không được phép: ${service ?? '(thiếu)'}`);
      }
      return { action: 'container', operation, service };
    }
    case 'llm': {
      const sub = positional[0];
      if (sub === 'reset') return { action: 'llm-reset' };
      if (sub !== 'set') throw new UsageError('Lệnh llm cần set hoặc reset');
      const patch = {};
      for (const [flag, raw] of Object.entries(options)) {
        const parser = LLM_OPTION_PARSERS[flag];
        if (!parser) throw new UsageError(`Tham số llm không hợp lệ: --${flag}`);
        patch[parser[0]] = parser[1](raw);
      }
      if (Object.keys(patch).length === 0) throw new UsageError('llm set cần ít nhất một tham số');
      return { action: 'llm-set', patch };
    }
    default:
      throw new UsageError(command ? `Lệnh không hợp lệ: ${command}` : 'Thiếu lệnh');
  }
}

async function request(fetchImpl, method, url, body) {
  const response = await fetchImpl(url, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  return { status: response.status, body: parsed };
}

function expectOk(result, label) {
  if (result.status >= 200 && result.status < 300) return result.body;
  const detail = typeof result.body === 'string' ? result.body : JSON.stringify(result.body);
  throw new Error(`${label}: HTTP ${result.status} ${detail ?? ''}`.trim());
}

async function removeToxics(fetchImpl, toxiproxy, proxy) {
  const toxics = expectOk(
    await request(fetchImpl, 'GET', `${toxiproxy}/proxies/${proxy}/toxics`),
    `đọc toxic của ${proxy}`,
  );
  for (const toxic of toxics) {
    expectOk(
      await request(fetchImpl, 'DELETE', `${toxiproxy}/proxies/${proxy}/toxics/${toxic.name}`),
      `gỡ toxic ${toxic.name} của ${proxy}`,
    );
  }
  return toxics.map((toxic) => toxic.name);
}

/** Thực hiện kế hoạch; trả object kết quả để in thành một dòng JSON. */
const execFileAsync = promisify(execFile);

export async function execute(
  plan,
  { fetchImpl = fetch, env = process.env, execImpl = execFileAsync } = {},
) {
  const toxiproxy = (env.TOXIPROXY_URL ?? 'http://127.0.0.1:8474').replace(/\/$/u, '');
  const llm = (env.LLM_STUB_CONTROL_URL ?? 'http://127.0.0.1:18081').replace(/\/$/u, '');

  switch (plan.action) {
    case 'status': {
      const proxies = expectOk(
        await request(fetchImpl, 'GET', `${toxiproxy}/proxies`),
        'đọc proxy',
      );
      const llmState = await request(fetchImpl, 'GET', `${llm}/__control`).catch((error) => ({
        status: 0,
        body: error.message,
      }));
      return {
        proxies: Object.values(proxies).map((proxy) => ({
          name: proxy.name,
          enabled: proxy.enabled,
          toxics: proxy.toxics,
        })),
        llm_stub: llmState.status === 200 ? llmState.body : { unreachable: llmState.body },
      };
    }
    case 'latency': {
      const existing = expectOk(
        await request(fetchImpl, 'GET', `${toxiproxy}/proxies/${plan.proxy}/toxics`),
        `đọc toxic của ${plan.proxy}`,
      );
      if (existing.some((toxic) => toxic.name === LATENCY_TOXIC)) {
        expectOk(
          await request(
            fetchImpl,
            'DELETE',
            `${toxiproxy}/proxies/${plan.proxy}/toxics/${LATENCY_TOXIC}`,
          ),
          `gỡ toxic latency cũ của ${plan.proxy}`,
        );
      }
      const toxic = expectOk(
        await request(fetchImpl, 'POST', `${toxiproxy}/proxies/${plan.proxy}/toxics`, {
          name: LATENCY_TOXIC,
          type: 'latency',
          stream: 'downstream',
          toxicity: 1,
          attributes: { latency: plan.latency, jitter: plan.jitter },
        }),
        `chèn trễ vào ${plan.proxy}`,
      );
      return { proxy: plan.proxy, toxic };
    }
    case 'set-enabled': {
      const proxy = expectOk(
        await request(fetchImpl, 'POST', `${toxiproxy}/proxies/${plan.proxy}`, {
          enabled: plan.enabled,
        }),
        `${plan.enabled ? 'bật' : 'tắt'} ${plan.proxy}`,
      );
      return { proxy: proxy.name, enabled: proxy.enabled };
    }
    case 'clear': {
      const names = plan.proxy
        ? [plan.proxy]
        : Object.keys(
            expectOk(await request(fetchImpl, 'GET', `${toxiproxy}/proxies`), 'đọc proxy'),
          );
      const cleared = [];
      for (const name of names) {
        const removed = await removeToxics(fetchImpl, toxiproxy, name);
        expectOk(
          await request(fetchImpl, 'POST', `${toxiproxy}/proxies/${name}`, { enabled: true }),
          `bật lại ${name}`,
        );
        cleared.push({ proxy: name, removed_toxics: removed });
      }
      return { cleared };
    }
    case 'llm-set':
      return expectOk(
        await request(fetchImpl, 'PUT', `${llm}/__control`, plan.patch),
        'đặt cấu hình LLM stub',
      );
    case 'llm-reset':
      return expectOk(await request(fetchImpl, 'POST', `${llm}/__control/reset`), 'reset LLM stub');
    case 'container': {
      const container = `${env.COMPOSE_PROJECT_NAME ?? 'aiops-lms'}-${plan.service}-1`;
      await execImpl('docker', [plan.operation, container]);
      const { stdout } = await execImpl('docker', [
        'inspect',
        '--format',
        '{{.State.Status}}',
        container,
      ]);
      return { container, state: stdout.trim() };
    }
    default:
      throw new Error(`Hành động không hỗ trợ: ${plan.action}`);
  }
}

export async function main(
  argv,
  { fetchImpl, env, execImpl, out = console.log, err = console.error } = {},
) {
  let plan;
  try {
    plan = planCommand(argv);
  } catch (error) {
    if (error instanceof UsageError) {
      err(`${error.message}\n\n${USAGE}`);
      return 2;
    }
    throw error;
  }
  try {
    const result = await execute(plan, { fetchImpl, env, execImpl });
    out(JSON.stringify({ ts: new Date().toISOString(), ok: true, ...plan, result }));
    return 0;
  } catch (error) {
    out(
      JSON.stringify({
        ts: new Date().toISOString(),
        ok: false,
        ...plan,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = await main(process.argv.slice(2));
}

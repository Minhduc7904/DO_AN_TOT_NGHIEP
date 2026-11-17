import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

import {
  DEFAULT_CONTROL,
  buildChatResponse,
  buildErrorBody,
  createRng,
  decideFault,
  mergeControl,
} from './stub-logic.mjs';

/**
 * LLM stub cho thí nghiệm: provider tương thích OpenAI (`GET /v1/models`, `POST /v1/chat/completions`)
 * cộng các endpoint điều khiển dùng cho fault injection:
 *
 * - `GET /__control`             cấu hình hiện tại và seed
 * - `PUT /__control`             gộp cấu hình mới (trường nào gửi thì đổi trường đó); có `seed` thì gieo lại
 * - `POST /__control/reset`      về cấu hình mặc định, gieo lại seed ban đầu
 * - `GET /__stats`               số lượt gọi, lỗi đã chèn, tổng thời gian trễ
 * - `POST /__stats/reset`        xóa bộ đếm
 * - `GET /__seen`                tương thích provider giả của regression (`bearers`, `chat_calls`)
 *
 * Mỗi lần đổi cấu hình ghi một dòng JSON ra stdout (`event: control.updated`) làm dấu vết thời điểm
 * thật của fault cho ground truth.
 */

const MAX_BODY_BYTES = 5 * 1024 * 1024;
const MAX_REMEMBERED_BEARERS = 50;

function emptyStats() {
  return {
    chat_calls: 0,
    models_calls: 0,
    injected_errors: 0,
    delayed_calls: 0,
    total_delay_ms: 0,
  };
}

function send(response, status, body) {
  if (response.destroyed) return;
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

class BodyTooLargeError extends Error {}

function readJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new BodyTooLargeError(`Body vượt ${MAX_BODY_BYTES} byte`));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('error', reject);
    request.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      if (text.length === 0) return resolve({});
      try {
        resolve(JSON.parse(text));
      } catch (error) {
        reject(new SyntaxError(`Body không phải JSON: ${error.message}`));
      }
    });
  });
}

function sleep(ms) {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

export function createLlmStub({ seed = 1, control = {}, log = console.log } = {}) {
  const initialSeed = Number(seed);
  if (!Number.isInteger(initialSeed)) throw new RangeError(`seed phải là số nguyên, nhận ${seed}`);
  let currentSeed = initialSeed;
  let rng = createRng(currentSeed);
  let current = mergeControl(DEFAULT_CONTROL, control);
  let stats = emptyStats();
  const bearers = [];

  const record = (event) => log(JSON.stringify({ ts: new Date().toISOString(), ...event }));

  function rememberBearer(header) {
    const bearer = /^Bearer (.+)$/u.exec(header ?? '')?.[1];
    if (!bearer || bearers.includes(bearer)) return;
    bearers.push(bearer);
    if (bearers.length > MAX_REMEMBERED_BEARERS) bearers.shift();
  }

  /** Áp dụng trễ/lỗi; trả `true` nếu đã trả lời lỗi (bên gọi không trả lời tiếp). */
  async function applyFault(request, response) {
    const decision = decideFault(rng, current);
    if (decision.delayMs > 0) {
      stats.delayed_calls += 1;
      stats.total_delay_ms += decision.delayMs;
      await sleep(decision.delayMs);
    }
    if (!decision.error) return false;
    stats.injected_errors += 1;
    if (decision.error.mode === 'disconnect') {
      request.socket.destroy();
    } else {
      send(response, decision.error.status, buildErrorBody(decision.error.status));
    }
    return true;
  }

  async function handle(request, response) {
    const url = new URL(request.url ?? '/', 'http://llm-stub');
    const route = `${request.method} ${url.pathname}`;

    switch (route) {
      case 'GET /__control':
        return send(response, 200, { seed: currentSeed, control: current });
      case 'PUT /__control': {
        const patch = await readJson(request);
        const { seed: nextSeed, ...rest } = patch;
        const next = mergeControl(current, rest);
        if (nextSeed !== undefined) {
          if (!Number.isInteger(nextSeed))
            throw new RangeError(`seed phải là số nguyên, nhận ${nextSeed}`);
          currentSeed = nextSeed;
          rng = createRng(currentSeed);
        }
        current = next;
        record({ event: 'control.updated', seed: currentSeed, control: current });
        return send(response, 200, { seed: currentSeed, control: current });
      }
      case 'POST /__control/reset':
        current = { ...DEFAULT_CONTROL };
        currentSeed = initialSeed;
        rng = createRng(currentSeed);
        record({ event: 'control.updated', seed: currentSeed, control: current });
        return send(response, 200, { seed: currentSeed, control: current });
      case 'GET /__stats':
        return send(response, 200, stats);
      case 'POST /__stats/reset':
        stats = emptyStats();
        return send(response, 200, stats);
      case 'GET /__seen':
        return send(response, 200, { bearers: [...bearers], chat_calls: stats.chat_calls });
      case 'GET /v1/models': {
        rememberBearer(request.headers.authorization);
        stats.models_calls += 1;
        if (current.affect_models && (await applyFault(request, response))) return undefined;
        return send(response, 200, { object: 'list', data: [{ id: 'llm-stub', object: 'model' }] });
      }
      case 'POST /v1/chat/completions': {
        rememberBearer(request.headers.authorization);
        stats.chat_calls += 1;
        const body = await readJson(request);
        if (await applyFault(request, response)) return undefined;
        return send(response, 200, buildChatResponse(body));
      }
      default:
        return send(response, 404, { error: { message: `Không có route ${route}` } });
    }
  }

  const server = createServer((request, response) => {
    handle(request, response).catch((error) => {
      const status = error instanceof BodyTooLargeError ? 413 : 400;
      send(response, status, { error: { message: error.message } });
    });
  });

  return {
    server,
    get control() {
      return current;
    },
    listen(port, host = '0.0.0.0') {
      return new Promise((resolve) => server.listen(port, host, () => resolve(server.address())));
    },
    close() {
      return new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      });
    },
  };
}

function controlFromEnv(env) {
  const control = {};
  if (env.LLM_STUB_LATENCY_MS) control.latency_ms = Number(env.LLM_STUB_LATENCY_MS);
  if (env.LLM_STUB_JITTER_MS) control.jitter_ms = Number(env.LLM_STUB_JITTER_MS);
  if (env.LLM_STUB_ERROR_RATE) control.error_rate = Number(env.LLM_STUB_ERROR_RATE);
  if (env.LLM_STUB_ERROR_MODE) control.error_mode = env.LLM_STUB_ERROR_MODE;
  if (env.LLM_STUB_ERROR_STATUS) control.error_status = Number(env.LLM_STUB_ERROR_STATUS);
  return control;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const stub = createLlmStub({
    seed: Number(process.env.LLM_STUB_SEED ?? 1),
    control: controlFromEnv(process.env),
  });
  const port = Number(process.env.LLM_STUB_PORT ?? 8080);
  const address = await stub.listen(port);
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      event: 'llm-stub.started',
      port: address.port,
      control: stub.control,
    }),
  );
  const shutdown = () => void stub.close().then(() => process.exit(0));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

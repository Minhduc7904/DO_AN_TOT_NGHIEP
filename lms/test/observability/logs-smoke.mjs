import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import {
  composeArguments,
  parseArguments,
  runProcess,
  validateOptions,
  verifyHealth,
} from '../../scripts/reset-and-seed.mjs';

const options = validateOptions(parseArguments(process.argv.slice(2)));
assert.equal(options.environment, 'test');
assert.ok(options.project.startsWith('aiops-lms-test-'));
await verifyHealth(options);
const compose = async (args) =>
  (await runProcess('docker', composeArguments(options, args), { capture: true })).stdout;
const configuration = JSON.parse(await compose(['config', '--format', 'json']));
const containers = (await compose(['ps', '--all', '--format', 'json']))
  .trim()
  .split(/\r?\n/u)
  .map((line) => JSON.parse(line));
assert.equal(containers.length, 16);
for (const container of containers) assert.equal(container.Health, 'healthy');
function endpoint(service, target) {
  const port = configuration.services[service].ports.find((item) => item.target === target);
  assert.ok(port && /^\d+$/u.test(String(port.published)));
  assert.ok(
    containers
      .find((item) => item.Service === service)
      .Publishers.some(
        (item) => item.TargetPort === target && item.PublishedPort === Number(port.published),
      ),
  );
  return `http://127.0.0.1:${port.published}`;
}
const loki = endpoint('loki', 3100);
const tempo = endpoint('tempo', 3200);
const gateway = endpoint('gateway', 3000);
const startedAt = BigInt(Date.now() - 5_000) * 1_000_000n;
// Chỉ service.name được index trong Loki; correlation/user/event/run ID phải nằm ngoài label.
const allowedLabels = new Set(['service_name']);
const requiredFields = ['timestamp', 'level', 'message', 'service.name', 'service.version'];

async function poll(label, check) {
  const deadline = Date.now() + 90_000;
  let lastError;
  do {
    try {
      const result = await check();
      console.info(`[logs] ${label}: đạt`);
      return result;
    } catch (error) {
      lastError = error;
      await delay(1_000);
    }
  } while (Date.now() < deadline);
  throw new Error(`${label}: quá 90 giây`, { cause: lastError });
}
async function json(url, init = {}) {
  const started = Date.now();
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  const text = await response.text();
  const body = text ? JSON.parse(text) : undefined;
  assert.ok(
    response.ok,
    `HTTP status ${response.status}; elapsedMs=${Date.now() - started}; code=${body?.error?.code ?? body?.code ?? 'unknown'}`,
  );
  return body;
}
async function lokiQuery(query) {
  const url = new URL(`${loki}/loki/api/v1/query_range`);
  url.searchParams.set('query', query);
  url.searchParams.set('start', String(startedAt));
  url.searchParams.set('end', String(BigInt(Date.now()) * 1_000_000n));
  url.searchParams.set('limit', '1000');
  // Tách index label với structured metadata để kiểm label bounded thật sự.
  const data = await json(url, {
    headers: { 'X-Loki-Response-Encoding-Flags': 'categorize-labels' },
  });
  assert.equal(data.status, 'success');
  return data.data.result.flatMap((stream) =>
    stream.values.map(([, line, metadata]) => ({
      labels: stream.stream,
      line,
      metadata: metadata?.structuredMetadata ?? {},
    })),
  );
}
function spanId(value) {
  return /^[a-f0-9]{16}$/u.test(value) ? value : Buffer.from(value, 'base64').toString('hex');
}
async function traceSpanIds(traceId) {
  const data = await json(`${tempo}/api/traces/${traceId}`);
  return new Set(
    (data.batches ?? data.resourceSpans ?? []).flatMap((batch) =>
      (batch.scopeSpans ?? []).flatMap((scope) =>
        (scope.spans ?? []).map((span) => spanId(span.spanId)),
      ),
    ),
  );
}
async function runTracing() {
  const result = await runProcess(
    process.execPath,
    [
      fileURLToPath(new URL('./tracing-smoke.mjs', import.meta.url)),
      '--environment',
      options.environment,
      '--project',
      options.project,
      '--confirm',
      options.confirm,
      '--compose-env-file',
      options.envFile,
    ],
    { capture: true },
  );
  return JSON.parse(result.stdout.trim().split(/\r?\n/u).at(-1));
}

const tracing = await runTracing();
assert.equal(tracing.result, 'pass');
const correlated = [];
async function expectTraceLogs(service, traceId, checks) {
  return poll(`Loki ${service} lọc trace ${traceId}`, async () => {
    // Đọc lại Tempo mỗi lần poll vì span có thể ingest chậm hơn log.
    const spanIds = await traceSpanIds(traceId);
    const entries = await lokiQuery(`{service_name="${service}"} | trace_id="${traceId}"`);
    assert.ok(entries.length > 0, `Thiếu log ${service}`);
    for (const entry of entries) {
      assert.deepEqual(Object.keys(entry.labels), ['service_name']);
      assert.equal(entry.labels.service_name, service);
      assert.equal(entry.metadata.trace_id, traceId);
      assert.ok(spanIds.has(entry.metadata.span_id), `span_id ${entry.metadata.span_id} lạ`);
    }
    for (const check of checks)
      assert.ok(
        entries.some((entry) =>
          Object.entries(check).every(([key, value]) => entry.metadata[key] === value),
        ),
        `${service} thiếu log ${JSON.stringify(check)}`,
      );
    correlated.push({ service, traceId, entries: entries.length });
  });
}

for (const failure of tracing.failures) {
  const status = failure.scenario === 'timeout' ? '504' : '503';
  await expectTraceLogs('gateway', failure.traceId, [
    {
      event: 'dependency.failure',
      dependency_identity: 'gateway-submission',
      error_type: failure.scenario,
    },
    { event: 'http.server.error', http_status_code: status, severity_text: 'ERROR' },
  ]);
  await expectTraceLogs('submission', failure.traceId, [
    {
      event: 'dependency.failure',
      dependency_identity: 'submission-storage',
      error_type: failure.scenario,
    },
    { event: 'http.server.error', http_status_code: status },
  ]);
}
await expectTraceLogs('notification', tracing.healthyTraceId, [
  { event: 'grade.completed', outcome: 'accepted', severity_text: 'INFO' },
]);
// Workflow healthy đi qua mọi HTTP runtime với cùng trace, nên mỗi runtime phải có access log.
for (const service of tracing.services.filter((name) => name !== 'notification'))
  await expectTraceLogs(service, tracing.healthyTraceId, [
    { event: 'http.server.request', severity_text: 'INFO' },
  ]);

const login = await json(`${gateway}/api/v1/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'student@example.test', password: 'example-password' }),
});
const sensitive = [login.access_token, login.refresh_token, 'example-password', '@example.test'];
const labels = await poll('Loki label bounded và log không lộ dữ liệu nhạy cảm', async () => {
  const url = new URL(`${loki}/loki/api/v1/labels`);
  url.searchParams.set('start', String(startedAt));
  const names = (await json(url)).data;
  assert.ok(names.includes('service_name'));
  for (const name of names) assert.ok(allowedLabels.has(name), `Cấm Loki label ${name}`);
  const all = await lokiQuery('{service_name=~".+"}');
  assert.ok(all.length > 0);
  const access = all.filter((entry) => entry.metadata.event === 'http.server.request');
  assert.ok(access.length > 0, 'Thiếu access log');
  for (const entry of access) {
    assert.notEqual(entry.metadata.http_route, '/health', 'Access log không được ghi health probe');
    assert.match(entry.metadata.http_status_code ?? '', /^[1-4]\d\d$/u);
    assert.ok(Number(entry.metadata.duration_ms) >= 0, 'Access log thiếu duration_ms');
  }
  const serialized = JSON.stringify(all);
  for (const value of sensitive) assert.ok(!serialized.includes(value), 'Log lộ dữ liệu nhạy cảm');
  return names;
});

const stdout = {};
for (const service of ['gateway', 'submission', 'notification']) {
  const env = configuration.services[service].environment;
  const lines = (await compose(['logs', '--no-color', '--no-log-prefix', service]))
    .split(/\r?\n/u)
    .filter(Boolean);
  assert.ok(lines.length > 0, `Thiếu stdout ${service}`);
  let withoutTrace = 0;
  for (const line of lines) {
    let record;
    assert.doesNotThrow(() => (record = JSON.parse(line)), `${service} có log không phải JSON`);
    for (const field of requiredFields) assert.ok(field in record, `${service} thiếu ${field}`);
    assert.equal(new Date(record.timestamp).toISOString(), record.timestamp);
    assert.equal(record['service.name'], service);
    assert.equal(record['service.version'], env.OTEL_SERVICE_VERSION);
    assert.equal(record['service.instance.id'], env.OTEL_SERVICE_INSTANCE_ID);
    assert.equal('trace_id' in record, 'span_id' in record);
    if (!('trace_id' in record)) withoutTrace += 1;
    for (const value of sensitive) assert.ok(!line.includes(value), 'stdout lộ dữ liệu nhạy cảm');
  }
  // Startup log ngoài request context phải thiếu trace ID có chủ đích, không bị gán ID giả.
  assert.ok(withoutTrace > 0, `${service} không có log ngoài trace context`);
  stdout[service] = { lines: lines.length, withoutTrace };
}

console.info(
  JSON.stringify({
    result: 'pass',
    healthyTraceId: tracing.healthyTraceId,
    failures: tracing.failures,
    correlated,
    lokiLabels: labels,
    stdout,
  }),
);

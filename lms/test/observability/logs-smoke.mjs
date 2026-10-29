import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

import { attachStack, poll } from './support/telemetry.mjs';

// Log xuyên service (topology v2): log của 12 runtime vào Loki với `service_name` là index label duy nhất,
// `trace_id`/`span_id` khớp span thật trong Tempo, log lỗi dependency khớp span lỗi, không lộ secret.
const TAG = 'logs';
const WINDOW_SECONDS = Number(process.env.OBSERVABILITY_WINDOW_SECONDS ?? 1800);
const stack = await attachStack(process.argv.slice(2), TAG);
const startNs = BigInt(Math.floor(Date.now() / 1_000) - WINDOW_SECONDS) * 1_000_000_000n;
const RUNTIMES = [
  'gateway',
  'auth',
  'student',
  'course',
  'media',
  'media-worker',
  'notification',
  'notification-worker',
  'scheduler',
  'scheduler-worker',
  'ai',
  'ai-worker',
];
const query = (expression, limit) => stack.loki.query(expression, { startNs, limit });
const results = {};

// 1. Chỉ `service_name` là index label; đủ 12 runtime.
const labels = await fetch(`${stack.urls.loki}/loki/api/v1/labels`).then((response) =>
  response.json(),
);
assert.deepEqual(labels.data, ['service_name'], 'Loki chỉ được index service_name');
const values = await fetch(`${stack.urls.loki}/loki/api/v1/label/service_name/values`).then(
  (response) => response.json(),
);
for (const service of RUNTIMES)
  assert.ok(values.data.includes(service), `Loki thiếu log của ${service}`);

// 2. Mỗi runtime có access log mang đủ trace_id, span_id, danh tính resource khớp compose.
const sampled = [];
for (const service of RUNTIMES) {
  const logs = await query(`{service_name="${service}"} | event="http.server.request"`, 20);
  assert.ok(logs.length > 0, `${service}: không có access log`);
  const env = stack.configuration.services[service].environment;
  for (const log of logs) {
    assert.match(
      log.metadata.trace_id ?? '',
      /^[a-f0-9]{32}$/u,
      `${service}: trace_id sai định dạng`,
    );
    assert.match(
      log.metadata.span_id ?? '',
      /^[a-f0-9]{16}$/u,
      `${service}: span_id sai định dạng`,
    );
    assert.equal(log.metadata.service_version, env.OTEL_SERVICE_VERSION, service);
    assert.equal(log.metadata.service_instance_id, env.OTEL_SERVICE_INSTANCE_ID, service);
  }
  sampled.push({
    service,
    log: logs.find((log) => log.metadata.http_route !== '/ready') ?? logs[0],
  });
}
results.services_with_logs = RUNTIMES.length;

// 3. trace_id/span_id của log phải trỏ tới span thuộc đúng service trong Tempo.
for (const { service, log } of sampled) {
  await poll(
    `${service}: log khớp span trong Tempo`,
    async () => {
      const spans = await stack.tempo.trace(log.metadata.trace_id);
      const span = spans.find((item) => item.spanId === log.metadata.span_id);
      assert.ok(span, `không có span ${log.metadata.span_id}`);
      assert.equal(span.service, service);
    },
    { tag: TAG, timeoutMs: 30_000, intervalMs: 2_000 },
  );
}

// 4. Log lỗi dependency khớp span CLIENT lỗi cùng service (kịch bản auth treo của tracing-smoke).
const failures = await query('{service_name=~".+"} | event="dependency.failure"', 20);
assert.ok(
  failures.length > 0,
  'Chưa có log dependency.failure: chạy tracing-smoke (kịch bản lỗi) trước',
);
for (const log of failures.slice(0, 5)) {
  const spans = await stack.tempo.trace(log.metadata.trace_id);
  const span = spans.find((item) => item.spanId === log.metadata.span_id);
  assert.ok(span, `log lỗi trỏ tới span không tồn tại ${log.metadata.span_id}`);
  assert.equal(span.service, log.labels.service_name);
  assert.equal(span.status?.code, 'STATUS_CODE_ERROR', 'span của log lỗi phải ở trạng thái lỗi');
  assert.ok(log.metadata.dependency_identity, 'log lỗi thiếu dependency_identity');
  assert.ok(log.metadata.error_type, 'log lỗi thiếu error_type');
}
results.dependency_failure_logs_checked = Math.min(failures.length, 5);

// 5. Không lộ secret/credential trong dòng log.
const everything = await query(
  '{service_name=~".+"} |~ "(?i)bearer |authorization|password|secret"',
  50,
);
const leaked = everything.filter((log) =>
  /bearer [a-z0-9._-]{20,}|example-password/iu.test(log.line),
);
assert.equal(leaked.length, 0, `log lộ secret: ${leaked[0]?.line.slice(0, 80)}`);

// 6. Độ trễ thu thập: request có traceparent biết trước → log trong Loki.
const traceId = randomBytes(16).toString('hex');
const sentAt = Date.now();
await fetch(`${stack.urls.gateway}/api/v1/courses`, {
  headers: { traceparent: `00-${traceId}-${randomBytes(8).toString('hex')}-01` },
  signal: AbortSignal.timeout(10_000),
});
await poll(
  'log của request mới trong Loki',
  async () => {
    const logs = await query(`{service_name="gateway"} | trace_id="${traceId}"`, 5);
    assert.ok(logs.length > 0);
  },
  { tag: TAG },
);
results.request_to_log_ms = Date.now() - sentAt;

console.info(`[${TAG}] RESULT ${JSON.stringify(results, null, 2)}`);
console.info(`[${TAG}] Logs smoke đạt.`);

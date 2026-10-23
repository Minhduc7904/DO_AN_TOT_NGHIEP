import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { gradeCompletedV1Fixture } from '../../contracts/dist/index.js';
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
const prometheus = endpoint('prometheus', 9090);
const gateway = endpoint('gateway', 3000);
const rabbitmq = endpoint('rabbitmq', 15672);
const services = [
  'gateway',
  'auth',
  'course',
  'enrollment',
  'submission',
  'grading',
  'notification',
  'submission-storage',
];
function runtimeIdentity(service) {
  const composeName = service === 'submission-storage' ? 'submission-storage-mock' : service;
  const env = configuration.services[composeName].environment;
  return [env.OTEL_SERVICE_VERSION, env.OTEL_SERVICE_INSTANCE_ID];
}
const forbiddenKeys =
  /^(trace_id|span_id|request_id|user_id|principal_id|event_id|run_id|fault_type|fault_id|root_cause_service|url_path|url|path)$/u;
const dynamicIds = [];
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
async function query(expression) {
  const data = await json(`${prometheus}/api/v1/query?query=${encodeURIComponent(expression)}`);
  assert.equal(data.status, 'success');
  return data.data.result;
}
async function scalar(expression) {
  const values = await query(expression);
  return values.reduce((sum, item) => sum + Number(item.value[1]), 0);
}
async function poll(label, check) {
  const deadline = Date.now() + 90_000;
  let lastError;
  do {
    try {
      const result = await check();
      console.info(`[metrics] ${label}: đạt`);
      return result;
    } catch (error) {
      lastError = error;
      await delay(1_000);
    }
  } while (Date.now() < deadline);
  throw new Error(`${label}: quá 90 giây`, { cause: lastError });
}
const selectors = {
  healthy: 'sum(http_server_request_count_total{service_name="gateway",http_status_class="2xx"})',
  serverErrors:
    'sum(http_server_request_error_count_total{service_name="gateway",http_status_class="5xx"})',
  timeout:
    'sum(submission_dependency_error_count_total{dependency_identity="submission-storage",status="timeout"})',
  unavailable:
    'sum(submission_dependency_error_count_total{dependency_identity="submission-storage",status="unavailable"})',
};
async function runTracing() {
  return runProcess(
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
}
// Khởi tạo cả error series của process hiện tại trước baseline; tránh counter cũ còn trong
// Collector/Prometheus sau application restart. SDK 5s + batch 1s + scrape 5s đều phải đi qua.
await runTracing();
const warmupFinishedAt = Date.now() / 1_000;
await delay(12_000);
const before = await poll('Baseline counter có sample mới sau warmup', async () => {
  const values = Object.fromEntries(
    await Promise.all(
      Object.entries(selectors).map(async ([name, selector]) => [name, await scalar(selector)]),
    ),
  );
  for (const value of Object.values(values)) assert.ok(value > 0, 'Warmup phải tạo series thật.');
  const samples = await query(
    'timestamp(submission_dependency_error_count_total{dependency_identity="submission-storage",status=~"timeout|unavailable"})',
  );
  assert.equal(samples.length, 2);
  for (const sample of samples) assert.ok(Number(sample.value[1]) > warmupFinishedAt);
  return values;
});
const tracing = await runTracing();
const traceEvidence = JSON.parse(tracing.stdout.trim().split(/\r?\n/u).at(-1));
assert.equal(traceEvidence.result, 'pass');
const deltas = await poll('Fresh RED và dependency deltas', async () => {
  const result = {};
  for (const [name, selector] of Object.entries(selectors)) {
    result[name] = (await scalar(selector)) - before[name];
    assert.ok(result[name] > 0, `Thiếu delta ${name}`);
  }
  return result;
});

for (const service of services) {
  await poll(`RED/CPU/memory ${service}`, async () => {
    const rows = await query(`http_server_request_count_total{service_name="${service}"}`);
    assert.ok(rows.length > 0);
    for (const row of rows)
      assert.deepEqual(
        [row.metric.service_version, row.metric.service_instance_id],
        runtimeIdentity(service),
      );
    assert.ok((await scalar(`process_cpu_time_seconds_total{service_name="${service}"}`)) > 0);
    assert.ok((await scalar(`process_memory_usage_bytes{service_name="${service}"}`)) > 0);
    const buckets = await query(
      `http_server_request_duration_seconds_bucket{service_name="${service}"}`,
    );
    assert.deepEqual(
      [...new Set(buckets.map((item) => item.metric.le))]
        .map(Number)
        .filter(Number.isFinite)
        .sort((a, b) => a - b),
      [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    );
    const p95 = await query(
      `histogram_quantile(0.95,sum by(le)(rate(http_server_request_duration_seconds_bucket{service_name="${service}"}[1m])))`,
    );
    assert.ok(p95.length > 0 && p95.every((row) => Number.isFinite(Number(row.value[1]))));
  });
}
await poll('Dependency/messaging latency thật', async () => {
  for (const selector of [
    'auth_dependency_duration_seconds_count{dependency_identity="auth-postgres"}',
    'course_dependency_duration_seconds_count{dependency_identity="course-redis"}',
    'enrollment_dependency_duration_seconds_count{dependency_identity="enrollment-postgres"}',
    'submission_dependency_duration_seconds_count{dependency_identity="submission-storage"}',
    'grading_dependency_duration_seconds_count{dependency_identity="grading-postgres"}',
    'grading_messaging_publish_duration_seconds_count{dependency_identity="grading-rabbitmq"}',
    'notification_rabbitmq_consume_duration_seconds_count{dependency_identity="notification-rabbitmq"}',
    'notification_process_duration_seconds_count',
  ])
    assert.ok((await scalar(selector)) > 0, `Thiếu latency series ${selector}`);
});
const login = await json(`${gateway}/api/v1/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'student@example.test', password: 'example-password' }),
});
const token = login.access_token;
async function missingCourse() {
  const dynamicId = `metrics-private-${randomBytes(8).toString('hex')}`;
  dynamicIds.push(dynamicId);
  const response = await fetch(`${gateway}/api/v1/courses/${dynamicId}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  assert.equal(response.status, 404);
  await response.body?.cancel();
}
await missingCourse();
const seriesSelector =
  'http_server_request_count_total{service_name="course",http_status_class="4xx"}';
await poll('Route4xx warmup', async () => assert.ok((await query(seriesSelector)).length > 0));
const routeSeriesBefore = (await query(seriesSelector))
  .map((row) => JSON.stringify(row.metric))
  .sort();
for (let count = 0; count < 10; count += 1) await missingCourse();
await delay(6_000);
assert.deepEqual(
  (await query(seriesSelector)).map((row) => JSON.stringify(row.metric)).sort(),
  routeSeriesBefore,
);

const queueSelector =
  'rabbitmq_detailed_queue_messages{service_name="notification",dependency_identity="notification-rabbitmq"}';
await poll('Broker queue baseline', async () => {
  assert.equal((await query(queueSelector)).length, 1, 'Thiếu queue gauge khác queue rỗng.');
  assert.equal(await scalar(queueSelector), 0);
});
const credentials = configuration.services.rabbitmq.environment;
const rabbitHeaders = {
  'content-type': 'application/json',
  authorization: `Basic ${Buffer.from(`${credentials.RABBITMQ_DEFAULT_USER}:${credentials.RABBITMQ_DEFAULT_PASS}`).toString('base64')}`,
};
const notificationQueue =
  configuration.services.notification.environment.NOTIFICATION_GRADE_COMPLETED_QUEUE;
assert.equal(
  notificationQueue,
  'notification.grade-completed.v1',
  'Metrics baseline chỉ map queue canonical.',
);
let notificationStopped = false;
try {
  notificationStopped = true;
  await compose(['stop', 'notification']);
  for (let count = 0; count < 4; count += 1) {
    const event = {
      ...gradeCompletedV1Fixture,
      event_id: randomUUID(),
      occurred_at: new Date().toISOString(),
    };
    const published = await json(`${rabbitmq}/api/exchanges/%2F/lms.events/publish`, {
      method: 'POST',
      headers: rabbitHeaders,
      body: JSON.stringify({
        properties: {
          headers: {
            traceparent: event.correlation.traceparent,
            tracestate: event.correlation.tracestate,
          },
          delivery_mode: 2,
          content_type: 'application/json',
        },
        routing_key: 'grade.completed',
        payload: JSON.stringify(event),
        payload_encoding: 'string',
      }),
    });
    assert.equal(published.routed, true);
  }
  await poll('Broker queue tăng thật', async () => assert.ok((await scalar(queueSelector)) >= 4));
} finally {
  if (notificationStopped)
    await compose([
      'up',
      '-d',
      '--no-deps',
      '--no-recreate',
      '--wait',
      '--wait-timeout',
      '120',
      'notification',
    ]);
}
await poll('Broker queue drain sau khôi phục consumer', async () => {
  assert.equal((await query(queueSelector)).length, 1);
  assert.equal(await scalar(queueSelector), 0);
});

const requestCountBefore = await scalar(selectors.healthy);
// Ép cache miss và chờ pool PG idle đóng kết nối: outage phải chịu được DNS DB mới.
await compose(['exec', '-T', 'redis', 'redis-cli', 'DEL', 'course:v1:item:course-001']);
await delay(12_000);
let collectorStopped = false;
try {
  collectorStopped = true;
  await compose(['stop', 'otel-collector']);
  await delay(6_000);
  const body = await json(`${gateway}/api/v1/courses/course-001`, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(body.id, 'course-001');
} finally {
  if (collectorStopped)
    await compose([
      'up',
      '-d',
      '--no-deps',
      '--no-recreate',
      '--wait',
      '--wait-timeout',
      '120',
      'otel-collector',
    ]);
}
await poll('Metrics hồi phục sau Collector outage', async () =>
  assert.ok((await scalar(selectors.healthy)) > requestCountBefore),
);
// Collector restart làm series broker stale; chờ scrape lại trước khi kiểm identity toàn bộ series.
await poll('Broker series hồi phục sau Collector outage', async () =>
  assert.equal((await query(queueSelector)).length, 1),
);
const rows = await query(`{service_name=~"${services.join('|')}"}`);
assert.ok(rows.length > 0);
let brokerSeries = 0;
for (const row of rows) {
  // Series broker do Collector scrape không có version/instance của runtime nên phải để trống.
  const broker = row.metric.__name__.startsWith('rabbitmq_');
  if (broker) {
    brokerSeries += 1;
    assert.equal(row.metric.service_name, 'notification');
    assert.equal(row.metric.dependency_identity, 'notification-rabbitmq');
  }
  assert.deepEqual(
    [row.metric.service_version, row.metric.service_instance_id],
    broker ? [undefined, undefined] : runtimeIdentity(row.metric.service_name),
    `Sai resource identity ở ${row.metric.__name__}{service_name="${row.metric.service_name}"}`,
  );
  for (const key of Object.keys(row.metric))
    assert.ok(!forbiddenKeys.test(key), `Cấm label ${key}`);
  const serialized = JSON.stringify(row.metric);
  for (const dynamicId of dynamicIds) assert.ok(!serialized.includes(dynamicId));
  assert.ok(!serialized.includes(token) && !serialized.includes('student@example.test'));
}
assert.ok(brokerSeries > 0, 'Thiếu series broker để kiểm identity.');
console.info(
  JSON.stringify({
    result: 'pass',
    services,
    deltas,
    healthyTraceId: traceEvidence.healthyTraceId,
    backlog: { peakAtLeast: 4, drainedTo: 0 },
    collectorOutage: 'business-request-pass-and-export-recovered',
    dynamicRoutes: 'stable-series',
    seriesCount: rows.length,
    brokerSeriesWithoutRuntimeIdentity: brokerSeries,
  }),
);

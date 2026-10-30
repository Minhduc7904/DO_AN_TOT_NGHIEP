import assert from 'node:assert/strict';

import * as contracts from '../../contracts/dist/index.js';
import { attachStack, fetchJson, poll } from './support/telemetry.mjs';

// Metric xuyên service (topology v2): 11 runtime báo RED + dependency + CPU/RSS, broker báo độ sâu và
// consumer của mọi queue canonical; backlog tăng khi dừng worker, command lỗi vào `.error` và drain.
const TAG = 'metrics';
const stack = await attachStack(process.argv.slice(2), TAG);
const { prometheus } = stack;

const RUNTIMES = [
  'gateway',
  'identity',
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
/** Cạnh phụ thuộc phải có sau traffic regression (service → identity), theo catalogue v2. */
const EXPECTED_DEPENDENCIES = {
  gateway: [
    'gateway-identity',
    'gateway-course',
    'gateway-media',
    'gateway-notification',
    'gateway-scheduler',
    'gateway-ai',
    'gateway-identity-token',
    'gateway-identity-jwks',
  ],
  identity: ['identity-postgres'],
  course: ['course-postgres', 'course-media', 'course-ai'],
  media: ['media-postgres', 'media-minio'],
  'media-worker': ['media-postgres', 'media-minio'],
  notification: ['notification-postgres'],
  'notification-worker': [
    'notification-postgres',
    'notification-smtp',
    'notification-worker-identity',
  ],
  scheduler: ['scheduler-postgres'],
  'scheduler-worker': ['scheduler-postgres', 'scheduler-worker-media'],
  ai: ['ai-postgres', 'ai-llm-provider'],
  'ai-worker': ['ai-postgres', 'ai-llm-provider', 'ai-worker-course', 'ai-worker-media'],
};
const CANONICAL_IDENTITY =
  /^(?:(?:identity|course|media|notification|scheduler|ai)-postgres|media(?:-worker)?-minio|notification-smtp|ai-llm-provider|(?:gateway|course|media|notification|scheduler|ai|media-worker|notification-worker|scheduler-worker|ai-worker)-(?:identity|course|media|notification|scheduler|ai|ai-worker)|(?:gateway|course|media|notification|scheduler|ai|media-worker|notification-worker|scheduler-worker|ai-worker)-identity-(?:token|jwks)|(?:course|media|media-worker|notification|notification-worker|ai|ai-worker)-rabbitmq)$/u;
const FORBIDDEN_LABELS =
  /^(trace_id|span_id|request_id|user_id|principal_id|event_id|run_id|fault_type|fault_id|root_cause_service|url_path|url|path)$/u;

const queues = Object.entries(contracts)
  .filter(([name]) => name.endsWith('_COMMANDS'))
  .flatMap(([, commands]) => Object.values(commands).map((command) => command.queue));
const results = {};

// 1. RED: đủ 11 runtime, nhãn bounded.
await poll(
  'RED của 11 runtime',
  async () => {
    const rows = await prometheus.query('sum by (service_name)(http_server_request_count_total)');
    const seen = new Set(rows.map((row) => row.metric.service_name));
    for (const service of RUNTIMES)
      assert.ok(seen.has(service), `thiếu http_server_request_count_total của ${service}`);
  },
  { tag: TAG },
);
for (const metric of [
  'http_server_request_count_total',
  'http_server_request_duration_seconds_count',
  'process_cpu_time_seconds_total',
  'process_memory_usage_bytes',
]) {
  const rows = await prometheus.query(`sum by (service_name)(${metric})`);
  const seen = new Set(rows.map((row) => row.metric.service_name));
  for (const service of RUNTIMES) assert.ok(seen.has(service), `${metric}: thiếu ${service}`);
  const all = await prometheus.query(metric);
  for (const row of all) {
    for (const label of Object.keys(row.metric)) {
      assert.ok(!FORBIDDEN_LABELS.test(label), `${metric}: nhãn không được phép ${label}`);
    }
  }
}

// 2. Dependency: đúng cạnh, đúng identity canonical, có histogram.
const dependencyRows = await prometheus.query(
  'sum by (service_name, dependency_identity)(lms_dependency_request_count_total)',
);
for (const [service, identities] of Object.entries(EXPECTED_DEPENDENCIES)) {
  for (const identity of identities) {
    assert.ok(
      dependencyRows.some(
        (row) => row.metric.service_name === service && row.metric.dependency_identity === identity,
      ),
      `thiếu lms_dependency_request_count_total{${service}, ${identity}}`,
    );
    const buckets = await prometheus.query(
      `lms_dependency_duration_seconds_count{service_name="${service}",dependency_identity="${identity}"}`,
    );
    assert.ok(buckets.length > 0, `thiếu histogram dependency của ${service} → ${identity}`);
  }
}
for (const row of dependencyRows) {
  assert.match(
    row.metric.dependency_identity,
    CANONICAL_IDENTITY,
    `identity ngoài catalogue v2 (${row.metric.service_name})`,
  );
}
results.dependency_edges = dependencyRows.length;

// 3. Broker: 24 queue (12 canonical + .error) đúng chủ sở hữu, consumer đúng.
const expectedQueues = queues.flatMap((queue) => [queue, `${queue}.error`]);
await poll(
  'queue broker đủ nhãn',
  async () => {
    const rows = await prometheus.query('rabbitmq_detailed_queue_messages_ready');
    assert.equal(
      rows.length,
      expectedQueues.length,
      `cần ${expectedQueues.length} queue, có ${rows.length}`,
    );
    for (const queue of expectedQueues) {
      const owner = queue.split('--')[0];
      const row = rows.find((item) => item.metric.queue === queue);
      assert.ok(row, `thiếu queue ${queue}`);
      assert.equal(row.metric.service_name, owner, queue);
      assert.equal(row.metric.dependency_identity, `${owner}-rabbitmq`, queue);
    }
  },
  { tag: TAG },
);
const consumers = await prometheus.query('rabbitmq_detailed_queue_consumers');
for (const queue of queues) {
  const row = consumers.find((item) => item.metric.queue === queue);
  assert.equal(Number(row?.value[1]), 1, `queue ${queue} phải có đúng 1 consumer`);
}
results.queues = expectedQueues.length;

// 4. Backlog tăng khi dừng worker, command lỗi sang `.error`, drain khi worker trở lại.
const TARGET = contracts.NOTIFICATION_COMMANDS.singleDispatch.queue;
const [workerService] = TARGET.split('--');
const readyOf = async (queue) =>
  prometheus.scalar(`rabbitmq_detailed_queue_messages_ready{queue="${queue}"}`);
const management = (path, init = {}) =>
  fetchJson(`${stack.urls.rabbitmq}${path}`, {
    ...init,
    headers: {
      authorization: stack.rabbitmq.authorization,
      'content-type': 'application/json',
      ...init.headers,
    },
  });
await stack.compose(['stop', workerService]);
try {
  await poll(
    'consumer về 0 khi dừng worker',
    async () => {
      assert.equal(
        await prometheus.scalar(`rabbitmq_detailed_queue_consumers{queue="${TARGET}"}`),
        0,
      );
    },
    { tag: TAG },
  );
  // Command sai envelope: không có tác dụng nghiệp vụ, consumer sẽ chuyển thẳng sang `.error`.
  const published = await management('/api/exchanges/%2F/lms.commands/publish', {
    method: 'POST',
    body: JSON.stringify({
      properties: { delivery_mode: 2, content_type: 'application/json' },
      routing_key: TARGET,
      payload: JSON.stringify({ smoke: 'observability-backlog' }),
      payload_encoding: 'string',
    }),
  });
  assert.equal(published.routed, true, 'broker không route được command thử');
  const backlog = await poll(
    'backlog tăng khi worker dừng',
    async () => {
      assert.ok((await readyOf(TARGET)) >= 1);
    },
    { tag: TAG },
  );
  results.backlog_visible_ms = backlog.elapsedMs;
} finally {
  await stack.compose(['start', workerService]);
}
const drained = await poll(
  'backlog drain và command lỗi vào .error',
  async () => {
    assert.equal(await readyOf(TARGET), 0);
    assert.ok((await readyOf(`${TARGET}.error`)) >= 1, 'command lỗi chưa xuất hiện ở queue .error');
  },
  { tag: TAG },
);
results.drain_visible_ms = drained.elapsedMs;
await management(`/api/queues/%2F/${encodeURIComponent(`${TARGET}.error`)}/contents`, {
  method: 'DELETE',
});

// 5. Độ trễ thu thập: request → counter trong Prometheus.
const selector = 'http_server_request_count_total{service_name="gateway",http_status_class="4xx"}';
const before = await prometheus.scalar(selector);
const sentAt = Date.now();
for (let index = 0; index < 3; index += 1) {
  await fetch(`${stack.urls.gateway}/api/v1/courses`, { signal: AbortSignal.timeout(10_000) });
}
const visible = await poll(
  'counter RED tăng sau request',
  async () => {
    assert.ok((await prometheus.scalar(selector)) >= before + 3);
  },
  { tag: TAG },
);
results.request_to_metric_ms = Date.now() - sentAt;
void visible;

console.info(`[${TAG}] RESULT ${JSON.stringify(results, null, 2)}`);
console.info(`[${TAG}] Metrics smoke đạt.`);

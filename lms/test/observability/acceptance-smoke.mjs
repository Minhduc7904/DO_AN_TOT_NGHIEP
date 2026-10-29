import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

import { attachStack, fetchJson, poll } from './support/telemetry.mjs';

// Nghiệm thu qua chính Grafana đã provision (topology v2): datasource healthy, dashboard provision đúng,
// mọi query panel trả dữ liệu thật, data link metric → TraceQL → Loki → Tempo dùng được, và đo độ trễ
// thu thập của cả ba tín hiệu. Chạy sau tracing-smoke (cần trace/log lỗi) trên stack đã có traffic.
const TAG = 'acceptance';
const stack = await attachStack(process.argv.slice(2), TAG);
const grafana = stack.urls.grafana;
const headers = { authorization: stack.grafana.authorization };
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
const DASHBOARD_UID = 'aiops-lms-service-overview';
// Label/field có thể làm nổ cardinality hoặc lộ danh tính không được xuất hiện trong query dashboard.
const FORBIDDEN_QUERY_TERMS = /\b(user_id|principal|student_id|email|event_id|message_id)\b/u;
const V1_TERMS = /submission|grading|enrollment-service|grade[._-]completed|storage-mock/u;
const results = {};

const api = (path, init = {}) =>
  fetchJson(`${grafana}${path}`, { ...init, headers: { ...headers, ...init.headers } }, 20_000);
const proxy = (uid, path) => api(`/api/datasources/proxy/uid/${uid}${path}`);

// 1. Datasource healthy và cấu hình liên kết trace ↔ log.
for (const uid of ['prometheus', 'tempo', 'loki']) {
  const health = await api(`/api/datasources/uid/${uid}/health`);
  assert.equal(health.status, 'OK', `${uid}: ${health.message}`);
}
const tempoSource = await api('/api/datasources/uid/tempo');
assert.equal(
  tempoSource.jsonData.tracesToLogsV2?.datasourceUid,
  'loki',
  'Tempo thiếu tracesToLogsV2 → Loki',
);
const lokiSource = await api('/api/datasources/uid/loki');
assert.ok(
  lokiSource.jsonData.derivedFields?.some(
    (field) => field.name === 'trace_id' && field.datasourceUid === 'tempo',
  ),
  'Loki thiếu derived field trace_id → Tempo',
);

// 2. Dashboard đã provision, không còn dấu vết v1 và không dùng label nhạy cảm.
const { dashboard, meta } = await api(`/api/dashboards/uid/${DASHBOARD_UID}`);
assert.equal(meta.provisioned, true, 'dashboard phải do provisioning tạo');
assert.equal(dashboard.timezone, 'utc');
const text = JSON.stringify(dashboard);
assert.ok(!V1_TERMS.test(text), `dashboard còn thuật ngữ v1: ${V1_TERMS.exec(text)?.[0]}`);
const panels = dashboard.panels.filter((panel) => panel.type !== 'row');
assert.ok(panels.length >= 10, `dashboard chỉ có ${panels.length} panel`);

// 3. Giá trị biến `service` lấy bằng chính query của dashboard: phải đúng 12 runtime.
const variable = dashboard.templating.list.find((item) => item.name === 'service');
const labelQuery = /label_values\((.+), service_name\)/u.exec(variable.query.query)[1];
const labelValues = await proxy(
  'prometheus',
  `/api/v1/label/service_name/values?match[]=${encodeURIComponent(labelQuery)}`,
);
const services = labelValues.data.filter((name) => RUNTIMES.includes(name)).sort();
assert.deepEqual(services, [...RUNTIMES].sort(), 'biến service phải gồm đủ 12 runtime');
const unknown = labelValues.data.filter((name) => !RUNTIMES.includes(name));
assert.deepEqual(unknown, [], `service ngoài catalogue v2: ${unknown.join(', ')}`);

// 4. Mọi query panel chạy được qua Grafana và có dữ liệu (thay biến như Grafana, service = All, 30 phút).
const endSeconds = Math.floor(Date.now() / 1_000);
const startSeconds = endSeconds - 1_800;
const substitute = (queryText, pipe = false) =>
  queryText
    .replaceAll('$service', pipe ? services.join('|') : `(${services.join('|')})`)
    .replaceAll('$__rate_interval', '1m')
    .replaceAll('$__auto', '30s');
const panelData = {};
for (const panel of panels) {
  for (const target of panel.targets ?? []) {
    const uid = target.datasource?.uid ?? panel.datasource.uid;
    let points = 0;
    if (uid === 'prometheus') {
      assert.ok(!FORBIDDEN_QUERY_TERMS.test(target.expr), `${panel.title}: label nhạy cảm`);
      const data = await proxy(
        uid,
        `/api/v1/query_range?query=${encodeURIComponent(substitute(target.expr))}&start=${startSeconds}&end=${endSeconds}&step=30`,
      );
      points = data.data.result.reduce((sum, series) => sum + series.values.length, 0);
    } else if (uid === 'loki') {
      const data = await proxy(
        uid,
        `/loki/api/v1/query_range?query=${encodeURIComponent(substitute(target.expr))}&start=${startSeconds}000000000&end=${endSeconds}000000000&limit=50`,
      );
      points = data.data.result.reduce((sum, stream) => sum + stream.values.length, 0);
    } else if (uid === 'tempo') {
      const data = await proxy(
        uid,
        `/api/search?q=${encodeURIComponent(substitute(target.query, true))}&start=${startSeconds}&end=${endSeconds}&limit=20`,
      );
      points = (data.traces ?? []).length;
    }
    assert.ok(points > 0, `Panel "${panel.title}" (${target.refId}) không có dữ liệu`);
    panelData[`${panel.title}/${target.refId}`] = points;
  }
}
results.panel_points = panelData;

// 5. Data link: từ series lỗi của panel "Dependency lỗi" mở TraceQL cùng service/identity, rồi log theo trace.
const dependencyPanel = panels.find((panel) => panel.title === 'Dependency lỗi');
const errorSeries = await proxy(
  'prometheus',
  `/api/v1/query?query=${encodeURIComponent(substitute(dependencyPanel.targets[0].expr))}`,
);
const series =
  errorSeries.data.result[0] ??
  (() => {
    throw new Error(
      'Panel "Dependency lỗi" chưa có series: chạy tracing-smoke (kịch bản lỗi) trước',
    );
  })();
const linkQuery = dependencyPanel.fieldConfig.defaults.links[0].internal.query.query
  .replaceAll('${__field.labels.service_name}', series.metric.service_name)
  .replaceAll('${__field.labels.dependency_identity}', series.metric.dependency_identity);
const linked = await proxy(
  'tempo',
  `/api/search?q=${encodeURIComponent(linkQuery)}&start=${startSeconds}&end=${endSeconds}&limit=5`,
);
assert.ok(linked.traces?.length > 0, `TraceQL của data link không trả trace: ${linkQuery}`);
// Log đến Loki chậm hơn trace vài giây: thử lần lượt các trace lỗi, tối đa 30 giây.
let linkedTrace;
for (let attempt = 0; attempt < 15 && !linkedTrace; attempt += 1) {
  for (const candidate of linked.traces) {
    const logsForTrace = await proxy(
      'loki',
      `/loki/api/v1/query_range?query=${encodeURIComponent(`{service_name="${series.metric.service_name}"} | trace_id="${candidate.traceID}"`)}&start=${startSeconds}000000000&end=${Math.floor(Date.now() / 1_000) + 60}000000000&limit=10`,
    );
    if (logsForTrace.data.result.some((stream) => stream.values.length > 0)) {
      linkedTrace = candidate.traceID;
      break;
    }
  }
  if (!linkedTrace) await new Promise((resolve) => setTimeout(resolve, 2_000));
}
assert.ok(linkedTrace, 'tracesToLogsV2: không có log theo trace_id của trace lỗi');
results.data_link = {
  service: series.metric.service_name,
  dependency_identity: series.metric.dependency_identity,
  trace_id: linkedTrace,
};

// 6. Độ trễ thu thập của ba tín hiệu từ lúc gửi request.
const traceId = randomBytes(16).toString('hex');
const selector = 'http_server_request_count_total{service_name="gateway",http_status_class="4xx"}';
const before = await stack.prometheus.scalar(selector);
const sentAt = Date.now();
await fetch(`${stack.urls.gateway}/api/v1/courses`, {
  headers: { traceparent: `00-${traceId}-${randomBytes(8).toString('hex')}-01` },
  signal: AbortSignal.timeout(10_000),
});
const latency = {};
const sinceNs = BigInt(sentAt - 5_000) * 1_000_000n;
await Promise.all([
  poll(
    'trace mới trong Tempo',
    async () => assert.ok((await stack.tempo.trace(traceId)).length > 0),
    {
      tag: TAG,
      intervalMs: 500,
    },
  ).then(() => (latency.trace_ms = Date.now() - sentAt)),
  poll(
    'log mới trong Loki',
    async () => {
      const logs = await stack.loki.query(`{service_name="gateway"} | trace_id="${traceId}"`, {
        startNs: sinceNs,
        limit: 5,
      });
      assert.ok(logs.length > 0);
    },
    { tag: TAG, intervalMs: 500 },
  ).then(() => (latency.log_ms = Date.now() - sentAt)),
  poll(
    'counter mới trong Prometheus',
    async () => assert.ok((await stack.prometheus.scalar(selector)) > before),
    {
      tag: TAG,
      intervalMs: 500,
    },
  ).then(() => (latency.metric_ms = Date.now() - sentAt)),
]);
for (const [signal, milliseconds] of Object.entries(latency)) {
  assert.ok(milliseconds <= 60_000, `${signal} quá chậm: ${milliseconds} ms`);
}
results.ingestion_latency = latency;

console.info(`[${TAG}] RESULT ${JSON.stringify(results, null, 2)}`);
console.info(`[${TAG}] Acceptance smoke đạt.`);

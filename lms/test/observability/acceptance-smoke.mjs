import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import {
  composeArguments,
  parseArguments,
  runProcess,
  validateOptions,
  verifyHealth,
} from '../../scripts/reset-and-seed.mjs';

// Nghiệm thu W10 qua chính Grafana đã provision: metric panel → TraceQL (data link) → Loki
// (tracesToLogsV2) → Tempo (derived field), trên dữ liệu do tracing smoke vừa sinh ra.
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
for (const container of containers) assert.equal(container.Health, 'healthy');
const grafanaPort = configuration.services.grafana.ports.find((item) => item.target === 3000);
assert.ok(grafanaPort && /^\d+$/u.test(String(grafanaPort.published)));
const grafana = `http://127.0.0.1:${grafanaPort.published}`;
const grafanaEnv = configuration.services.grafana.environment;
const authorization = `Basic ${Buffer.from(
  `${grafanaEnv.GF_SECURITY_ADMIN_USER}:${grafanaEnv.GF_SECURITY_ADMIN_PASSWORD}`,
).toString('base64')}`;

const DASHBOARD_UID = 'aiops-lms-service-overview';
const BUSINESS_SERVICES = [
  'gateway',
  'auth',
  'course',
  'enrollment',
  'submission',
  'grading',
  'notification',
];
// Label/field có thể làm nổ cardinality hoặc lộ danh tính không được xuất hiện trong query dashboard.
const FORBIDDEN_QUERY_TERMS = /\b(user_id|principal|student_id|email|event_id|submission_id)\b/u;
const serviceRegex = `(${BUSINESS_SERVICES.join('|')})`;

async function poll(label, check, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  do {
    try {
      const result = await check();
      console.info(`[acceptance] ${label}: đạt`);
      return result;
    } catch (error) {
      lastError = error;
      await delay(2_000);
    }
  } while (Date.now() < deadline);
  throw new Error(`${label}: quá ${timeoutMs / 1_000} giây`, { cause: lastError });
}
async function api(path, body) {
  const response = await fetch(`${grafana}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { authorization, 'content-type': 'application/json' },
    body: body && JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  assert.ok(response.ok, `Grafana ${path} HTTP ${response.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}
function rows(frame) {
  const names = frame.schema.fields.map((field) => field.name);
  const values = frame.data?.values ?? [];
  return (values[0] ?? []).map((_, index) =>
    Object.fromEntries(names.map((name, column) => [name, values[column][index]])),
  );
}
let window = { from: Date.now() - 60_000, to: Date.now() };
async function query(datasource, target) {
  const data = await api('/api/ds/query', {
    from: String(window.from),
    to: String(Date.now()),
    queries: [{ maxDataPoints: 200, ...target, refId: 'A', datasource: { uid: datasource } }],
  });
  const result = data.results.A;
  assert.ok(!result.error, `${datasource}: ${result.error}`);
  return result.frames ?? [];
}
// Thay biến như Grafana làm trên UI với khoảng mặc định 30 phút và `service` = All:
// - `$service`: Prometheus/Loki định dạng regex `(a|b)`, Tempo dùng `VariableFormatID.Pipe` (`a|b`).
// - `$__rate_interval` = max($__interval + scrape, 4 × scrape) = 20s với `timeInterval: 5s`.
// - `$__auto` của Loki ≈ 30 phút / ~1000 điểm = 2s.
let serviceValues = BUSINESS_SERVICES;
function interpolate(text, variables, datasource = 'prometheus') {
  const service = datasource === 'tempo' ? serviceValues.join('|') : `(${serviceValues.join('|')})`;
  return text
    .replaceAll('$service', service)
    .replaceAll('$__rate_interval', '20s')
    .replaceAll('$__auto', '2s')
    .replace(/\$\{([^}]+)\}/gu, (match, name) => {
      assert.ok(name in variables, `Thiếu biến ${name} trong ${text}`);
      return variables[name];
    });
}
// Mỗi series Prometheus là một frame; label nằm ở field giá trị.
async function promSeries(expr) {
  const frames = await query('prometheus', { expr, range: true, intervalMs: 5_000 });
  return frames.map((frame) => {
    const valueField = frame.schema.fields.find((field) => field.type === 'number');
    const values = frame.data.values[frame.schema.fields.indexOf(valueField)];
    return {
      labels: valueField.labels ?? {},
      max: Math.max(...values.filter((value) => Number.isFinite(value))),
    };
  });
}
async function traceSearch(traceql) {
  const frames = await query('tempo', { queryType: 'traceql', query: traceql, limit: 50 });
  return frames.flatMap(rows).map((row) => row.traceID);
}
async function traceById(traceId) {
  const frames = await query('tempo', { queryType: 'traceId', query: traceId });
  const spans = frames.flatMap(rows);
  assert.ok(spans.length > 0, `Tempo không có trace ${traceId}`);
  return spans.map((span) => ({
    ...span,
    resource: Object.fromEntries((span.serviceTags ?? []).map((tag) => [tag.key, tag.value])),
    attributes: Object.fromEntries((span.tags ?? []).map((tag) => [tag.key, tag.value])),
  }));
}
async function lokiEntries(expr) {
  const frames = await query('loki', { queryType: 'range', expr });
  return frames.flatMap(rows).map((row) => ({
    labels: row.labels,
    line: row.Line,
    timestampNs: BigInt(row.tsNs),
  }));
}

// 1. Provisioning: datasource, liên kết trace ↔ log và dashboard đúng file trong repo.
const datasources = Object.fromEntries(
  await Promise.all(
    ['prometheus', 'tempo', 'loki'].map(async (uid) => {
      const health = await api(`/api/datasources/uid/${uid}/health`);
      assert.equal(health.status, 'OK', `${uid}: ${health.message}`);
      return [uid, await api(`/api/datasources/uid/${uid}`)];
    }),
  ),
);
const tracesToLogs = datasources.tempo.jsonData.tracesToLogsV2;
assert.equal(tracesToLogs?.datasourceUid, 'loki');
assert.equal(tracesToLogs.customQuery, true);
assert.match(tracesToLogs.query, /trace_id="\$\{__trace\.traceId\}"/u);
const derived = datasources.loki.jsonData.derivedFields ?? [];
assert.ok(
  derived.some(
    (field) =>
      field.datasourceUid === 'tempo' &&
      field.matcherType === 'label' &&
      field.matcherRegex === 'trace_id' &&
      field.url === '${__value.raw}',
  ),
  'Loki thiếu derived field trace_id → Tempo',
);
const { dashboard, meta } = await api(`/api/dashboards/uid/${DASHBOARD_UID}`);
assert.equal(meta.provisioned, true);
assert.equal(dashboard.timezone, 'utc');
const panels = dashboard.panels.filter((panel) => panel.type !== 'row');
for (const panel of panels)
  for (const target of panel.targets ?? []) {
    const text = target.expr ?? target.query ?? '';
    assert.ok(!FORBIDDEN_QUERY_TERMS.test(text), `${panel.title} dùng field cấm: ${text}`);
    if (target.expr?.includes('http_server_request'))
      assert.match(target.expr, /http_route_template!="\/health"/u, `${panel.title} gồm /health`);
  }
const serviceVariable = dashboard.templating.list.find((item) => item.name === 'service');
assert.match(serviceVariable.definition, /service_name!="submission-storage"/u);
assert.equal(serviceVariable.includeAll, true);

// 2. Sinh dữ liệu thật: workflow healthy (gồm grade.completed) và lỗi storage timeout/unavailable.
window = { from: Date.now() - 10_000, to: Date.now() };
const tracingResult = await runProcess(
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
const tracing = JSON.parse(tracingResult.stdout.trim().split(/\r?\n/u).at(-1));
assert.equal(tracing.result, 'pass');
const identity = Object.fromEntries(
  [...BUSINESS_SERVICES, 'submission-storage'].map((service) => {
    const composeName = service === 'submission-storage' ? 'submission-storage-mock' : service;
    const env = configuration.services[composeName].environment;
    const container = containers.find((item) => item.Service === composeName).Name;
    assert.notEqual(env.OTEL_SERVICE_INSTANCE_ID, container);
    return [
      service,
      { version: env.OTEL_SERVICE_VERSION, instance: env.OTEL_SERVICE_INSTANCE_ID, container },
    ];
  }),
);
function assertIdentity(service, version, instance, source) {
  assert.ok(identity[service], `${source}: service ${service} ngoài catalogue`);
  assert.equal(version, identity[service].version, `${source}: version ${service}`);
  assert.equal(instance, identity[service].instance, `${source}: instance ${service}`);
}

// Giá trị của biến `service` lấy bằng đúng label query của dashboard qua Grafana, không hard-code.
const [, variableSelector] = serviceVariable.definition.match(
  /^label_values\((.+), service_name\)$/u,
);
serviceValues = await poll('Biến service chỉ gồm business service', async () => {
  const url = new URL(
    '/api/datasources/uid/prometheus/resources/api/v1/label/service_name/values',
    grafana,
  );
  url.searchParams.set('match[]', variableSelector);
  url.searchParams.set('start', String(Math.floor(window.from / 1_000) - 1_800));
  const values = (await api(`${url.pathname}${url.search}`)).data.sort();
  assert.deepEqual(values, [...BUSINESS_SERVICES].sort());
  return values;
});

// 3. Mọi query của dashboard chạy được và có dữ liệu từ workflow vừa chạy, không phải dữ liệu tĩnh.
const panelResults = await poll(
  'Mọi panel dashboard có dữ liệu thật',
  async () => {
    const results = [];
    for (const panel of panels)
      for (const target of panel.targets) {
        const datasource = target.datasource.uid;
        const text = interpolate(target.expr ?? target.query, {}, datasource);
        const frames =
          datasource === 'tempo'
            ? await query('tempo', { queryType: 'traceql', query: text, limit: 20 })
            : await query(datasource, { ...target, expr: text, range: true, intervalMs: 5_000 });
        const count = frames.reduce(
          (sum, frame) => sum + (frame.data?.values?.[0]?.length ?? 0),
          0,
        );
        assert.ok(count > 0, `Panel "${panel.title}" không có dữ liệu`);
        results.push({ panel: panel.title, datasource, points: count });
      }
    return results;
  },
  180_000,
);

// 4. HTTP 5xx/timeout: metric panel → TraceQL qua data link → log theo trace_id → trace qua derived field.
const errorPanel = panels.find((panel) => panel.title === 'Error ratio');
const errorLink = errorPanel.fieldConfig.defaults.links[0].internal.query.query;
const dependencyPanel = panels.find((panel) => panel.title === 'Dependency lỗi');
const dependencyLink = dependencyPanel.fieldConfig.defaults.links[0].internal.query.query;
const evidence = [];
for (const failure of tracing.failures) {
  const status = failure.scenario === 'timeout' ? 504 : 503;
  const chain = await poll(`Chuỗi metric → trace → log cho ${failure.scenario}`, async () => {
    const ratio = await promSeries(interpolate(errorPanel.targets[0].expr, {}));
    const gatewayRatio = ratio.find((series) => series.labels.service_name === 'gateway');
    assert.ok(gatewayRatio?.max > 0, 'Panel Error ratio chưa thấy lỗi Gateway');
    const dependencies = await promSeries(interpolate(dependencyPanel.targets[0].expr, {}));
    assert.ok(
      dependencies.some(
        (series) =>
          series.labels.service_name === 'submission' &&
          series.labels.dependency_identity === 'submission-storage' &&
          series.labels.status === failure.scenario &&
          series.max > 0,
      ),
      `Panel Dependency lỗi thiếu submission-storage ${failure.scenario}`,
    );
    const traceql = interpolate(errorLink, { '__field.labels.service_name': 'gateway' }, 'tempo');
    const traceIds = await traceSearch(traceql);
    assert.ok(traceIds.includes(failure.traceId), `TraceQL ${traceql} không trả trace lỗi`);
    const dependencyTraceql = interpolate(
      dependencyLink,
      {
        '__field.labels.service_name': 'submission',
        '__field.labels.dependency_identity': 'submission-storage',
      },
      'tempo',
    );
    assert.ok(
      (await traceSearch(dependencyTraceql)).includes(failure.traceId),
      `TraceQL ${dependencyTraceql} không trả trace lỗi dependency`,
    );

    const spans = await traceById(failure.traceId);
    const server = spans.find(
      (span) =>
        span.serviceName === 'submission' &&
        span.kind === 'server' &&
        Number(span.attributes['http.response.status_code']) === status,
    );
    const client = spans.find(
      (span) =>
        span.serviceName === 'submission' &&
        span.kind === 'client' &&
        span.attributes['error.type'],
    );
    assert.ok(server && client, 'Trace thiếu server/client span lỗi của Submission');
    assert.equal(client.attributes['error.type'], failure.scenario);

    const logsQuery = interpolate(tracesToLogs.query, {
      __tags: 'service_name="submission"',
      '__trace.traceId': failure.traceId,
    });
    const entries = await lokiEntries(logsQuery);
    const httpError = entries.find((entry) => entry.labels.event === 'http.server.error');
    const dependencyError = entries.find((entry) => entry.labels.event === 'dependency.failure');
    assert.ok(httpError && dependencyError, `Loki thiếu log lỗi cho ${logsQuery}`);
    assert.equal(Number(httpError.labels.http_status_code), status);
    assert.equal(httpError.labels.span_id, server.spanID);
    assert.equal(dependencyError.labels.dependency_identity, 'submission-storage');
    assert.equal(dependencyError.labels.error_type, client.attributes['error.type']);
    assert.equal(dependencyError.labels.span_id, client.spanID);
    for (const entry of entries) {
      assertIdentity(
        entry.labels.service_name,
        entry.labels.service_version,
        entry.labels.service_instance_id,
        'Loki',
      );
      // Thời điểm log (UTC epoch) phải nằm trong span tương ứng, cho phép lệch 1 giây.
      const span = spans.find((item) => item.spanID === entry.labels.span_id);
      const logMs = Number(entry.timestampNs / 1_000_000n);
      assert.ok(span, `Derived field trace_id không mở được span ${entry.labels.span_id}`);
      assert.ok(logMs >= span.startTime - 1_000 && logMs <= span.startTime + span.duration + 1_000);
    }
    return {
      scenario: failure.scenario,
      traceId: failure.traceId,
      metric: { gatewayErrorRatioMax: gatewayRatio.max },
      traceql,
      dependencyTraceql,
      logql: logsQuery,
      httpStatus: status,
      errorType: client.attributes['error.type'],
      logTimestampUtc: new Date(Number(httpError.timestampNs / 1_000_000n)).toISOString(),
    };
  });
  evidence.push(chain);
}

// 5. grade.completed: producer Grading → consumer Notification cùng trace, log Notification nối đúng span.
const messaging = await poll('grade.completed xuyên RabbitMQ', async () => {
  const processed = await promSeries(
    'sum by (status) (increase(notification_process_count_total{service_name="notification"}[5m]))',
  );
  assert.ok(processed.some((series) => series.labels.status === 'accepted' && series.max > 0));
  const spans = await traceById(tracing.healthyTraceId);
  for (const span of spans)
    assertIdentity(
      span.serviceName,
      span.resource['service.version'],
      span.resource['service.instance.id'],
      'Tempo',
    );
  const producer = spans.find((span) => span.serviceName === 'grading' && span.kind === 'producer');
  const consumer = spans.find(
    (span) => span.serviceName === 'notification' && span.kind === 'consumer',
  );
  assert.ok(producer && consumer, 'Trace thiếu producer/consumer RabbitMQ');
  assert.equal(consumer.parentSpanID, producer.spanID, 'Consumer không nối với producer');
  const consumerSpans = new Set(
    spans
      .filter((span) => span.serviceName === 'notification' && span.startTime >= consumer.startTime)
      .map((span) => span.spanID),
  );
  const logsQuery = interpolate(tracesToLogs.query, {
    __tags: 'service_name="notification"',
    '__trace.traceId': tracing.healthyTraceId,
  });
  const entries = await lokiEntries(logsQuery);
  const completed = entries.find(
    (entry) => entry.labels.event === 'grade.completed' && entry.labels.outcome === 'accepted',
  );
  assert.ok(completed, `Loki thiếu grade.completed cho ${logsQuery}`);
  assert.ok(consumerSpans.has(completed.labels.span_id), 'Log Notification ngoài span consumer');
  const gatewayAccess = await lokiEntries(
    interpolate(tracesToLogs.query, {
      __tags: 'service_name="gateway"',
      '__trace.traceId': tracing.healthyTraceId,
    }),
  );
  assert.ok(
    gatewayAccess.some((entry) => entry.labels.event === 'http.server.request'),
    'Trace healthy thiếu access log Gateway',
  );
  return {
    traceId: tracing.healthyTraceId,
    producer: `${producer.serviceName}/${producer.operationName}`,
    consumer: `${consumer.serviceName}/${consumer.operationName}`,
    logql: logsQuery,
    logTimestampUtc: new Date(Number(completed.timestampNs / 1_000_000n)).toISOString(),
  };
});

// 6. Series Prometheus của business service mang identity catalogue, không phải container name.
const promIdentity = await promSeries(
  `count by (service_name, service_version, service_instance_id) (http_server_request_count_total{service_name=~"${serviceRegex}"})`,
);
for (const service of BUSINESS_SERVICES) {
  const series = promIdentity.filter((item) => item.labels.service_name === service);
  assert.ok(series.length > 0, `Prometheus thiếu ${service}`);
  for (const item of series)
    assertIdentity(
      service,
      item.labels.service_version,
      item.labels.service_instance_id,
      'Prometheus',
    );
}

console.info(
  JSON.stringify({
    result: 'pass',
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    generatedAtUtc: new Date().toISOString(),
    dashboard: { uid: DASHBOARD_UID, version: dashboard.version, timezone: dashboard.timezone },
    panels: panelResults,
    failures: evidence,
    messaging,
  }),
);

import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const endpoints = {
  collector: `http://127.0.0.1:${process.env.OTEL_HTTP_PORT ?? 4318}`,
  prometheus: `http://127.0.0.1:${process.env.PROMETHEUS_PORT ?? 9090}`,
  tempo: `http://127.0.0.1:${process.env.TEMPO_PORT ?? 3200}`,
  loki: `http://127.0.0.1:${process.env.LOKI_PORT ?? 3100}`,
  grafana: `http://127.0.0.1:${process.env.GRAFANA_PORT ?? 3008}`,
};
const service = 'observability-smoke';
const marker = randomBytes(12).toString('hex');
const traceId = randomBytes(16).toString('hex');
const spanId = randomBytes(8).toString('hex');
const startedAt = BigInt(Date.now()) * 1_000_000n;
const metricValue = Number(startedAt / 1_000_000_000n);
const resource = {
  attributes: [
    { key: 'service.name', value: { stringValue: service } },
    { key: 'service.version', value: { stringValue: '0.1.0' } },
    { key: 'service.instance.id', value: { stringValue: 'smoke-1' } },
  ],
};

async function request(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status} ${await response.text()}`);
  return response;
}

async function send(signal, body) {
  const response = await request(`${endpoints.collector}/v1/${signal}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  assert.ok(!result.partialSuccess || Object.keys(result.partialSuccess).length === 0);
}

async function poll(name, check) {
  const deadline = Date.now() + 90_000;
  let lastError;
  do {
    try {
      await check();
      console.info(`[observability] ${name}: đạt`);
      return;
    } catch (error) {
      lastError = error;
      await delay(1_000);
    }
  } while (Date.now() < deadline);
  throw new Error(`${name}: chưa có dữ liệu sau 90 giây`, { cause: lastError });
}

await send('traces', {
  resourceSpans: [
    {
      resource,
      scopeSpans: [
        {
          scope: { name: 'observability-smoke' },
          spans: [
            {
              traceId,
              spanId,
              name: 'observability stack smoke',
              kind: 1,
              startTimeUnixNano: String(startedAt),
              endTimeUnixNano: String(startedAt + 1_000_000n),
              attributes: [{ key: 'smoke.marker', value: { stringValue: marker } }],
            },
          ],
        },
      ],
    },
  ],
});
await send('metrics', {
  resourceMetrics: [
    {
      resource,
      scopeMetrics: [
        {
          scope: { name: 'observability-smoke' },
          metrics: [
            {
              name: 'observability.smoke.timestamp',
              unit: 's',
              gauge: {
                dataPoints: [{ timeUnixNano: String(startedAt), asDouble: metricValue }],
              },
            },
          ],
        },
      ],
    },
  ],
});
await send('logs', {
  resourceLogs: [
    {
      resource,
      scopeLogs: [
        {
          scope: { name: 'observability-smoke' },
          logRecords: [
            {
              timeUnixNano: String(startedAt),
              severityNumber: 9,
              severityText: 'INFO',
              body: { stringValue: `observability smoke ${marker}` },
              traceId,
              spanId,
            },
          ],
        },
      ],
    },
  ],
});

await poll('Tempo query theo trace ID và marker', async () => {
  const result = await (await request(`${endpoints.tempo}/api/traces/${traceId}`)).json();
  const text = JSON.stringify(result);
  assert.ok(text.includes(marker) && text.includes(service));
});
await poll('Prometheus query sample mới, không dùng marker làm label', async () => {
  const query = `{__name__=~"observability_smoke_timestamp.*",service_name="${service}"}`;
  const url = `${endpoints.prometheus}/api/v1/query?query=${encodeURIComponent(query)}`;
  const result = await (await request(url)).json();
  assert.equal(result.status, 'success');
  assert.ok(result.data.result.some((series) => Number(series.value[1]) === metricValue));
});
await poll('Loki query theo service và marker', async () => {
  const query = `{service_name="${service}"} |= "${marker}"`;
  const url = new URL(`${endpoints.loki}/loki/api/v1/query_range`);
  url.searchParams.set('query', query);
  url.searchParams.set('start', String(startedAt - 60_000_000_000n));
  url.searchParams.set('end', String(BigInt(Date.now()) * 1_000_000n));
  const result = await (await request(url)).json();
  assert.equal(result.status, 'success');
  assert.ok(
    result.data.result.some((stream) => stream.values.some((line) => line[1].includes(marker))),
  );
});
await poll('Grafana provision ba datasource nội bộ', async () => {
  const credential = Buffer.from(
    `${process.env.GRAFANA_ADMIN_USER ?? 'admin'}:${process.env.GRAFANA_ADMIN_PASSWORD ?? 'grafana-local-only'}`,
  ).toString('base64');
  const result = await (
    await request(`${endpoints.grafana}/api/datasources`, {
      headers: { authorization: `Basic ${credential}` },
    })
  ).json();
  for (const [uid, url] of [
    ['prometheus', 'http://prometheus:9090'],
    ['tempo', 'http://tempo:3200'],
    ['loki', 'http://loki:3100'],
  ]) {
    assert.ok(result.some((datasource) => datasource.uid === uid && datasource.url === url));
  }
});
console.info(JSON.stringify({ service, traceId, marker, metricValue, result: 'pass' }));

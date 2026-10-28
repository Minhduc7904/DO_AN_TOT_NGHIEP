import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import { startTelemetry } from '@aiops-lms/observability';
import {
  InMemoryMetricExporter,
  InMemorySpanExporter,
  PeriodicExportingMetricReader,
  SimpleSpanProcessor,
  SpanKind,
  SpanStatusCode,
} from '@aiops-lms/observability/testing';

const spanExporter = new InMemorySpanExporter();
const metricExporter = new InMemoryMetricExporter();
const metricReader = new PeriodicExportingMetricReader({ exporter: metricExporter });
const telemetry = startTelemetry(
  {
    enabled: true,
    otlpTracesEndpoint: 'http://127.0.0.1:4318/v1/traces',
    serviceInstanceId: 'gateway-dependency-test-1',
    serviceName: 'gateway',
    serviceVersion: '0.1.0-test',
  },
  { metricReader, spanProcessor: new SimpleSpanProcessor(spanExporter) },
);
const { FetchUpstreamClient } =
  await import('../../dist/adapters/upstream/fetch-upstream.client.js');

let serverCalls = 0;
const server = createServer((req, res) => {
  serverCalls++;
  const route = req.url.split('/')[3];
  const body = JSON.stringify({ code: route });
  if (route === 'auth') return res.writeHead(200, { 'content-type': 'application/json' }).end(body);
  if (route === 'courses') {
    return res.writeHead(404, { 'content-type': 'application/json' }).end(body);
  }
  if (route === 'students') return res.writeHead(504).end();
  if (route === 'notifications') return res.writeHead(500).end();
  // ai: không bao giờ trả lời → timeout phía gateway
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const client = new FetchUpstreamClient(
  {
    auth: base,
    course: base,
    student: base,
    notification: base,
    ai: base,
    // Không ai nghe cổng này: lỗi kết nối.
    media: 'http://127.0.0.1:9',
  },
  300,
  { getToken: async () => 'telemetry-test-service-token' },
);

async function drain(response) {
  for await (const chunk of response.body ?? []) void chunk;
}

function request(method, target) {
  return {
    method,
    target,
    headers: {},
    body: null,
    signal: new AbortController().signal,
  };
}

try {
  const ok = await client.forward('auth', request('POST', '/api/v1/auth/student/login'));
  assert.equal(ok.status, 200);
  await drain(ok);
  const notFound = await client.forward('course', request('GET', '/api/v1/courses/course-001'));
  assert.equal(notFound.status, 404);
  await drain(notFound);
  // 5xx của upstream vẫn được trả nguyên vẹn cho client nhưng bị ghi nhận là lỗi dependency.
  const gatewayTimeout = await client.forward('student', request('GET', '/api/v1/students'));
  assert.equal(gatewayTimeout.status, 504);
  await drain(gatewayTimeout);
  const serverError = await client.forward(
    'notification',
    request('GET', '/api/v1/notifications/notification-001'),
  );
  assert.equal(serverError.status, 500);
  await drain(serverError);
  await assert.rejects(
    client.forward('ai', request('GET', '/api/v1/ai/grade-001')),
    (error) => error.code === 'DEPENDENCY_TIMEOUT' && error.status === 504,
  );
  await assert.rejects(
    client.forward('media', request('GET', '/api/v1/media/library')),
    (error) => error.code === 'DEPENDENCY_UNAVAILABLE' && error.status === 503,
  );
  assert.equal(serverCalls, 5, 'Mỗi outbound request chỉ gọi upstream một lần (không retry)');

  await telemetry.forceFlush();
  const spans = spanExporter.getFinishedSpans();
  assert.equal(spans.length, 6);
  for (const span of spans) assert.equal(span.kind, SpanKind.CLIENT);
  assert.deepEqual(
    spans.map((span) => span.attributes.dependency_identity),
    [
      'gateway-auth',
      'gateway-course',
      'gateway-student',
      'gateway-notification',
      'gateway-ai',
      'gateway-media',
    ],
  );
  assert.deepEqual(
    spans.map((span) => span.name),
    [
      'gateway-auth POST',
      'gateway-course GET',
      'gateway-student GET',
      'gateway-notification GET',
      'gateway-ai GET',
      'gateway-media GET',
    ],
    'Gateway client span dùng dependency + method, không ghi path có ID động',
  );
  assert.doesNotMatch(
    JSON.stringify(spans.map((span) => [span.name, span.attributes, span.events])),
    /course-001|notification-001|grade-001/u,
  );
  assert.notEqual(spans[0].status.code, SpanStatusCode.ERROR);
  assert.notEqual(spans[1].status.code, SpanStatusCode.ERROR);
  assert.equal(spans[2].attributes['error.type'], 'timeout');
  assert.equal(spans[3].attributes['error.type'], 'unavailable');
  assert.equal(spans[4].attributes['error.type'], 'timeout');
  assert.equal(spans[5].attributes['error.type'], 'unavailable');

  const resourceMetrics = metricExporter.getMetrics();
  const metrics = JSON.stringify(resourceMetrics);
  assert.match(metrics, /lms.dependency.request.count/);
  assert.match(metrics, /lms.dependency.error.count/);
  assert.match(metrics, /lms.dependency.duration/);
  const metricSets = resourceMetrics.flatMap((resource) =>
    resource.scopeMetrics.flatMap((scope) => scope.metrics),
  );
  const points = (name) => metricSets.find((metric) => metric.descriptor.name === name).dataPoints;
  assert.equal(
    points('lms.dependency.request.count').reduce((sum, p) => sum + p.value, 0),
    6,
  );
  assert.equal(
    points('lms.dependency.error.count').reduce((sum, p) => sum + p.value, 0),
    4,
  );
  assert.doesNotMatch(metrics, /course-001|submission-001|grade-001|student-001|url\.path/);
  console.log('Gateway dependency spans, metrics và cardinality assertions đạt.');
} finally {
  server.closeAllConnections();
  server.close();
  await telemetry.shutdown();
}

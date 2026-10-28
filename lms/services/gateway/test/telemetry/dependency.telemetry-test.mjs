import assert from 'node:assert/strict';

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
const { DependencyTimeoutError, DependencyUnavailableError, GatewayProxy } =
  await import('../../dist/application/gateway-proxy.js');

let fetchCalls = 0;
const proxy = new GatewayProxy(async (input) => {
  fetchCalls++;
  const hostname = new URL(input.toString()).hostname;
  if (hostname === 'auth.test') {
    return new Response(JSON.stringify({ access_token: 'redacted' }), {
      headers: { 'content-type': 'application/json' },
      status: 200,
    });
  }
  if (hostname === 'course.test') {
    return new Response(JSON.stringify({ code: 'NOT_FOUND' }), {
      headers: { 'content-type': 'application/json' },
      status: 404,
    });
  }
  if (hostname === 'enrollment.test') return new Response(null, { status: 504 });
  if (hostname === 'submission.test') return new Response(null, { status: 500 });
  throw new TypeError('fetch failed');
});

function request(dependency, hostname, path, method = 'GET') {
  return {
    body: method === 'POST' ? { credential: 'top-secret-token' } : undefined,
    dependency,
    headers: {},
    method,
    path,
    targetBaseUrl: `http://${hostname}`,
  };
}

try {
  await proxy.forward(
    request('gateway-auth', 'auth.test', '/api/v1/auth/student/login', 'POST'),
    100,
  );
  const notFound = await proxy.forward(
    request('gateway-course', 'course.test', '/api/v1/courses/course-001'),
    100,
  );
  assert.equal(notFound.status, 404);
  await assert.rejects(
    proxy.forward(request('gateway-enrollment', 'enrollment.test', '/api/v1/enrollments'), 100),
    DependencyTimeoutError,
  );
  await assert.rejects(
    proxy.forward(
      request('gateway-submission', 'submission.test', '/api/v1/submissions/submission-001'),
      100,
    ),
    DependencyUnavailableError,
  );
  await assert.rejects(
    proxy.forward(request('gateway-grading', 'grading.test', '/api/v1/grades/grade-001'), 100),
    DependencyUnavailableError,
  );
  assert.equal(fetchCalls, 5, 'Mỗi outbound request chỉ được gọi fetch một lần');

  await telemetry.forceFlush();
  const spans = spanExporter.getFinishedSpans();
  assert.equal(spans.length, 5);
  for (const span of spans) assert.equal(span.kind, SpanKind.CLIENT);
  assert.deepEqual(
    spans.map((span) => span.attributes.dependency_identity),
    [
      'gateway-auth',
      'gateway-course',
      'gateway-enrollment',
      'gateway-submission',
      'gateway-grading',
    ],
  );
  assert.deepEqual(
    spans.map((span) => span.name),
    [
      'gateway-auth POST',
      'gateway-course GET',
      'gateway-enrollment GET',
      'gateway-submission GET',
      'gateway-grading GET',
    ],
    'Gateway client span dùng dependency + method, không ghi path có ID động',
  );
  assert.doesNotMatch(
    JSON.stringify(spans.map((span) => [span.name, span.attributes, span.events])),
    /course-001|submission-001|grade-001/u,
  );
  assert.notEqual(spans[0].status.code, SpanStatusCode.ERROR);
  assert.notEqual(spans[1].status.code, SpanStatusCode.ERROR);
  assert.equal(spans[2].attributes['error.type'], 'timeout');
  assert.equal(spans[3].attributes['error.type'], 'unavailable');
  assert.equal(spans[4].attributes['error.type'], 'unavailable');

  const resourceMetrics = metricExporter.getMetrics();
  const metrics = JSON.stringify(resourceMetrics);
  assert.match(metrics, /gateway.dependency.request.count/);
  assert.match(metrics, /gateway.dependency.error.count/);
  assert.match(metrics, /gateway.dependency.duration/);
  for (const identity of [
    'gateway-auth',
    'gateway-course',
    'gateway-enrollment',
    'gateway-submission',
    'gateway-grading',
  ]) {
    assert.match(metrics, new RegExp(identity));
  }
  const metricSets = resourceMetrics.flatMap((resource) =>
    resource.scopeMetrics.flatMap((scope) => scope.metrics),
  );
  const points = (name) => metricSets.find((metric) => metric.descriptor.name === name).dataPoints;
  assert.equal(
    points('gateway.dependency.request.count').reduce((sum, point) => sum + point.value, 0),
    5,
  );
  assert.equal(
    points('gateway.dependency.error.count').reduce((sum, point) => sum + point.value, 0),
    3,
  );
  assert.doesNotMatch(
    metrics,
    /course-001|submission-001|grade-001|student-001|top-secret-token|url\.path/,
  );
  console.log('Gateway dependency spans, metrics và cardinality assertions đạt.');
} finally {
  await telemetry.shutdown();
}

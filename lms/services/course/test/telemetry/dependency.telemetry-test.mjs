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
    serviceInstanceId: 'course-dependency-test-1',
    serviceName: 'course',
    serviceVersion: '0.1.0-test',
  },
  { spanProcessor: new SimpleSpanProcessor(spanExporter), metricReader },
);
const [{ observeDependency }, { CourseDependencyError }] = await Promise.all([
  import('../../dist/adapters/telemetry/dependency-telemetry.js'),
  import('../../dist/application/course-dependency-error.js'),
]);

try {
  await observeDependency('course-postgres', 'get', async () => ({ id: 'course-001' }));
  await assert.rejects(
    observeDependency('course-redis', 'get', async () => {
      throw new CourseDependencyError('course-redis', 'timeout');
    }),
    CourseDependencyError,
  );
  await telemetry.forceFlush();

  const spans = spanExporter.getFinishedSpans();
  assert.equal(spans.length, 2);
  assert.equal(spans[0].kind, SpanKind.CLIENT);
  assert.equal(spans[0].attributes.dependency_identity, 'course-postgres');
  assert.equal(spans[1].attributes.dependency_identity, 'course-redis');
  assert.equal(spans[1].status.code, SpanStatusCode.ERROR);
  assert.equal(spans[1].attributes['error.type'], 'timeout');
  assert.equal(spans[0].resource.attributes['service.name'], 'course');

  const metrics = JSON.stringify(metricExporter.getMetrics());
  assert.match(metrics, /course.dependency.request.count/);
  assert.match(metrics, /course.dependency.error.count/);
  assert.match(metrics, /course.dependency.duration/);
  assert.match(metrics, /course-postgres/);
  assert.match(metrics, /course-redis/);
  assert.doesNotMatch(
    metrics,
    /course-001|student@example.test|top-secret-token|root_cause|fault_id/,
  );
  console.log('Course dependency spans và metrics assertions đạt.');
} finally {
  await telemetry.shutdown();
}

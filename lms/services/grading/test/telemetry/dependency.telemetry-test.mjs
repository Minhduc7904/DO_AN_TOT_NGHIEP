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
    serviceInstanceId: 'grading-dependency-test-1',
    serviceName: 'grading',
    serviceVersion: '0.1.0-test',
  },
  { metricReader, spanProcessor: new SimpleSpanProcessor(spanExporter) },
);
const [{ observeDependency }, { GradingDependencyError }, { GradeConflictError }] =
  await Promise.all([
    import('../../dist/adapters/telemetry/dependency-telemetry.js'),
    import('../../dist/application/grading-dependency-error.js'),
    import('../../dist/application/grade-conflict-error.js'),
  ]);

try {
  await observeDependency('grading-submission', 'get', async () => ({ id: 'submission-001' }));
  await observeDependency('grading-postgres', 'get', async () => null);
  await assert.rejects(
    observeDependency('grading-submission', 'get', async () => {
      throw new GradingDependencyError('grading-submission', 'timeout');
    }),
    GradingDependencyError,
  );
  await assert.rejects(
    observeDependency('grading-postgres', 'create', async () => {
      throw new GradingDependencyError('grading-postgres', 'unavailable');
    }),
    GradingDependencyError,
  );
  // Conflict là kết quả nghiệp vụ nên không được tính vào lỗi dependency.
  await assert.rejects(
    observeDependency('grading-postgres', 'create', async () => {
      throw new GradeConflictError('submission-001');
    }),
    GradeConflictError,
  );
  await telemetry.forceFlush();

  const spans = spanExporter.getFinishedSpans();
  assert.equal(spans.length, 5);
  for (const span of spans) assert.equal(span.kind, SpanKind.CLIENT);
  assert.deepEqual(
    spans.map((span) => span.attributes.dependency_identity),
    [
      'grading-submission',
      'grading-postgres',
      'grading-submission',
      'grading-postgres',
      'grading-postgres',
    ],
  );
  assert.equal(spans[2].status.code, SpanStatusCode.ERROR);
  assert.equal(spans[2].attributes['error.type'], 'timeout');
  assert.equal(spans[3].status.code, SpanStatusCode.ERROR);
  assert.equal(spans[3].attributes['error.type'], 'unavailable');
  assert.notEqual(spans[4].status.code, SpanStatusCode.ERROR);
  assert.equal(spans[4].attributes['error.type'], undefined);
  assert.equal(spans[0].resource.attributes['service.name'], 'grading');

  const metrics = JSON.stringify(metricExporter.getMetrics());
  assert.match(metrics, /grading.dependency.request.count/);
  assert.match(metrics, /grading.dependency.error.count/);
  assert.match(metrics, /grading.dependency.duration/);
  for (const identity of ['grading-submission', 'grading-postgres'])
    assert.match(metrics, new RegExp(identity));
  const metricSets = metricExporter
    .getMetrics()
    .flatMap((resource) => resource.scopeMetrics.flatMap((scope) => scope.metrics));
  const points = (name) => metricSets.find((metric) => metric.descriptor.name === name).dataPoints;
  const errorPoints = points('grading.dependency.error.count');
  assert.deepEqual(errorPoints.map((point) => point.attributes.status).sort(), [
    'timeout',
    'unavailable',
  ]);
  assert.equal(
    points('grading.dependency.request.count').reduce((sum, point) => sum + point.value, 0),
    5,
  );
  assert.doesNotMatch(
    metrics,
    /student-001|course-001|submission-001|top-secret-token|root_cause|fault_id/,
  );
  console.log('Grading dependency spans và metrics assertions đạt.');
} finally {
  await telemetry.shutdown();
}

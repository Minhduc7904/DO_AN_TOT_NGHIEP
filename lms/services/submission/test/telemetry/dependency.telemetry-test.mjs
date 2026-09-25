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
    serviceInstanceId: 'submission-dependency-test-1',
    serviceName: 'submission',
    serviceVersion: '0.1.0-test',
  },
  { metricReader, spanProcessor: new SimpleSpanProcessor(spanExporter) },
);
const [{ observeDependency }, { SubmissionDependencyError }] = await Promise.all([
  import('../../dist/adapters/telemetry/dependency-telemetry.js'),
  import('../../dist/application/submission-dependency-error.js'),
]);

try {
  await observeDependency('submission-course', 'exists', async () => true);
  await observeDependency('submission-enrollment', 'check', async () => true);
  await observeDependency('submission-postgres', 'create', async () => ({ id: 'submission-001' }));
  await assert.rejects(
    observeDependency('submission-storage', 'put', async () => {
      throw new SubmissionDependencyError('submission-storage', 'timeout');
    }),
    SubmissionDependencyError,
  );
  await telemetry.forceFlush();

  const spans = spanExporter.getFinishedSpans();
  assert.equal(spans.length, 4);
  for (const span of spans) assert.equal(span.kind, SpanKind.CLIENT);
  assert.deepEqual(
    spans.map((span) => span.attributes.dependency_identity),
    ['submission-course', 'submission-enrollment', 'submission-postgres', 'submission-storage'],
  );
  assert.equal(spans[3].status.code, SpanStatusCode.ERROR);
  assert.equal(spans[3].attributes['error.type'], 'timeout');
  assert.equal(spans[0].resource.attributes['service.name'], 'submission');

  const metrics = JSON.stringify(metricExporter.getMetrics());
  assert.match(metrics, /submission.dependency.request.count/);
  assert.match(metrics, /submission.dependency.error.count/);
  assert.match(metrics, /submission.dependency.duration/);
  for (const identity of [
    'submission-course',
    'submission-enrollment',
    'submission-postgres',
    'submission-storage',
  ]) {
    assert.match(metrics, new RegExp(identity));
  }
  assert.doesNotMatch(
    metrics,
    /student-001|course-001|submission-001|top-secret-token|root_cause|fault_id/,
  );
  console.log('Submission dependency spans và metrics assertions đạt.');
} finally {
  await telemetry.shutdown();
}

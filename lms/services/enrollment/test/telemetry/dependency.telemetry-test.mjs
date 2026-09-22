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
    serviceInstanceId: 'enrollment-dependency-test-1',
    serviceName: 'enrollment',
    serviceVersion: '0.1.0-test',
  },
  { spanProcessor: new SimpleSpanProcessor(spanExporter), metricReader },
);
const [{ observeDependency }, { EnrollmentDependencyError }] = await Promise.all([
  import('../../dist/adapters/telemetry/dependency-telemetry.js'),
  import('../../dist/application/enrollment-dependency-error.js'),
]);

try {
  await observeDependency('enrollment-postgres', 'get', async () => ({ id: 'enrollment-001' }));
  await assert.rejects(
    observeDependency('enrollment-course', 'exists', async () => {
      throw new EnrollmentDependencyError('enrollment-course', 'timeout');
    }),
    EnrollmentDependencyError,
  );
  await assert.rejects(
    observeDependency('enrollment-postgres', 'create', async () => {
      const conflict = new Error('duplicate key value violates unique constraint');
      conflict.code = '23505';
      throw conflict;
    }),
  );
  await telemetry.forceFlush();

  const spans = spanExporter.getFinishedSpans();
  assert.equal(spans.length, 3);
  assert.equal(spans[0].kind, SpanKind.CLIENT);
  assert.equal(spans[0].attributes.dependency_identity, 'enrollment-postgres');
  assert.equal(spans[1].attributes.dependency_identity, 'enrollment-course');
  assert.equal(spans[1].status.code, SpanStatusCode.ERROR);
  assert.equal(spans[1].attributes['error.type'], 'timeout');
  assert.equal(spans[2].attributes.dependency_identity, 'enrollment-postgres');
  assert.equal(spans[2].attributes['error.type'], 'conflict');
  assert.notEqual(spans[2].status.code, SpanStatusCode.ERROR);
  assert.equal(spans[0].resource.attributes['service.name'], 'enrollment');

  const metrics = JSON.stringify(metricExporter.getMetrics());
  assert.match(metrics, /enrollment.dependency.request.count/);
  assert.match(metrics, /enrollment.dependency.error.count/);
  assert.match(metrics, /enrollment.dependency.duration/);
  assert.match(metrics, /enrollment-postgres/);
  assert.match(metrics, /enrollment-course/);
  assert.doesNotMatch(
    metrics,
    /student-001|course-001|student@example.test|top-secret-token|root_cause|fault_id/,
  );
  console.log('Enrollment dependency spans và metrics assertions đạt.');
} finally {
  await telemetry.shutdown();
}

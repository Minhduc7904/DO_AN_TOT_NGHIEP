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
const metricReader = new PeriodicExportingMetricReader({
  exporter: metricExporter,
  exportIntervalMillis: 3_600_000,
});
const telemetry = startTelemetry(
  {
    enabled: true,
    otlpTracesEndpoint: 'http://127.0.0.1:4318/v1/traces',
    serviceInstanceId: 'grading-messaging-test-1',
    serviceName: 'grading',
    serviceVersion: '0.1.0-test',
  },
  { metricReader, spanProcessor: new SimpleSpanProcessor(spanExporter) },
);
const [{ observePublish, setPendingGradeEvents }, { buildGradeCompletedMessage }, publishErrors] =
  await Promise.all([
    import('../../dist/adapters/telemetry/messaging-telemetry.js'),
    import('../../dist/adapters/messaging/grade-completed-event.factory.js'),
    import('../../dist/application/grade-event-publish-error.js'),
  ]);
const { GradeEventPublishError } = publishErrors;

const target = {
  eventId: '018f4e60-4e21-7d38-b1f4-842d4f2e1234',
  exchange: 'lms.events',
  routingKey: 'grade.completed',
};
const snapshot = {
  completedAt: '2026-10-08T00:00:00.000Z',
  courseId: 'course-001',
  eventId: target.eventId,
  gradeId: '7d1f3a52-0c4e-4b8a-9d36-5a2e8f10c001',
  principalId: 'student-001',
  score: 90,
  submissionId: 'submission-001',
};

try {
  let message;
  await observePublish(target, async () => {
    message = buildGradeCompletedMessage(snapshot, '0.1.0-test');
  });
  for (const code of ['PUBLISH_TIMEOUT', 'BROKER_UNAVAILABLE', 'EVENT_INVALID']) {
    await assert.rejects(
      observePublish(target, async () => {
        throw new GradeEventPublishError(code);
      }),
      GradeEventPublishError,
    );
  }
  setPendingGradeEvents(3);
  await telemetry.forceFlush();
  setPendingGradeEvents(0);
  await telemetry.forceFlush();

  const spans = spanExporter.getFinishedSpans();
  assert.equal(spans.length, 4);
  for (const span of spans) {
    assert.equal(span.kind, SpanKind.PRODUCER);
    assert.equal(span.name, 'lms.events publish');
    assert.equal(span.attributes['messaging.system'], 'rabbitmq');
    assert.equal(span.attributes['messaging.operation.type'], 'publish');
    assert.equal(span.attributes['messaging.destination.name'], 'lms.events');
    assert.equal(span.attributes['messaging.rabbitmq.destination.routing_key'], 'grade.completed');
    assert.equal(span.attributes.dependency_identity, 'grading-rabbitmq');
    assert.equal(span.attributes.operation_name, 'publish');
    assert.equal(span.resource.attributes['service.name'], 'grading');
  }
  assert.notEqual(spans[0].status.code, SpanStatusCode.ERROR);
  assert.equal(spans[0].attributes['error.type'], undefined);
  assert.deepEqual(
    spans.slice(1).map((span) => [span.status.code, span.attributes['error.type']]),
    [
      [SpanStatusCode.ERROR, 'timeout'],
      [SpanStatusCode.ERROR, 'unavailable'],
      [SpanStatusCode.ERROR, 'invalid'],
    ],
  );
  for (const span of spans) assert.equal(span.events.length, 0);

  // Trace context được inject từ chính producer span và dùng chung cho headers lẫn envelope.
  const producerContext = spans[0].spanContext();
  const expectedTraceparent = `00-${producerContext.traceId}-${producerContext.spanId}-01`;
  assert.equal(message.headers.traceparent, expectedTraceparent);
  assert.equal(message.event.correlation.traceparent, expectedTraceparent);

  const metricSets = metricExporter
    .getMetrics()
    .flatMap((resource) => resource.scopeMetrics.flatMap((scope) => scope.metrics));
  const points = (name) =>
    metricSets
      .filter((metric) => metric.descriptor.name === name)
      .flatMap((metric) => metric.dataPoints);
  const sum = (name) => points(name).reduce((total, point) => total + point.value, 0);
  assert.equal(sum('grading.messaging.publish.count'), 4);
  assert.deepEqual(
    points('grading.messaging.publish.error.count')
      .filter((point) => point.value > 0)
      .map((point) => point.attributes.status)
      .sort(),
    ['invalid', 'timeout', 'unavailable'],
  );
  assert.ok(points('grading.messaging.publish.duration').length > 0);
  assert.deepEqual(
    points('grading.messaging.pending.count').map((point) => point.value),
    [3, 0],
  );
  for (const point of points('grading.messaging.publish.count')) {
    assert.deepEqual(Object.keys(point.attributes).sort(), [
      'dependency_identity',
      'exchange',
      'operation_name',
      'routing_key',
      'status',
    ]);
    assert.equal(point.attributes.dependency_identity, 'grading-rabbitmq');
  }
  assert.doesNotMatch(
    JSON.stringify(metricExporter.getMetrics()),
    /018f4e60|student-001|course-001|submission-001|top-secret-token|traceparent/u,
  );
  console.log('Grading RabbitMQ publish spans và metrics assertions đạt.');
} finally {
  await telemetry.shutdown();
}

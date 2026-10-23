import assert from 'node:assert/strict';

import {
  InMemoryMetricExporter,
  InMemorySpanExporter,
  PeriodicExportingMetricReader,
  SimpleSpanProcessor,
  SpanKind,
} from '@aiops-lms/observability/testing';
import { configureStructuredLogging, startTelemetry } from '@aiops-lms/observability';
import amqp from 'amqplib';

const brokerUrl = process.env.NOTIFICATION_RABBITMQ_URL;
if (!brokerUrl) {
  throw new Error('NOTIFICATION_RABBITMQ_URL là bắt buộc');
}

const EXCHANGE = 'lms.events';
const QUEUE = 'notification.grade-completed.integration';
const ROUTING_KEY = 'grade.completed';
const EVENT_ID = '018f4e60-4e21-7d38-b1f4-842d4f2e5678';

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
    serviceInstanceId: 'notification-rabbitmq-test-1',
    serviceName: 'notification',
    serviceVersion: '0.1.0-test',
  },
  { metricReader, spanProcessor: new SimpleSpanProcessor(spanExporter) },
);

const [
  { GradeCompletedFixtureConsumer },
  { NotificationConsumerFault },
  { NotificationMessagingTelemetry },
  { connectRabbitMq },
  { RabbitMqGradeCompletedConsumer },
  { RabbitMqGradeCompletedMessageHandler },
  { RabbitMqGradeCompletedPublisher },
] = await Promise.all([
  import('../dist/adapters/messaging/grade-completed.fixture-consumer.js'),
  import('../dist/adapters/messaging/notification-consumer-fault.js'),
  import('../dist/adapters/messaging/notification-messaging-telemetry.js'),
  import('../dist/adapters/messaging/rabbitmq-client.js'),
  import('../dist/adapters/messaging/rabbitmq-grade-completed.consumer.js'),
  import('../dist/adapters/messaging/rabbitmq-grade-completed.message-handler.js'),
  import('../../grading/dist/adapters/messaging/rabbitmq-grade-completed.publisher.js'),
]);

const notificationConfig = {
  getOrThrow: (key) =>
    ({
      NOTIFICATION_CONSUMER_SLOWDOWN_ENABLED: true,
      NOTIFICATION_CONSUMER_SLOWDOWN_MS: 250,
    })[key],
};
const publisherConfig = {
  getOrThrow: (key) =>
    ({
      GRADING_GRADE_COMPLETED_EXCHANGE: EXCHANGE,
      GRADING_PUBLISH_CONFIRM_TIMEOUT_MS: 2_000,
      GRADING_RABBITMQ_URL: brokerUrl,
      OTEL_SERVICE_VERSION: '0.1.0-test',
    })[key],
};
const binding = {
  exchange: EXCHANGE,
  prefetch: 1,
  queue: QUEUE,
  reconnect_delay_ms: 100,
  routing_key: ROUTING_KEY,
  url: brokerUrl,
};
const snapshot = {
  completedAt: '2026-09-20T09:00:00.000Z',
  courseId: 'course-001',
  eventId: EVENT_ID,
  gradeId: 'grade-integration-001',
  principalId: 'student-001',
  score: 92,
  submissionId: 'submission-001',
};

async function waitUntil(predicate, description, timeoutMs = 8_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Quá hạn khi chờ ${description}`);
}

const admin = await amqp.connect(brokerUrl);
const adminChannel = await admin.createChannel();
await adminChannel.assertExchange(EXCHANGE, 'topic', { durable: true });
await adminChannel.assertQueue(QUEUE, { durable: true });
await adminChannel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);
await adminChannel.purgeQueue(QUEUE);

const processor = new GradeCompletedFixtureConsumer();
const notificationTelemetry = new NotificationMessagingTelemetry(binding);
const handler = new RabbitMqGradeCompletedMessageHandler(
  processor,
  new NotificationConsumerFault(notificationConfig),
  notificationTelemetry,
);
const consumer = new RabbitMqGradeCompletedConsumer(
  binding,
  handler,
  connectRabbitMq,
  notificationTelemetry,
);
const publisher = new RabbitMqGradeCompletedPublisher(publisherConfig);
const infoLines = [];
const errorLines = [];
// Bắt structured log của consumer: INFO có outcome là kết quả xử lý, ERROR là lỗi consume/connect.
configureStructuredLogging(
  {
    serviceInstanceId: 'notification-rabbitmq-test-1',
    serviceName: 'notification',
    serviceVersion: '0.1.0-test',
  },
  {
    write: (line) => {
      const record = JSON.parse(line);
      if (record.level === 'ERROR') errorLines.push(line);
      else if (record.level === 'INFO' && record.outcome) infoLines.push(line);
    },
  },
);

try {
  consumer.onModuleInit();
  await consumer.waitUntilConnected();
  assert.equal((await adminChannel.checkQueue(QUEUE)).consumerCount, 1);

  await publisher.publish(snapshot);
  await publisher.publish(snapshot);
  await publisher.publish(snapshot);

  await waitUntil(
    async () => (await adminChannel.checkQueue(QUEUE)).messageCount >= 1,
    'queue backlog khi fault slowdown bật',
  );
  await waitUntil(() => infoLines.length === 3, 'ba event được consumer xử lý');
  await waitUntil(
    async () => (await adminChannel.checkQueue(QUEUE)).messageCount === 0,
    'queue drain',
  );

  assert.equal(processor.hasProcessed(EVENT_ID), true);
  const outcomes = infoLines.map((line) => JSON.parse(line).outcome);
  assert.deepEqual(outcomes, ['accepted', 'duplicate', 'duplicate']);

  await telemetry.forceFlush();
  const spans = spanExporter.getFinishedSpans();
  const producers = spans.filter((span) => span.kind === SpanKind.PRODUCER);
  const consumes = spans.filter((span) => span.name === 'rabbitmq consume grade.completed');
  const processes = spans.filter((span) => span.name === 'notification process grade.completed');
  assert.equal(producers.length, 3);
  assert.equal(consumes.length, 3);
  assert.equal(processes.length, 3);
  const producerTraceIds = producers.map((span) => span.spanContext().traceId).sort();
  assert.deepEqual(consumes.map((span) => span.spanContext().traceId).sort(), producerTraceIds);
  assert.deepEqual(processes.map((span) => span.spanContext().traceId).sort(), producerTraceIds);
  for (const consume of consumes) {
    assert.equal(consume.attributes.dependency_identity, 'notification-rabbitmq');
    assert.equal(consume.attributes['messaging.destination.name'], QUEUE);
  }

  const metrics = JSON.stringify(metricExporter.getMetrics());
  for (const name of [
    'notification.rabbitmq.consume.count',
    'notification.rabbitmq.consume.duration',
    'notification.process.count',
    'notification.process.duration',
  ]) {
    assert.match(metrics, new RegExp(name.replaceAll('.', '\\.'), 'u'));
  }
  const evidence = JSON.stringify({ errorLines, infoLines, metrics });
  assert.doesNotMatch(evidence, /lms-local-only|w1_test_password|amqp:\/\/|student-001/u);
  console.log('Notification RabbitMQ consume, duplicate, backlog và telemetry integration đạt.');
} finally {
  await consumer.onModuleDestroy().catch(() => undefined);
  await publisher.onApplicationShutdown().catch(() => undefined);
  await adminChannel.deleteQueue(QUEUE).catch(() => undefined);
  await adminChannel.close().catch(() => undefined);
  await admin.close().catch(() => undefined);
  await telemetry.shutdown();
}

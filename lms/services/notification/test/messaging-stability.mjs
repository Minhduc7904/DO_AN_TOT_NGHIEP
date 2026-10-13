import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { connect as connectSocket, createServer } from 'node:net';

import { startTelemetry } from '@aiops-lms/observability';
import {
  InMemoryMetricExporter,
  InMemorySpanExporter,
  PeriodicExportingMetricReader,
  SimpleSpanProcessor,
  SpanKind,
} from '@aiops-lms/observability/testing';
import amqp from 'amqplib';

const brokerUrl = process.env.NOTIFICATION_RABBITMQ_URL;
if (!brokerUrl) throw new Error('NOTIFICATION_RABBITMQ_URL là bắt buộc');

const EXCHANGE = 'lms.events';
const ROUTING_KEY = 'grade.completed';
const ROUNDS = 3;

const spanExporter = new InMemorySpanExporter();
const metricExporter = new InMemoryMetricExporter();
const telemetry = startTelemetry(
  {
    enabled: true,
    otlpTracesEndpoint: 'http://127.0.0.1:4318/v1/traces',
    serviceInstanceId: 'notification-stability-test-1',
    serviceName: 'notification',
    serviceVersion: '0.1.0-test',
  },
  {
    metricReader: new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 3_600_000,
    }),
    spanProcessor: new SimpleSpanProcessor(spanExporter),
  },
);

const [
  { GradeCompletedFixtureConsumer },
  { NotificationMessagingTelemetry },
  { connectRabbitMq },
  { RabbitMqGradeCompletedConsumer },
  { RabbitMqGradeCompletedMessageHandler },
  { RabbitMqGradeCompletedPublisher },
] = await Promise.all([
  import('../dist/adapters/messaging/grade-completed.fixture-consumer.js'),
  import('../dist/adapters/messaging/notification-messaging-telemetry.js'),
  import('../dist/adapters/messaging/rabbitmq-client.js'),
  import('../dist/adapters/messaging/rabbitmq-grade-completed.consumer.js'),
  import('../dist/adapters/messaging/rabbitmq-grade-completed.message-handler.js'),
  import('../../grading/dist/adapters/messaging/rabbitmq-grade-completed.publisher.js'),
]);

function createBrokerProxy(targetUrl) {
  const target = new URL(targetUrl);
  const sockets = new Set();
  let port = 0;
  let server;

  return {
    async start() {
      server = createServer((client) => {
        const upstream = connectSocket(Number(target.port || 5672), target.hostname);
        for (const socket of [client, upstream]) {
          sockets.add(socket);
          socket.on('error', () => socket.destroy());
          socket.on('close', () => sockets.delete(socket));
        }
        client.pipe(upstream);
        upstream.pipe(client);
        client.on('close', () => upstream.destroy());
        upstream.on('close', () => client.destroy());
      });
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => {
          port = server.address().port;
          resolve();
        });
      });
    },
    async stop() {
      for (const socket of sockets) socket.destroy();
      if (!server) return;
      const closing = server;
      server = undefined;
      await new Promise((resolve) => closing.close(resolve));
    },
    url() {
      const url = new URL(targetUrl);
      url.hostname = '127.0.0.1';
      url.port = String(port);
      return url.toString();
    },
  };
}

async function waitUntil(predicate, description, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Quá hạn khi chờ ${description}`);
}

function snapshot(eventId = randomUUID()) {
  return {
    completedAt: '2026-10-13T07:00:00.000Z',
    courseId: 'course-stability',
    eventId,
    gradeId: randomUUID(),
    principalId: 'student-stability',
    score: 91,
    submissionId: randomUUID(),
  };
}

const admin = await amqp.connect(brokerUrl);
const adminChannel = await admin.createChannel();
await adminChannel.assertExchange(EXCHANGE, 'topic', { durable: true });
const publisher = new RabbitMqGradeCompletedPublisher({
  getOrThrow: (key) =>
    ({
      GRADING_GRADE_COMPLETED_EXCHANGE: EXCHANGE,
      GRADING_PUBLISH_CONFIRM_TIMEOUT_MS: 2_000,
      GRADING_RABBITMQ_URL: brokerUrl,
      OTEL_SERVICE_VERSION: '0.1.0-test',
    })[key],
});
const infoLines = [];
const errorLines = [];
const originalInfo = console.info;
const originalError = console.error;
console.info = (...values) => infoLines.push(values.map(String).join(' '));
console.error = (...values) => errorLines.push(values.map(String).join(' '));

try {
  for (let round = 1; round <= ROUNDS; round += 1) {
    const queue = `notification.grade-completed.stability-${round}`;
    const proxy = createBrokerProxy(brokerUrl);
    await proxy.start();
    await proxy.stop();
    await adminChannel.assertQueue(queue, { durable: true });
    await adminChannel.bindQueue(queue, EXCHANGE, ROUTING_KEY);
    await adminChannel.purgeQueue(queue);

    let releaseProcessing;
    let processingStarted;
    let slowdownMs = 0;
    const processingStartedPromise = new Promise((resolve) => {
      processingStarted = resolve;
    });
    const processingGate = new Promise((resolve) => {
      releaseProcessing = resolve;
    });
    let gateEnabled = true;
    const fault = {
      async beforeProcess() {
        if (gateEnabled) {
          processingStarted();
          await processingGate;
          gateEnabled = false;
        }
        if (slowdownMs > 0) await new Promise((resolve) => setTimeout(resolve, slowdownMs));
      },
    };
    const binding = {
      exchange: EXCHANGE,
      prefetch: 1,
      queue,
      reconnect_delay_ms: 100,
      routing_key: ROUTING_KEY,
      url: proxy.url(),
    };
    const notificationTelemetry = new NotificationMessagingTelemetry(binding);
    const processor = new GradeCompletedFixtureConsumer();
    const handler = new RabbitMqGradeCompletedMessageHandler(
      processor,
      fault,
      notificationTelemetry,
    );
    const consumer = new RabbitMqGradeCompletedConsumer(
      binding,
      handler,
      connectRabbitMq,
      notificationTelemetry,
    );
    const roundInfoStart = infoLines.length;

    try {
      const startupStartedAt = performance.now();
      consumer.onModuleInit();
      assert.ok(performance.now() - startupStartedAt < 100, 'startup không được chờ RabbitMQ');
      await waitUntil(
        () => errorLines.some((line) => line.includes('"outcome":"unavailable"')),
        `unavailable telemetry vòng ${round}`,
      );

      await proxy.start();
      await consumer.waitUntilConnected();
      await waitUntil(
        async () => (await adminChannel.checkQueue(queue)).consumerCount === 1,
        `consumer reconnect vòng ${round}`,
      );

      adminChannel.publish(EXCHANGE, ROUTING_KEY, Buffer.from('{"invalid":'), {
        deliveryMode: 2,
        headers: {},
      });
      await waitUntil(
        async () => (await adminChannel.checkQueue(queue)).messageCount === 0,
        `invalid message bị reject vòng ${round}`,
      );

      const redelivered = snapshot();
      await publisher.publish(redelivered);
      await processingStartedPromise;
      await proxy.stop();
      releaseProcessing();
      await waitUntil(
        async () => (await adminChannel.checkQueue(queue)).consumerCount === 0,
        `connection đóng vòng ${round}`,
      );
      await proxy.start();
      await consumer.waitUntilConnected();
      await waitUntil(
        () =>
          infoLines
            .slice(roundInfoStart)
            .filter((line) => line.includes(`"event_id":"${redelivered.eventId}"`)).length >= 2,
        `message redelivery vòng ${round}`,
      );
      const redeliveryOutcomes = infoLines
        .slice(roundInfoStart)
        .filter((line) => line.includes(`"event_id":"${redelivered.eventId}"`))
        .map((line) => JSON.parse(line).outcome);
      assert.deepEqual(redeliveryOutcomes, ['accepted', 'duplicate']);

      await publisher.publish(redelivered);
      await waitUntil(
        () =>
          infoLines
            .slice(roundInfoStart)
            .filter((line) => line.includes(`"event_id":"${redelivered.eventId}"`)).length === 3,
        `duplicate delivery vòng ${round}`,
      );

      slowdownMs = 150;
      const backlogEvents = [snapshot(), snapshot(), snapshot()];
      for (const event of backlogEvents) await publisher.publish(event);
      await waitUntil(
        async () => (await adminChannel.checkQueue(queue)).messageCount >= 1,
        `slowdown tạo backlog vòng ${round}`,
      );
      await waitUntil(
        async () => (await adminChannel.checkQueue(queue)).messageCount === 0,
        `backlog drain vòng ${round}`,
      );
      await waitUntil(
        () => backlogEvents.every((event) => processor.hasProcessed(event.eventId)),
        `toàn bộ backlog được xử lý vòng ${round}`,
      );
    } finally {
      releaseProcessing?.();
      await consumer.onModuleDestroy().catch(() => undefined);
      await proxy.stop().catch(() => undefined);
      await adminChannel.deleteQueue(queue).catch(() => undefined);
    }
  }

  await telemetry.forceFlush();
  const spans = spanExporter.getFinishedSpans();
  const producerTraceIds = new Set(
    spans
      .filter((span) => span.kind === SpanKind.PRODUCER)
      .map((span) => span.spanContext().traceId),
  );
  const consumeSpans = spans.filter((span) => span.name === 'rabbitmq consume grade.completed');
  assert.ok(consumeSpans.length > 0);
  for (const span of consumeSpans) {
    assert.equal(span.attributes.dependency_identity, 'notification-rabbitmq');
    if (span.attributes['messaging.message.id']) {
      assert.ok(producerTraceIds.has(span.spanContext().traceId));
    }
  }

  const metrics = JSON.stringify(metricExporter.getMetrics());
  assert.match(metrics, /notification\.rabbitmq\.connection\.count/u);
  for (const outcome of ['accepted', 'duplicate', 'rejected', 'unavailable']) {
    assert.match(metrics, new RegExp(`"status":"${outcome}"`, 'u'));
  }
  assert.doesNotMatch(
    metrics,
    /student-stability|lms-local-only|w1_test_password|amqp:\/\/|event_id|credential/u,
  );
  assert.doesNotMatch(
    JSON.stringify(errorLines),
    /student-stability|lms-local-only|w1_test_password|amqp:\/\/|credential/u,
  );

  console.info = originalInfo;
  console.log(
    'Messaging stability đạt 3/3 vòng: reconnect, redelivery, duplicate và backlog drain.',
  );
} finally {
  console.info = originalInfo;
  console.error = originalError;
  await publisher.onApplicationShutdown().catch(() => undefined);
  await adminChannel.close().catch(() => undefined);
  await admin.close().catch(() => undefined);
  await telemetry.shutdown();
}

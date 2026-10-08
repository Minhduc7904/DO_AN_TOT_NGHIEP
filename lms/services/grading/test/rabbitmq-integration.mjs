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
  SpanStatusCode,
} from '@aiops-lms/observability/testing';
import {
  gradeCompletedEventSchema,
  createGradeCompletedRabbitMqHeaders,
} from '@aiops-lms/contracts';
import { trace } from '@opentelemetry/api';
import amqp from 'amqplib';
import { Pool } from 'pg';

const brokerUrl = process.env.GRADING_RABBITMQ_URL;
const databaseUrl = process.env.GRADING_DATABASE_URL;
if (!brokerUrl || !databaseUrl) {
  throw new Error('GRADING_RABBITMQ_URL và GRADING_DATABASE_URL là bắt buộc');
}
const EXCHANGE = 'lms.events';
const ROUTING_KEY = 'grade.completed';
const CONFIRM_TIMEOUT_MS = 800;

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
    serviceInstanceId: 'grading-rabbitmq-test-1',
    serviceName: 'grading',
    serviceVersion: '0.1.0-test',
  },
  { metricReader, spanProcessor: new SimpleSpanProcessor(spanExporter) },
);
// Meter của OpenTelemetry chỉ bind khi provider đã đăng ký nên import dist sau startTelemetry.
const [
  { RabbitMqGradeCompletedPublisher },
  { PostgresGradeRepository },
  { PendingGradeEventWorker },
  { GradePublicationCoordinator },
  { GradingService },
  { GradeEventPublishError },
  { GradeEventPendingError },
  { GradeConflictError },
] = await Promise.all([
  import('./../dist/adapters/messaging/rabbitmq-grade-completed.publisher.js'),
  import('./../dist/adapters/persistence/postgres-grade.repository.js'),
  import('./../dist/adapters/messaging/pending-grade-event.worker.js'),
  import('./../dist/application/grade-publication.coordinator.js'),
  import('./../dist/application/grading.service.js'),
  import('./../dist/application/grade-event-publish-error.js'),
  import('./../dist/application/grade-event-pending-error.js'),
  import('./../dist/application/grade-conflict-error.js'),
]);

const configFor = (url) => ({
  getOrThrow: (key) =>
    ({
      GRADING_EVENT_RETRY_BATCH_SIZE: 20,
      GRADING_EVENT_RETRY_INTERVAL_MS: 1_000,
      GRADING_GRADE_COMPLETED_EXCHANGE: EXCHANGE,
      GRADING_PUBLISH_CONFIRM_TIMEOUT_MS: CONFIRM_TIMEOUT_MS,
      GRADING_RABBITMQ_URL: url,
      OTEL_SERVICE_VERSION: '0.1.0-test',
    })[key],
});

function snapshot(overrides = {}) {
  return {
    completedAt: new Date().toISOString(),
    courseId: 'course-001',
    eventId: randomUUID(),
    gradeId: randomUUID(),
    principalId: 'student-001',
    score: 92.5,
    submissionId: `submission-${randomUUID()}`,
    ...overrides,
  };
}

async function listen(server, port = 0) {
  server.listen(port, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  return server.address().port;
}

/** Proxy TCP tới broker thật để dừng/bật lại đường kết nối mà không động tới broker. */
function createBrokerProxy(targetUrl) {
  const target = new URL(targetUrl);
  const sockets = new Set();
  let server;
  let port = 0;
  let frozen = false;
  return {
    get port() {
      return port;
    },
    get openSockets() {
      return sockets.size;
    },
    /** Giữ socket mở nhưng nuốt mọi dữ liệu: mô phỏng mạng treo (broker không bao giờ confirm). */
    freeze() {
      frozen = true;
    },
    thaw() {
      frozen = false;
    },
    async start() {
      server = createServer((client) => {
        const upstream = connectSocket(Number(target.port || 5672), target.hostname);
        for (const socket of [client, upstream]) {
          sockets.add(socket);
          socket.on('error', () => socket.destroy());
          socket.on('close', () => sockets.delete(socket));
        }
        client.on('data', (chunk) => {
          if (!frozen) upstream.write(chunk);
        });
        upstream.on('data', (chunk) => {
          if (!frozen) client.write(chunk);
        });
        client.on('close', () => upstream.destroy());
        upstream.on('close', () => client.destroy());
      });
      port = await listen(server, port);
    },
    async stop() {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    },
    url() {
      const url = new URL(targetUrl);
      url.hostname = '127.0.0.1';
      url.port = String(port);
      return url.toString();
    },
  };
}

const admin = await amqp.connect(brokerUrl);
const adminChannel = await admin.createChannel();
await adminChannel.assertExchange(EXCHANGE, 'topic', { durable: true });
const queue = (await adminChannel.assertQueue('', { exclusive: true })).queue;
await adminChannel.bindQueue(queue, EXCHANGE, ROUTING_KEY);

async function receive(count, timeoutMs = 5_000) {
  const messages = [];
  const deadline = Date.now() + timeoutMs;
  while (messages.length < count && Date.now() < deadline) {
    const message = await adminChannel.get(queue, { noAck: true });
    if (message) messages.push(message);
    else await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return messages;
}

async function assertQueueEmpty() {
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal((await adminChannel.checkQueue(queue)).messageCount, 0);
}

function pendingGauge() {
  const metricSets = metricExporter
    .getMetrics()
    .flatMap((resource) => resource.scopeMetrics.flatMap((scope) => scope.metrics));
  const points = metricSets
    .filter((metric) => metric.descriptor.name === 'grading.messaging.pending.count')
    .flatMap((metric) => metric.dataPoints);
  return points.at(-1)?.value;
}

const tracer = trace.getTracer('rabbitmq-integration-test');
const publishers = [];
const databasePool = new Pool({ connectionString: databaseUrl });
const repository = new PostgresGradeRepository({ getOrThrow: () => databaseUrl });
let proxy;
try {
  // --- 1. Publish thật: exchange, routing key, persistent, JSON hợp lệ, trace context ---
  const publisher = new RabbitMqGradeCompletedPublisher(configFor(brokerUrl));
  publishers.push(publisher);
  const input = snapshot();
  await tracer.startActiveSpan('parent-request', async (parent) => {
    await publisher.publish(input);
    parent.end();
  });
  const [first] = await receive(1);
  assert.ok(first, 'consumer tạm phải nhận được event');
  assert.equal(first.fields.exchange, EXCHANGE);
  assert.equal(first.fields.routingKey, ROUTING_KEY);
  assert.equal(first.properties.deliveryMode, 2);
  assert.equal(first.properties.contentType, 'application/json');
  assert.equal(first.properties.messageId, input.eventId);
  const body = first.content.toString('utf8');
  const event = gradeCompletedEventSchema.parse(JSON.parse(body));
  assert.equal(event.event_id, input.eventId);
  assert.equal(event.event_name, 'grade.completed');
  assert.equal(event.schema_version, 1);
  assert.equal(event.occurred_at, input.completedAt);
  assert.equal(event.producer.service_name, 'grading');
  assert.deepEqual(event.payload, {
    completed_at: input.completedAt,
    course_id: input.courseId,
    grade_id: input.gradeId,
    principal_id: input.principalId,
    score: 92.5,
    submission_id: input.submissionId,
  });
  assert.doesNotMatch(body, /lms-local-only|amqp:\/\//u);

  const headers = first.properties.headers;
  assert.equal(headers.traceparent, event.correlation.traceparent);
  assert.deepEqual(
    { traceparent: headers.traceparent },
    createGradeCompletedRabbitMqHeaders(event),
  );
  await telemetry.forceFlush();
  const producerSpans = spanExporter
    .getFinishedSpans()
    .filter((span) => span.kind === SpanKind.PRODUCER);
  assert.equal(producerSpans.length, 1);
  const [producer] = producerSpans;
  const parentSpan = spanExporter.getFinishedSpans().find((span) => span.name === 'parent-request');
  assert.equal(producer.name, `${EXCHANGE} publish`);
  assert.equal(producer.parentSpanContext?.spanId, parentSpan.spanContext().spanId);
  assert.equal(producer.spanContext().traceId, parentSpan.spanContext().traceId);
  assert.equal(
    headers.traceparent,
    `00-${producer.spanContext().traceId}-${producer.spanContext().spanId}-01`,
  );
  assert.equal(producer.attributes['messaging.system'], 'rabbitmq');
  assert.equal(producer.attributes['messaging.operation.type'], 'publish');
  assert.equal(producer.attributes['messaging.destination.name'], EXCHANGE);
  assert.equal(producer.attributes['messaging.rabbitmq.destination.routing_key'], ROUTING_KEY);
  assert.equal(producer.attributes.dependency_identity, 'grading-rabbitmq');
  assert.notEqual(producer.status.code, SpanStatusCode.ERROR);

  // --- 2. Duplicate: cùng event_id publish hai lần vẫn nhận diện được là một event logic ---
  await publisher.publish(input);
  await publisher.publish(input);
  const duplicates = await receive(2);
  assert.equal(duplicates.length, 2);
  const parsed = duplicates.map((message) =>
    gradeCompletedEventSchema.parse(JSON.parse(message.content.toString())),
  );
  assert.equal(new Set(parsed.map((item) => item.event_id)).size, 1);
  assert.equal(parsed[0].event_id, input.eventId);
  assert.deepEqual(parsed[0].payload, parsed[1].payload);
  assert.equal(parsed[0].occurred_at, parsed[1].occurred_at);
  assert.notEqual(parsed[0].correlation.traceparent, parsed[1].correlation.traceparent);

  // --- 3. Broker không tới được: lỗi phân loại, nhanh, không treo ---
  const closed = createServer();
  const closedPort = await listen(closed);
  await new Promise((resolve) => closed.close(resolve));
  const unreachable = new RabbitMqGradeCompletedPublisher(
    configFor(`amqp://user:secret-password@127.0.0.1:${closedPort}`),
  );
  publishers.push(unreachable);
  const unavailable = await unreachable.publish(snapshot()).catch((error) => error);
  assert.ok(unavailable instanceof GradeEventPublishError);
  assert.equal(unavailable.code, 'BROKER_UNAVAILABLE');
  assert.doesNotMatch(unavailable.message, /secret-password/u);

  // --- 4. Broker nhận kết nối nhưng không phản hồi: timeout đúng ngưỡng ---
  const sockets = new Set();
  const blackhole = createServer((socket) => {
    sockets.add(socket);
    socket.on('error', () => undefined);
  });
  const blackholePort = await listen(blackhole);
  const silent = new RabbitMqGradeCompletedPublisher(
    configFor(`amqp://127.0.0.1:${blackholePort}`),
  );
  publishers.push(silent);
  const startedAt = performance.now();
  const timedOut = await silent.publish(snapshot()).catch((error) => error);
  const elapsed = performance.now() - startedAt;
  assert.ok(timedOut instanceof GradeEventPublishError);
  assert.equal(timedOut.code, 'PUBLISH_TIMEOUT');
  assert.ok(
    elapsed >= CONFIRM_TIMEOUT_MS - 50 && elapsed < CONFIRM_TIMEOUT_MS + 1_500,
    `elapsed=${elapsed}`,
  );
  for (const socket of sockets) socket.destroy();
  await new Promise((resolve) => blackhole.close(resolve));

  await telemetry.forceFlush();
  const errorSpans = spanExporter
    .getFinishedSpans()
    .filter((span) => span.kind === SpanKind.PRODUCER && span.status.code === SpanStatusCode.ERROR);
  assert.deepEqual(errorSpans.map((span) => span.attributes['error.type']).sort(), [
    'timeout',
    'unavailable',
  ]);
  for (const span of errorSpans)
    assert.equal(span.attributes.dependency_identity, 'grading-rabbitmq');

  // --- 5. Request flow + worker + phục hồi với PostgreSQL thật và broker dừng/bật lại ---
  proxy = createBrokerProxy(brokerUrl);
  await proxy.start();
  const flaky = new RabbitMqGradeCompletedPublisher(configFor(proxy.url()));
  publishers.push(flaky);
  const coordinator = new GradePublicationCoordinator(repository, flaky);
  const submissions = new Map();
  const submissionClient = {
    getById: async (id) => submissions.get(id) ?? null,
  };
  const service = new GradingService(repository, submissionClient, coordinator);
  const worker = new PendingGradeEventWorker(repository, coordinator, configFor(proxy.url()));
  const instructor = { id: 'instructor-001', role: 'instructor' };
  const newSubmission = (id) =>
    submissions.set(id, { course_id: 'course-001', id, principal_id: 'student-001' });
  const stateOf = async (gradeId) =>
    (
      await databasePool.query(
        'SELECT event_id, publish_status, publish_attempts, last_publish_error_code, published_at FROM grades WHERE id = $1',
        [gradeId],
      )
    ).rows[0];
  const countGrades = async () =>
    (await databasePool.query('SELECT count(*)::int AS total FROM grades')).rows[0].total;

  // 5a. Broker sống: grade được tạo, event published ngay.
  const okSubmission = `submission-${randomUUID()}`;
  newSubmission(okSubmission);
  const okGrade = await service.create(instructor, okSubmission, 88);
  const okState = await stateOf(okGrade.id);
  assert.equal(okState.publish_status, 'published');
  assert.equal(okState.publish_attempts, 1);
  assert.ok(okState.published_at);
  const [okMessage] = await receive(1);
  assert.equal(JSON.parse(okMessage.content.toString()).event_id, okState.event_id);
  assert.equal(JSON.parse(okMessage.content.toString()).payload.grade_id, okGrade.id);

  // 5b. Broker dừng: grade vẫn được lưu, request nhận GradeEventPendingError, event giữ pending.
  await proxy.stop();
  const downSubmission = `submission-${randomUUID()}`;
  newSubmission(downSubmission);
  const gradesBefore = await countGrades();
  const pendingFailure = await service
    .create(instructor, downSubmission, 77)
    .catch((error) => error);
  assert.ok(pendingFailure instanceof GradeEventPendingError);
  assert.equal(await countGrades(), gradesBefore + 1);
  const pendingState = await stateOf(pendingFailure.gradeId);
  assert.equal(pendingState.publish_status, 'pending');
  assert.equal(pendingState.publish_attempts, 1);
  assert.match(pendingState.last_publish_error_code, /^(BROKER_UNAVAILABLE|PUBLISH_TIMEOUT)$/u);
  assert.equal(pendingState.event_id, pendingFailure.eventId);
  // POST lại cùng Submission vẫn là conflict, không tạo grade/event mới.
  await assert.rejects(service.create(instructor, downSubmission, 77), GradeConflictError);
  assert.equal(await countGrades(), gradesBefore + 1);
  // Worker khi broker còn chết: thử lại, vẫn pending, cùng event_id.
  await worker.runCycle();
  const stillPending = await stateOf(pendingFailure.gradeId);
  assert.equal(stillPending.publish_status, 'pending');
  assert.equal(stillPending.publish_attempts, 2);
  assert.equal(stillPending.event_id, pendingFailure.eventId);
  await telemetry.forceFlush();
  assert.equal(pendingGauge(), 1);
  await assertQueueEmpty();

  // 5c. Broker bật lại: worker publish bằng cùng event_id, row chuyển published.
  await proxy.start();
  await worker.runCycle();
  const recovered = await stateOf(pendingFailure.gradeId);
  assert.equal(recovered.publish_status, 'published');
  assert.equal(recovered.publish_attempts, 3);
  assert.equal(recovered.last_publish_error_code, null);
  assert.ok(recovered.published_at);
  assert.equal(recovered.event_id, pendingFailure.eventId);
  const [recoveredMessage] = await receive(1);
  const recoveredEvent = gradeCompletedEventSchema.parse(
    JSON.parse(recoveredMessage.content.toString()),
  );
  assert.equal(recoveredEvent.event_id, pendingFailure.eventId);
  assert.equal(recoveredEvent.payload.grade_id, pendingFailure.gradeId);
  assert.equal(await countGrades(), gradesBefore + 1);
  await telemetry.forceFlush();
  assert.equal(pendingGauge(), 0);
  await worker.runCycle();
  await assertQueueEmpty();

  // 5d. Mạng treo sau khi đã có session: confirm không bao giờ về -> PUBLISH_TIMEOUT đúng ngưỡng,
  // event giữ pending, socket treo bị hủy (không rò) và lần sau tạo session mới publish được.
  const hungSubmission = `submission-${randomUUID()}`;
  newSubmission(hungSubmission);
  proxy.freeze();
  const hungStartedAt = performance.now();
  const hungFailure = await service.create(instructor, hungSubmission, 66).catch((error) => error);
  const hungElapsed = performance.now() - hungStartedAt;
  assert.ok(hungFailure instanceof GradeEventPendingError);
  assert.equal(hungFailure.reason, 'PUBLISH_TIMEOUT');
  assert.ok(
    hungElapsed >= CONFIRM_TIMEOUT_MS - 50 && hungElapsed < CONFIRM_TIMEOUT_MS + 1_500,
    `hungElapsed=${hungElapsed}`,
  );
  assert.equal((await stateOf(hungFailure.gradeId)).publish_status, 'pending');
  const settleDeadline = Date.now() + 4_000;
  while (proxy.openSockets > 0 && Date.now() < settleDeadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(proxy.openSockets, 0, 'connection treo phải bị hủy, không được rò socket');
  proxy.thaw();
  await worker.runCycle();
  assert.equal((await stateOf(hungFailure.gradeId)).publish_status, 'published');
  const [hungMessage] = await receive(1);
  assert.equal(JSON.parse(hungMessage.content.toString()).event_id, hungFailure.eventId);

  const metrics = JSON.stringify(metricExporter.getMetrics());
  for (const name of [
    'grading.messaging.publish.count',
    'grading.messaging.publish.error.count',
    'grading.messaging.publish.duration',
    'grading.messaging.pending.count',
  ]) {
    assert.match(metrics, new RegExp(name.replaceAll('.', '\\.'), 'u'));
  }
  assert.match(metrics, /grading-rabbitmq/u);
  assert.doesNotMatch(
    metrics,
    new RegExp(
      `${input.eventId}|${okState.event_id}|student-001|lms-local-only|secret-password|traceparent`,
      'u',
    ),
  );
  const spanDump = JSON.stringify(
    spanExporter
      .getFinishedSpans()
      .map((span) => ({ attributes: span.attributes, events: span.events })),
  );
  assert.doesNotMatch(spanDump, /lms-local-only|secret-password|student-001|amqp:\/\//u);

  await proxy.stop();
  proxy = undefined;
  console.log('Grading RabbitMQ publisher, retry và telemetry integration đạt.');
} finally {
  await proxy?.stop().catch(() => undefined);
  for (const publisher of publishers) await publisher.onApplicationShutdown();
  await repository.onApplicationShutdown();
  await databasePool.end();
  await adminChannel.close().catch(() => undefined);
  await admin.close().catch(() => undefined);
  await telemetry.shutdown();
}

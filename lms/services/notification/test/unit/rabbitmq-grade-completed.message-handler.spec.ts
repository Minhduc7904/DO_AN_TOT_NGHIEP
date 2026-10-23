import { jest } from '@jest/globals';
import { createGradeCompletedRabbitMqHeaders, gradeCompletedV1Fixture } from '@aiops-lms/contracts';
import { startTelemetry } from '@aiops-lms/observability';
import {
  InMemoryMetricExporter,
  InMemorySpanExporter,
  PeriodicExportingMetricReader,
  SimpleSpanProcessor,
  SpanStatusCode,
} from '@aiops-lms/observability/testing';

import { GradeCompletedFixtureConsumer } from '../../src/adapters/messaging/grade-completed.fixture-consumer.js';
import { NotificationConsumerFault } from '../../src/adapters/messaging/notification-consumer-fault.js';
import { NotificationMessagingTelemetry } from '../../src/adapters/messaging/notification-messaging-telemetry.js';
import {
  InvalidGradeCompletedMessageError,
  RabbitMqGradeCompletedMessageHandler,
} from '../../src/adapters/messaging/rabbitmq-grade-completed.message-handler.js';

const TEST_BINDING = {
  queue: 'notification.grade-completed.custom-test',
};

function createFault(enabled = false, processingDelayMs = 0): NotificationConsumerFault {
  const values = {
    NOTIFICATION_CONSUMER_SLOWDOWN_ENABLED: enabled,
    NOTIFICATION_CONSUMER_SLOWDOWN_MS: processingDelayMs,
  };
  return new NotificationConsumerFault({
    getOrThrow: <Key extends keyof typeof values>(key: Key): (typeof values)[Key] => values[key],
  } as never);
}

describe('RabbitMqGradeCompletedMessageHandler', () => {
  const spanExporter = new InMemorySpanExporter();
  const metricExporter = new InMemoryMetricExporter();
  const telemetry = startTelemetry(
    {
      enabled: true,
      otlpTracesEndpoint: 'http://127.0.0.1:4318/v1/traces',
      serviceInstanceId: 'notification-handler-test-1',
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

  afterAll(async () => {
    await telemetry.shutdown();
  }, 20_000);

  it('extracts RabbitMQ W3C headers and records one simulated notification', async () => {
    const fault = createFault();
    const beforeProcess = jest.spyOn(fault, 'beforeProcess');
    const handler = new RabbitMqGradeCompletedMessageHandler(
      new GradeCompletedFixtureConsumer(),
      fault,
      new NotificationMessagingTelemetry(TEST_BINDING),
    );
    const log = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await expect(
      handler.handle(
        Buffer.from(JSON.stringify(gradeCompletedV1Fixture)),
        createGradeCompletedRabbitMqHeaders(gradeCompletedV1Fixture),
      ),
    ).resolves.toMatchObject({ status: 'accepted' });

    await telemetry.forceFlush();
    const consumeSpan = spanExporter
      .getFinishedSpans()
      .find((span) => span.name === 'rabbitmq consume grade.completed');
    const processSpan = spanExporter
      .getFinishedSpans()
      .find((span) => span.name === 'notification process grade.completed');

    expect(beforeProcess).toHaveBeenCalledTimes(1);
    expect(consumeSpan?.spanContext().traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    expect(consumeSpan?.attributes.dependency_identity).toBe('notification-rabbitmq');
    expect(consumeSpan?.attributes['messaging.destination.name']).toBe(TEST_BINDING.queue);
    expect(processSpan?.attributes['messaging.message.id']).toBe(gradeCompletedV1Fixture.event_id);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(`"event_id":"${gradeCompletedV1Fixture.event_id}"`),
    );
  });

  it('applies the enabled consumer slowdown before processing', async () => {
    const handler = new RabbitMqGradeCompletedMessageHandler(
      new GradeCompletedFixtureConsumer(),
      createFault(true, 15),
      new NotificationMessagingTelemetry(TEST_BINDING),
    );
    const startedAt = performance.now();

    await handler.handle(
      Buffer.from(JSON.stringify(gradeCompletedV1Fixture)),
      createGradeCompletedRabbitMqHeaders(gradeCompletedV1Fixture),
    );

    expect(performance.now() - startedAt).toBeGreaterThanOrEqual(10);
  });

  it('does not create a second simulated notification for a duplicate delivery', async () => {
    const handler = new RabbitMqGradeCompletedMessageHandler(
      new GradeCompletedFixtureConsumer(),
      createFault(),
      new NotificationMessagingTelemetry(TEST_BINDING),
    );
    const headers = createGradeCompletedRabbitMqHeaders(gradeCompletedV1Fixture);
    const content = Buffer.from(JSON.stringify(gradeCompletedV1Fixture));

    await expect(handler.handle(content, headers)).resolves.toMatchObject({ status: 'accepted' });
    await expect(handler.handle(content, headers)).resolves.toMatchObject({ status: 'duplicate' });
  });

  it('rejects a message when transport trace headers diverge from its envelope', async () => {
    const handler = new RabbitMqGradeCompletedMessageHandler(
      new GradeCompletedFixtureConsumer(),
      createFault(),
      new NotificationMessagingTelemetry(TEST_BINDING),
    );
    const headers = createGradeCompletedRabbitMqHeaders(gradeCompletedV1Fixture);

    await expect(
      handler.handle(Buffer.from(JSON.stringify(gradeCompletedV1Fixture)), {
        ...headers,
        traceparent: '00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01',
      }),
    ).rejects.toBeInstanceOf(InvalidGradeCompletedMessageError);
  });

  it.each([
    {
      content: Buffer.from('{"credential":"top-secret-password"'),
      expectedErrorType: 'InvalidGradeCompletedMessageError',
      headers: createGradeCompletedRabbitMqHeaders(gradeCompletedV1Fixture),
      name: 'malformed JSON',
    },
    {
      content: Buffer.from(
        JSON.stringify({
          ...gradeCompletedV1Fixture,
          event_name: 'grade.invalid',
          principal_id: 'sensitive.student@example.com',
        }),
      ),
      expectedErrorType: 'ZodError',
      headers: createGradeCompletedRabbitMqHeaders(gradeCompletedV1Fixture),
      name: 'schema mismatch',
    },
    {
      content: Buffer.from(JSON.stringify(gradeCompletedV1Fixture)),
      expectedErrorType: 'InvalidGradeCompletedMessageError',
      headers: {
        ...createGradeCompletedRabbitMqHeaders(gradeCompletedV1Fixture),
        traceparent: '00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01',
      },
      name: 'header mismatch',
    },
  ])('observes and sanitizes the $name consume failure', async (scenario) => {
    const handler = new RabbitMqGradeCompletedMessageHandler(
      new GradeCompletedFixtureConsumer(),
      createFault(),
      new NotificationMessagingTelemetry(TEST_BINDING),
    );
    const spanStart = spanExporter.getFinishedSpans().length;
    const errorLog = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await expect(handler.handle(scenario.content, scenario.headers)).rejects.toThrow();
    await telemetry.forceFlush();

    const newSpans = spanExporter.getFinishedSpans().slice(spanStart);
    const consumeSpan = newSpans.find((span) => span.name === 'rabbitmq consume grade.completed');
    expect(consumeSpan?.status.code).toBe(SpanStatusCode.ERROR);
    expect(consumeSpan?.attributes['error.type']).toBe(scenario.expectedErrorType);
    expect(consumeSpan?.attributes['messaging.destination.name']).toBe(TEST_BINDING.queue);
    expect(newSpans.some((span) => span.name === 'notification process grade.completed')).toBe(
      false,
    );
    expect(JSON.stringify(newSpans.map((span) => [span.attributes, span.events]))).not.toMatch(
      /top-secret-password|sensitive\.student@example\.com|amqp:\/\//u,
    );

    const correlatedLog = errorLog.mock.calls
      .map(([value]) => String(value))
      .find((value) => value.includes('"operation_name":"consume"'));
    expect(correlatedLog).toContain(`"error_type":"${scenario.expectedErrorType}"`);
    expect(correlatedLog).toContain(`"trace_id":"${consumeSpan?.spanContext().traceId}"`);
    expect(correlatedLog).not.toMatch(
      /top-secret-password|sensitive\.student@example\.com|amqp:\/\//u,
    );

    const metrics = JSON.stringify(metricExporter.getMetrics());
    expect(metrics).toContain('notification.rabbitmq.consume.error.count');
    expect(metrics).toContain('notification.rabbitmq.consume.duration');
    expect(metrics).toContain('rejected');
  });
});

import { jest } from '@jest/globals';
import { createGradeCompletedRabbitMqHeaders, gradeCompletedV1Fixture } from '@aiops-lms/contracts';
import { startTelemetry } from '@aiops-lms/observability';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@aiops-lms/observability/testing';

import { GradeCompletedFixtureConsumer } from '../../src/adapters/messaging/grade-completed.fixture-consumer.js';
import { NotificationConsumerFault } from '../../src/adapters/messaging/notification-consumer-fault.js';
import { NotificationMessagingTelemetry } from '../../src/adapters/messaging/notification-messaging-telemetry.js';
import {
  InvalidGradeCompletedMessageError,
  RabbitMqGradeCompletedMessageHandler,
} from '../../src/adapters/messaging/rabbitmq-grade-completed.message-handler.js';

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
  const telemetry = startTelemetry(
    {
      enabled: true,
      otlpTracesEndpoint: 'http://127.0.0.1:4318/v1/traces',
      serviceInstanceId: 'notification-handler-test-1',
      serviceName: 'notification',
      serviceVersion: '0.1.0-test',
    },
    { spanProcessor: new SimpleSpanProcessor(spanExporter) },
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
      new NotificationMessagingTelemetry(),
    );
    const log = jest.spyOn(console, 'info').mockImplementation();

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
    expect(processSpan?.attributes['messaging.message.id']).toBe(gradeCompletedV1Fixture.event_id);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(`"event_id":"${gradeCompletedV1Fixture.event_id}"`),
    );
  });

  it('applies the enabled consumer slowdown before processing', async () => {
    const handler = new RabbitMqGradeCompletedMessageHandler(
      new GradeCompletedFixtureConsumer(),
      createFault(true, 15),
      new NotificationMessagingTelemetry(),
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
      new NotificationMessagingTelemetry(),
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
      new NotificationMessagingTelemetry(),
    );
    const headers = createGradeCompletedRabbitMqHeaders(gradeCompletedV1Fixture);

    await expect(
      handler.handle(Buffer.from(JSON.stringify(gradeCompletedV1Fixture)), {
        ...headers,
        traceparent: '00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01',
      }),
    ).rejects.toBeInstanceOf(InvalidGradeCompletedMessageError);
  });
});

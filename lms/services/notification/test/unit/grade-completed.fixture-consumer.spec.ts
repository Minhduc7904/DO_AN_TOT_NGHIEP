import {
  createGradeCompletedRabbitMqHeaders,
  gradeCompletedEventSchema,
  gradeCompletedV1Fixture,
} from '@aiops-lms/contracts';

import { GradeCompletedFixtureConsumer } from '../../src/adapters/messaging/grade-completed.fixture-consumer.js';
import { createRabbitMqGradeCompletedBinding } from '../../src/adapters/messaging/rabbitmq-grade-completed.binding.js';

describe('Notification grade.completed skeleton', () => {
  it('accepts the published version 1 fixture without exposing payload fields', () => {
    const consumer = new GradeCompletedFixtureConsumer();

    expect(consumer.consume(gradeCompletedV1Fixture)).toEqual({
      event_id: gradeCompletedV1Fixture.event_id,
      event_name: 'grade.completed',
      schema_version: 1,
      status: 'accepted',
    });
  });

  it('rejects an event with an incompatible name or missing correlation', () => {
    const consumer = new GradeCompletedFixtureConsumer();
    const incompatibleName = { ...gradeCompletedV1Fixture, event_name: 'grade-completed' };
    const missingCorrelation = { ...gradeCompletedV1Fixture, correlation: undefined };

    expect(() => consumer.consume(incompatibleName)).toThrow();
    expect(() => consumer.consume(missingCorrelation)).toThrow();
  });

  it('keeps envelope correlation aligned with RabbitMQ transport headers', () => {
    expect(createGradeCompletedRabbitMqHeaders(gradeCompletedV1Fixture)).toEqual({
      traceparent: gradeCompletedV1Fixture.correlation.traceparent,
      tracestate: gradeCompletedV1Fixture.correlation.tracestate,
    });
    expect(() =>
      gradeCompletedEventSchema.parse({
        ...gradeCompletedV1Fixture,
        schema_version: '1',
      }),
    ).toThrow();
  });

  it('reads the canonical RabbitMQ binding from validated configuration', () => {
    const values = {
      NOTIFICATION_GRADE_COMPLETED_EXCHANGE: 'lms.events',
      NOTIFICATION_GRADE_COMPLETED_QUEUE: 'notification.grade-completed.v1',
      NOTIFICATION_RABBITMQ_URL: 'amqp://rabbitmq:5672',
    };
    const binding = createRabbitMqGradeCompletedBinding({
      getOrThrow: <Key extends keyof typeof values>(key: Key): (typeof values)[Key] => values[key],
    });

    expect(binding).toEqual({
      exchange: 'lms.events',
      queue: 'notification.grade-completed.v1',
      routing_key: 'grade.completed',
      url: 'amqp://rabbitmq:5672',
    });
  });
});

import {
  createGradeCompletedRabbitMqHeaders,
  gradeCompletedEventSchema,
  gradeCompletedV1Fixture,
} from '@aiops-lms/contracts';
import { jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';

import { validateEnvironment } from '../../src/config/env.schema.js';
import { GradeCompletedFixtureConsumer } from '../../src/adapters/messaging/grade-completed.fixture-consumer.js';
import { createRabbitMqGradeCompletedBinding } from '../../src/adapters/messaging/rabbitmq-grade-completed.binding.js';
import { AppModule } from '../../src/app.module.js';

describe('Notification grade.completed skeleton', () => {
  it('uses the local Compose RabbitMQ URL by default', () => {
    const environment = validateEnvironment({});

    expect(environment.NOTIFICATION_RABBITMQ_URL).toBe('amqp://lms:lms-local-only@localhost:5672');
    expect(environment.NOTIFICATION_RECONNECT_DELAY_MS).toBe(1_000);
    expect(environment.NOTIFICATION_DEDUP_TTL_SECONDS).toBe(86_400);
    expect(environment.NOTIFICATION_DEDUP_MAX_EVENT_IDS).toBe(10_000);
    expect(() => validateEnvironment({ NOTIFICATION_RECONNECT_DELAY_MS: 99 })).toThrow();
    expect(() => validateEnvironment({ NOTIFICATION_DEDUP_MAX_EVENT_IDS: 100_001 })).toThrow();
  });

  it('accepts the published version 1 fixture without exposing payload fields', () => {
    const consumer = new GradeCompletedFixtureConsumer();

    expect(consumer.consume(gradeCompletedV1Fixture)).toEqual({
      event_id: gradeCompletedV1Fixture.event_id,
      event_name: 'grade.completed',
      schema_version: 1,
      status: 'accepted',
    });
  });

  it('records only one simulated notification for a duplicate event ID', () => {
    const consumer = new GradeCompletedFixtureConsumer();

    expect(consumer.consume(gradeCompletedV1Fixture).status).toBe('accepted');
    expect(consumer.consume(gradeCompletedV1Fixture)).toEqual({
      event_id: gradeCompletedV1Fixture.event_id,
      event_name: 'grade.completed',
      schema_version: 1,
      status: 'duplicate',
    });
  });

  it('wires custom dedup TTL and capacity through the Nest ConfigService provider', async () => {
    let moduleReference: TestingModule | undefined;
    try {
      jest.useFakeTimers().setSystemTime(new Date('2026-10-13T00:00:00.000Z'));
      const values = {
        NOTIFICATION_CONSUMER_PREFETCH: 1,
        NOTIFICATION_CONSUMER_SLOWDOWN_ENABLED: false,
        NOTIFICATION_CONSUMER_SLOWDOWN_MS: 0,
        NOTIFICATION_DEDUP_MAX_EVENT_IDS: 1,
        NOTIFICATION_DEDUP_TTL_SECONDS: 2,
        NOTIFICATION_GRADE_COMPLETED_EXCHANGE: 'lms.events',
        NOTIFICATION_GRADE_COMPLETED_QUEUE: 'notification.grade-completed.di-test',
        NOTIFICATION_RABBITMQ_URL: 'amqp://rabbitmq.test:5672',
        NOTIFICATION_RECONNECT_DELAY_MS: 100,
      };
      const config = {
        get: <Key extends keyof typeof values>(key: Key): (typeof values)[Key] => values[key],
        getOrThrow: <Key extends keyof typeof values>(key: Key): (typeof values)[Key] => {
          const value = values[key];
          if (value === undefined) throw new Error(`Missing test config: ${key}`);
          return value;
        },
      };
      moduleReference = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(ConfigService)
        .useValue(config)
        .compile();
      const consumer = moduleReference.get(GradeCompletedFixtureConsumer);
      const second = {
        ...gradeCompletedV1Fixture,
        event_id: '018f4e60-4e21-7d38-b1f4-842d4f2e9999',
      };

      expect(consumer.consume(gradeCompletedV1Fixture).status).toBe('accepted');
      expect(consumer.consume(second).status).toBe('accepted');
      expect(consumer.consume(gradeCompletedV1Fixture).status).toBe('accepted');
      jest.advanceTimersByTime(2_001);
      expect(consumer.consume(gradeCompletedV1Fixture).status).toBe('accepted');
      expect(Reflect.getMetadata('design:paramtypes', GradeCompletedFixtureConsumer)).toEqual([
        ConfigService,
      ]);
    } finally {
      jest.useRealTimers();
      await moduleReference?.close();
    }
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
      NOTIFICATION_CONSUMER_PREFETCH: 1,
      NOTIFICATION_RECONNECT_DELAY_MS: 1_000,
      NOTIFICATION_RABBITMQ_URL: 'amqp://rabbitmq:5672',
    };
    const binding = createRabbitMqGradeCompletedBinding({
      getOrThrow: <Key extends keyof typeof values>(key: Key): (typeof values)[Key] => values[key],
    });

    expect(binding).toEqual({
      exchange: 'lms.events',
      prefetch: 1,
      queue: 'notification.grade-completed.v1',
      reconnect_delay_ms: 1_000,
      routing_key: 'grade.completed',
      url: 'amqp://rabbitmq:5672',
    });
  });
});

import { jest } from '@jest/globals';
import { createGradeCompletedRabbitMqHeaders, gradeCompletedV1Fixture } from '@aiops-lms/contracts';
import { EventEmitter } from 'node:events';

import type {
  RabbitMqChannel,
  RabbitMqConnection,
  RabbitMqConsumeMessage,
} from '../../src/adapters/messaging/rabbitmq-client.js';
import type { RabbitMqGradeCompletedBinding } from '../../src/adapters/messaging/rabbitmq-grade-completed.binding.js';
import { RabbitMqGradeCompletedConsumer } from '../../src/adapters/messaging/rabbitmq-grade-completed.consumer.js';
import {
  InvalidGradeCompletedMessageError,
  type RabbitMqGradeCompletedMessageHandler,
} from '../../src/adapters/messaging/rabbitmq-grade-completed.message-handler.js';
import type { NotificationMessagingTelemetry } from '../../src/adapters/messaging/notification-messaging-telemetry.js';

async function flushAsyncConsumer(): Promise<void> {
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
}

describe('RabbitMqGradeCompletedConsumer', () => {
  const binding: RabbitMqGradeCompletedBinding = {
    exchange: 'lms.events',
    prefetch: 1,
    queue: 'notification.grade-completed.v1',
    reconnect_delay_ms: 5,
    routing_key: 'grade.completed',
    url: 'amqp://rabbitmq.test:5672',
  };

  it('declares the v1 binding, acknowledges success and nacks a failed message', async () => {
    let onMessage: ((message: RabbitMqConsumeMessage | null) => void) | undefined;
    const channel = Object.assign(new EventEmitter(), {
      ack: jest.fn(),
      assertExchange: jest.fn().mockResolvedValue(undefined),
      assertQueue: jest.fn().mockResolvedValue(undefined),
      bindQueue: jest.fn().mockResolvedValue(undefined),
      cancel: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      consume: jest
        .fn()
        .mockImplementation(
          async (_queue: string, callback: (message: RabbitMqConsumeMessage | null) => void) => {
            onMessage = callback;
            return { consumerTag: 'notification-test-consumer' };
          },
        ),
      nack: jest.fn(),
      prefetch: jest.fn().mockResolvedValue(undefined),
    }) as unknown as RabbitMqChannel;
    const connection = Object.assign(new EventEmitter(), {
      close: jest.fn().mockResolvedValue(undefined),
      createChannel: jest.fn().mockResolvedValue(channel),
    }) as unknown as RabbitMqConnection;
    const handler = {
      handle: jest.fn().mockResolvedValue({ status: 'accepted' }),
    } as unknown as RabbitMqGradeCompletedMessageHandler;
    const telemetry = { recordUnavailable: jest.fn() } as unknown as NotificationMessagingTelemetry;
    const consumer = new RabbitMqGradeCompletedConsumer(
      binding,
      handler,
      async () => connection,
      telemetry,
    );
    const message = {
      content: Buffer.from(JSON.stringify(gradeCompletedV1Fixture)),
      properties: { headers: createGradeCompletedRabbitMqHeaders(gradeCompletedV1Fixture) },
    } as RabbitMqConsumeMessage;

    consumer.onModuleInit();
    await consumer.waitUntilConnected();

    expect(channel.assertExchange).toHaveBeenCalledWith('lms.events', 'topic', { durable: true });
    expect(channel.assertQueue).toHaveBeenCalledWith('notification.grade-completed.v1', {
      durable: true,
    });
    expect(channel.bindQueue).toHaveBeenCalledWith(
      'notification.grade-completed.v1',
      'lms.events',
      'grade.completed',
    );
    expect(channel.prefetch).toHaveBeenCalledWith(1);

    onMessage?.(message);
    await flushAsyncConsumer();
    expect(channel.ack).toHaveBeenCalledWith(message);

    jest
      .mocked(handler.handle)
      .mockRejectedValueOnce(new InvalidGradeCompletedMessageError('invalid message'));
    const error = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    onMessage?.(message);
    await flushAsyncConsumer();
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);

    jest.mocked(handler.handle).mockRejectedValueOnce(new Error('temporary failure'));
    onMessage?.(message);
    await flushAsyncConsumer();
    expect(channel.nack).toHaveBeenCalledWith(message, false, true);
    error.mockRestore();

    await consumer.onModuleDestroy();
    expect(channel.cancel).toHaveBeenCalledWith('notification-test-consumer');
    expect(channel.close).toHaveBeenCalledTimes(1);
    expect(connection.close).toHaveBeenCalledTimes(1);
  });

  it('does not fail startup, keeps one reconnect loop and reconnects after channel closure', async () => {
    const callbacks: Array<(message: RabbitMqConsumeMessage | null) => void> = [];
    const createSession = (): {
      channel: RabbitMqChannel;
      connection: RabbitMqConnection;
    } => {
      const channel = Object.assign(new EventEmitter(), {
        ack: jest.fn(),
        assertExchange: jest.fn().mockResolvedValue(undefined),
        assertQueue: jest.fn().mockResolvedValue(undefined),
        bindQueue: jest.fn().mockResolvedValue(undefined),
        cancel: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
        consume: jest.fn().mockImplementation(async (_queue, callback) => {
          callbacks.push(callback);
          return { consumerTag: `consumer-${callbacks.length}` };
        }),
        nack: jest.fn(),
        prefetch: jest.fn().mockResolvedValue(undefined),
      }) as unknown as RabbitMqChannel;
      const connection = Object.assign(new EventEmitter(), {
        close: jest.fn().mockResolvedValue(undefined),
        createChannel: jest.fn().mockResolvedValue(channel),
      }) as unknown as RabbitMqConnection;
      return { channel, connection };
    };
    const first = createSession();
    const second = createSession();
    const connect = jest
      .fn<() => Promise<RabbitMqConnection>>()
      .mockRejectedValueOnce(new Error('broker unavailable'))
      .mockResolvedValueOnce(first.connection)
      .mockResolvedValueOnce(second.connection);
    const telemetry = { recordUnavailable: jest.fn() } as unknown as NotificationMessagingTelemetry;
    const handler = { handle: jest.fn() } as unknown as RabbitMqGradeCompletedMessageHandler;
    const consumer = new RabbitMqGradeCompletedConsumer(binding, handler, connect, telemetry);

    consumer.onModuleInit();
    await consumer.waitUntilConnected();
    expect(connect).toHaveBeenCalledTimes(2);
    expect(telemetry.recordUnavailable).toHaveBeenCalledTimes(1);

    (first.channel as unknown as EventEmitter).emit('close');
    await consumer.waitUntilConnected();
    expect(connect).toHaveBeenCalledTimes(3);

    await consumer.onModuleDestroy();
    const attemptsAfterShutdown = connect.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(connect).toHaveBeenCalledTimes(attemptsAfterShutdown);
  });
});

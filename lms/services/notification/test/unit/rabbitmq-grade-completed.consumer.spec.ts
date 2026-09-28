import { jest } from '@jest/globals';
import { createGradeCompletedRabbitMqHeaders, gradeCompletedV1Fixture } from '@aiops-lms/contracts';

import type {
  RabbitMqChannel,
  RabbitMqConnection,
  RabbitMqConsumeMessage,
} from '../../src/adapters/messaging/rabbitmq-client.js';
import type { RabbitMqGradeCompletedBinding } from '../../src/adapters/messaging/rabbitmq-grade-completed.binding.js';
import { RabbitMqGradeCompletedConsumer } from '../../src/adapters/messaging/rabbitmq-grade-completed.consumer.js';
import type { RabbitMqGradeCompletedMessageHandler } from '../../src/adapters/messaging/rabbitmq-grade-completed.message-handler.js';

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
    routing_key: 'grade.completed',
    url: 'amqp://rabbitmq.test:5672',
  };

  it('declares the v1 binding, acknowledges success and nacks a failed message', async () => {
    let onMessage: ((message: RabbitMqConsumeMessage | null) => void) | undefined;
    const channel = {
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
    } as unknown as RabbitMqChannel;
    const connection = {
      close: jest.fn().mockResolvedValue(undefined),
      createChannel: jest.fn().mockResolvedValue(channel),
    } as unknown as RabbitMqConnection;
    const handler = {
      handle: jest.fn().mockResolvedValue({ status: 'accepted' }),
    } as unknown as RabbitMqGradeCompletedMessageHandler;
    const consumer = new RabbitMqGradeCompletedConsumer(binding, handler, async () => connection);
    const message = {
      content: Buffer.from(JSON.stringify(gradeCompletedV1Fixture)),
      properties: { headers: createGradeCompletedRabbitMqHeaders(gradeCompletedV1Fixture) },
    } as RabbitMqConsumeMessage;

    await consumer.onModuleInit();

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

    jest.mocked(handler.handle).mockRejectedValueOnce(new Error('invalid message'));
    const error = jest.spyOn(console, 'error').mockImplementation();
    onMessage?.(message);
    await flushAsyncConsumer();
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
    error.mockRestore();

    await consumer.onModuleDestroy();
    expect(channel.cancel).toHaveBeenCalledWith('notification-test-consumer');
    expect(channel.close).toHaveBeenCalledTimes(1);
    expect(connection.close).toHaveBeenCalledTimes(1);
  });
});

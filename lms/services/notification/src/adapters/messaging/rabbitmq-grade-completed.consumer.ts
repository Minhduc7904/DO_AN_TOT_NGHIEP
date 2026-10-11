import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';

import {
  RABBITMQ_CONNECT,
  type RabbitMqChannel,
  type RabbitMqConnect,
  type RabbitMqConnection,
  type RabbitMqConsumeMessage,
} from './rabbitmq-client.js';
import {
  RABBITMQ_GRADE_COMPLETED_BINDING,
  type RabbitMqGradeCompletedBinding,
} from './rabbitmq-grade-completed.binding.js';
import { RabbitMqGradeCompletedMessageHandler } from './rabbitmq-grade-completed.message-handler.js';

@Injectable()
export class RabbitMqGradeCompletedConsumer implements OnModuleInit, OnModuleDestroy {
  private channel: RabbitMqChannel | undefined;
  private connection: RabbitMqConnection | undefined;
  private consumerTag: string | undefined;

  constructor(
    @Inject(RABBITMQ_GRADE_COMPLETED_BINDING)
    private readonly binding: RabbitMqGradeCompletedBinding,
    private readonly handler: RabbitMqGradeCompletedMessageHandler,
    @Inject(RABBITMQ_CONNECT) private readonly connect: RabbitMqConnect,
  ) {}

  async onModuleInit(): Promise<void> {
    const connection = await this.connect(this.binding.url);

    try {
      const channel = await connection.createChannel();
      await channel.assertExchange(this.binding.exchange, 'topic', { durable: true });
      await channel.assertQueue(this.binding.queue, { durable: true });
      await channel.bindQueue(this.binding.queue, this.binding.exchange, this.binding.routing_key);
      await channel.prefetch(this.binding.prefetch);
      const registration = await channel.consume(
        this.binding.queue,
        (message) => {
          if (message) {
            void this.consume(message);
          }
        },
        { noAck: false },
      );

      this.connection = connection;
      this.channel = channel;
      this.consumerTag = registration.consumerTag;
    } catch (error) {
      await connection.close();
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    const channel = this.channel;
    const connection = this.connection;
    this.channel = undefined;
    this.connection = undefined;
    const consumerTag = this.consumerTag;
    this.consumerTag = undefined;

    if (channel && consumerTag) {
      await channel.cancel(consumerTag);
    }
    if (channel) {
      await channel.close();
    }
    if (connection) {
      await connection.close();
    }
  }

  private async consume(message: RabbitMqConsumeMessage): Promise<void> {
    const channel = this.channel;
    if (!channel) {
      return;
    }

    try {
      await this.handler.handle(message.content, message.properties.headers);
      channel.ack(message);
    } catch (error) {
      console.error(
        JSON.stringify({
          error_type: error instanceof Error ? error.name : 'processing_error',
          event: 'grade.completed',
          level: 'error',
          service_name: 'notification',
        }),
      );
      channel.nack(message, false, false);
    }
  }
}

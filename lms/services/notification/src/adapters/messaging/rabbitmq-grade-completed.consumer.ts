import { emitStructuredLog } from '@aiops-lms/observability';
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
import {
  InvalidGradeCompletedMessageError,
  RabbitMqGradeCompletedMessageHandler,
} from './rabbitmq-grade-completed.message-handler.js';
import { NotificationMessagingTelemetry } from './notification-messaging-telemetry.js';

@Injectable()
export class RabbitMqGradeCompletedConsumer implements OnModuleInit, OnModuleDestroy {
  private channel: RabbitMqChannel | undefined;
  private connection: RabbitMqConnection | undefined;
  private consumerTag: string | undefined;
  private reconnectLoop: Promise<void> | undefined;
  private releaseReconnectDelay: (() => void) | undefined;
  private stopping = false;

  constructor(
    @Inject(RABBITMQ_GRADE_COMPLETED_BINDING)
    private readonly binding: RabbitMqGradeCompletedBinding,
    private readonly handler: RabbitMqGradeCompletedMessageHandler,
    @Inject(RABBITMQ_CONNECT) private readonly connect: RabbitMqConnect,
    private readonly telemetry: NotificationMessagingTelemetry,
  ) {}

  onModuleInit(): void {
    this.stopping = false;
    this.startReconnectLoop();
  }

  async waitUntilConnected(timeoutMs = 10_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!this.channel && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    if (!this.channel) throw new Error('Quá hạn khi chờ Notification kết nối RabbitMQ');
  }

  private startReconnectLoop(): void {
    if (this.stopping || this.channel || this.reconnectLoop) return;
    this.reconnectLoop = this.runReconnectLoop().finally(() => {
      this.reconnectLoop = undefined;
      if (!this.stopping && !this.channel) this.startReconnectLoop();
    });
  }

  private async runReconnectLoop(): Promise<void> {
    while (!this.stopping && !this.channel) {
      try {
        await this.openSession();
        return;
      } catch (error) {
        this.telemetry.recordUnavailable(error);
        await this.waitBeforeReconnect();
      }
    }
  }

  private async openSession(): Promise<void> {
    const connection = await this.connect(this.binding.url);
    let channel: RabbitMqChannel | undefined;

    try {
      const createdChannel = await connection.createChannel();
      channel = createdChannel;
      await createdChannel.assertExchange(this.binding.exchange, 'topic', { durable: true });
      await createdChannel.assertQueue(this.binding.queue, { durable: true });
      await createdChannel.bindQueue(
        this.binding.queue,
        this.binding.exchange,
        this.binding.routing_key,
      );
      await createdChannel.prefetch(this.binding.prefetch);
      this.connection = connection;
      this.channel = createdChannel;
      connection.on('error', (error) =>
        this.handleSessionFailure(connection, createdChannel, error),
      );
      connection.on('close', () => this.handleSessionFailure(connection, createdChannel));
      createdChannel.on('error', (error) =>
        this.handleSessionFailure(connection, createdChannel, error),
      );
      createdChannel.on('close', () => this.handleSessionFailure(connection, createdChannel));
      const registration = await createdChannel.consume(
        this.binding.queue,
        (message) => {
          if (message) {
            void this.consume(message, createdChannel);
          } else {
            this.handleSessionFailure(connection, createdChannel);
          }
        },
        { noAck: false },
      );

      this.consumerTag = registration.consumerTag;
    } catch (error) {
      if (this.connection === connection) this.connection = undefined;
      if (this.channel === channel) this.channel = undefined;
      await channel?.close().catch(() => undefined);
      await connection.close().catch(() => undefined);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    this.releaseReconnectDelay?.();
    await this.reconnectLoop?.catch(() => undefined);
    const channel = this.channel;
    const connection = this.connection;
    this.channel = undefined;
    this.connection = undefined;
    const consumerTag = this.consumerTag;
    this.consumerTag = undefined;

    if (channel && consumerTag) {
      await channel.cancel(consumerTag).catch(() => undefined);
    }
    if (channel) {
      await channel.close().catch(() => undefined);
    }
    if (connection) {
      await connection.close().catch(() => undefined);
    }
  }

  private async consume(message: RabbitMqConsumeMessage, channel: RabbitMqChannel): Promise<void> {
    if (channel !== this.channel) return;

    try {
      await this.handler.handle(message.content, message.properties.headers);
      channel.ack(message);
    } catch (error) {
      emitStructuredLog('error', 'Xử lý message grade.completed lỗi, nack', {
        error_type: error instanceof Error ? error.name : 'processing_error',
        event: 'grade.completed',
      });
      if (channel !== this.channel) return;
      try {
        channel.nack(message, false, !this.isInvalid(error));
      } catch {
        // Connection loss trước ack/nack để RabbitMQ tự redeliver message chưa ack.
      }
    }
  }

  private handleSessionFailure(
    connection: RabbitMqConnection,
    channel: RabbitMqChannel,
    error?: unknown,
  ): void {
    if (this.connection !== connection || this.channel !== channel) return;
    this.connection = undefined;
    this.channel = undefined;
    this.consumerTag = undefined;
    if (error !== undefined) this.telemetry.recordUnavailable(error);
    void channel.close().catch(() => undefined);
    void connection.close().catch(() => undefined);
    this.startReconnectLoop();
  }

  private isInvalid(error: unknown): boolean {
    return (
      error instanceof InvalidGradeCompletedMessageError ||
      (error instanceof Error && error.name === 'ZodError')
    );
  }

  private waitBeforeReconnect(): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.releaseReconnectDelay = undefined;
        resolve();
      }, this.binding.reconnect_delay_ms);
      this.releaseReconnectDelay = () => {
        clearTimeout(timer);
        this.releaseReconnectDelay = undefined;
        resolve();
      };
    });
  }
}

import { context, propagation, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';

import { AppError } from '../errors/index.js';
import { COMMAND_EXCHANGE, type CommandEnvelope } from './command-envelope.js';
import type { RabbitMqSession } from './rabbitmq-session.js';

const tracer = trace.getTracer('@aiops-lms/common');

export interface CommandPublisherOptions {
  confirmTimeoutMs: number;
}

/** Phát command ra exchange `lms.commands`; trace context đi trong header của message. */
export class RabbitMqCommandPublisher {
  private readonly declared = new WeakSet<object>();

  constructor(
    private readonly session: RabbitMqSession,
    private readonly options: CommandPublisherOptions,
  ) {}

  async publish(routingKey: string, envelope: CommandEnvelope, attempt = 0): Promise<void> {
    const span = tracer.startSpan(`${COMMAND_EXCHANGE} publish ${envelope.command_name}`, {
      kind: SpanKind.PRODUCER,
      attributes: {
        'messaging.system': 'rabbitmq',
        'messaging.destination.name': COMMAND_EXCHANGE,
        'messaging.rabbitmq.destination.routing_key': routingKey,
        'messaging.operation.type': 'publish',
        dependency_identity: 'rabbitmq',
        operation_name: 'publish',
      },
    });
    try {
      await context.with(trace.setSpan(context.active(), span), async () => {
        const headers: Record<string, string | number> = { 'x-attempt': attempt };
        const carrier: Record<string, string> = {};
        propagation.inject(context.active(), carrier);
        Object.assign(headers, carrier);
        const channel = await this.session.channel();
        if (!this.declared.has(channel)) {
          await channel.assertExchange(COMMAND_EXCHANGE, 'direct', { durable: true });
          this.declared.add(channel);
        }
        await this.publishAndConfirm(channel, routingKey, envelope, headers);
      });
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error instanceof AppError ? error : AppError.dependencyUnavailable('rabbitmq');
    } finally {
      span.end();
    }
  }

  private publishAndConfirm(
    channel: Awaited<ReturnType<RabbitMqSession['channel']>>,
    routingKey: string,
    envelope: CommandEnvelope,
    headers: Record<string, string | number>,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(AppError.dependencyTimeout('rabbitmq')),
        this.options.confirmTimeoutMs,
      );
      channel.publish(
        COMMAND_EXCHANGE,
        routingKey,
        Buffer.from(JSON.stringify(envelope)),
        {
          contentType: 'application/json',
          persistent: true,
          messageId: envelope.message_id,
          type: envelope.command_name,
          headers,
        },
        (error) => {
          clearTimeout(timer);
          if (error) reject(AppError.dependencyUnavailable('rabbitmq'));
          else resolve();
        },
      );
    });
  }
}

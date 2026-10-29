import {
  context,
  propagation,
  ROOT_CONTEXT,
  SpanKind,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';
import type { ConsumeMessage } from 'amqplib';

import { runWithCorrelationId } from '../http/correlation.js';
import {
  COMMAND_EXCHANGE,
  type CommandEnvelope,
  commandEnvelopeSchema,
} from './command-envelope.js';
import type { RabbitMqCommandPublisher } from './rabbitmq-command-publisher.js';
import type { RabbitMqSession } from './rabbitmq-session.js';

const tracer = trace.getTracer('@aiops-lms/common');

export interface CommandConsumerOptions {
  /** Tên queue, cũng là routing key (exchange direct). */
  queue: string;
  prefetch: number;
  /** Số lần xử lý tối đa trước khi chuyển sang `<queue>.error`. */
  maxAttempts: number;
  retryDelayMs: number;
  /** Chờ trước khi đăng ký lại consumer sau khi channel bị đóng ngoài ý muốn. */
  reconnectDelayMs?: number;
  handler: (envelope: CommandEnvelope) => Promise<void>;
  /** Gọi khi command hết retry, để cập nhật job/batch sang FAILED. */
  onFault?: (envelope: CommandEnvelope, error: unknown) => Promise<void>;
  onWarning?: (message: string) => void;
}

/**
 * Consumer command at-least-once: ack sau khi handler xong; handler lỗi thì phát lại với
 * `x-attempt` tăng dần, hết `maxAttempts` thì đẩy vào `<queue>.error` rồi gọi `onFault`. Idempotency
 * theo `message_id` do handler thực hiện bằng `runOnce` (inbox).
 */
export class RabbitMqCommandConsumer {
  private stopped = false;
  private readonly inFlight = new Set<Promise<void>>();

  constructor(
    private readonly session: RabbitMqSession,
    private readonly publisher: RabbitMqCommandPublisher,
    private readonly options: CommandConsumerOptions,
  ) {}

  async start(): Promise<void> {
    this.stopped = false;
    await this.attach();
  }

  /**
   * Ngừng đăng ký lại sau lần đóng channel kế tiếp (session do bên gọi đóng) và chờ các command đang
   * xử lý xong tối đa `drainTimeoutMs`, để session không bị đóng giữa lúc handler còn ack/phát lại.
   */
  async stop(drainTimeoutMs = 5_000): Promise<void> {
    this.stopped = true;
    if (this.inFlight.size === 0) return;
    let timer: NodeJS.Timeout | undefined;
    const expired = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, drainTimeoutMs);
    });
    await Promise.race([Promise.allSettled([...this.inFlight]), expired]);
    clearTimeout(timer);
  }

  private async attach(): Promise<void> {
    const { queue, prefetch } = this.options;
    const channel = await this.session.channel();
    await channel.assertExchange(COMMAND_EXCHANGE, 'direct', { durable: true });
    await channel.assertQueue(`${queue}.error`, { durable: true });
    await channel.assertQueue(queue, { durable: true });
    await channel.bindQueue(queue, COMMAND_EXCHANGE, queue);
    await channel.prefetch(prefetch);
    await channel.consume(queue, (message) => {
      if (message) this.track(this.handle(channel, message));
    });
    channel.once('close', () => {
      if (this.stopped) return;
      this.options.onWarning?.(`Channel của ${queue} bị đóng; đăng ký lại consumer`);
      this.scheduleReattach();
    });
  }

  private scheduleReattach(): void {
    const timer = setTimeout(() => {
      if (this.stopped) return;
      this.attach().catch(() => this.scheduleReattach());
    }, this.options.reconnectDelayMs ?? 1_000);
    timer.unref();
  }

  private track(work: Promise<void>): void {
    this.inFlight.add(work);
    void work.finally(() => this.inFlight.delete(work));
  }

  private async handle(
    channel: Awaited<ReturnType<RabbitMqSession['channel']>>,
    message: ConsumeMessage,
  ): Promise<void> {
    const parsed = commandEnvelopeSchema.safeParse(safeJson(message.content));
    if (!parsed.success) {
      // Message không đúng envelope không thể xử lý lại: chuyển thẳng vào queue lỗi.
      this.settle(() => {
        channel.sendToQueue(`${this.options.queue}.error`, message.content, { persistent: true });
        channel.ack(message);
      });
      return;
    }
    const envelope = parsed.data as CommandEnvelope;
    const attempt = Number(message.properties.headers?.['x-attempt'] ?? 0) + 1;
    const parent = propagation.extract(ROOT_CONTEXT, message.properties.headers ?? {});
    const span = tracer.startSpan(
      `${this.options.queue} process`,
      {
        kind: SpanKind.CONSUMER,
        attributes: {
          'messaging.system': 'rabbitmq',
          'messaging.destination.name': this.options.queue,
          'messaging.operation.type': 'process',
          dependency_identity: 'rabbitmq',
          operation_name: 'consume',
          'messaging.message.id': envelope.message_id,
        },
      },
      parent,
    );
    try {
      try {
        await context.with(trace.setSpan(parent, span), () =>
          runWithCorrelationId(envelope.correlation.correlation_id ?? envelope.message_id, () =>
            this.options.handler(envelope),
          ),
        );
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR });
        await this.fail(channel, message, envelope, attempt, error);
        return;
      }
      // Ack nằm ngoài try của handler: lỗi ack (channel đóng) không phải lỗi nghiệp vụ nên không retry.
      this.settle(() => channel.ack(message));
    } finally {
      span.end();
    }
  }

  private async fail(
    channel: Awaited<ReturnType<RabbitMqSession['channel']>>,
    message: ConsumeMessage,
    envelope: CommandEnvelope,
    attempt: number,
    error: unknown,
  ): Promise<void> {
    // Đang tắt: để broker giao lại message chưa ack, không chờ retry trên channel sắp đóng.
    if (this.stopped) return;
    try {
      if (attempt < this.options.maxAttempts) {
        await sleep(this.options.retryDelayMs);
        await this.publisher.publish(this.options.queue, envelope, attempt);
      } else {
        channel.sendToQueue(`${this.options.queue}.error`, message.content, { persistent: true });
        await this.options.onFault?.(envelope, error);
      }
      this.settle(() => channel.ack(message));
    } catch {
      // Không phát lại/ghi lỗi được: trả message về queue để giao lại, không mất command.
      this.options.onWarning?.('Không chuyển được command lỗi; trả về queue');
      this.settle(() => channel.nack(message, false, true));
    }
  }

  /**
   * Ack/nack trên channel đã đóng ném `IllegalOperationError`. Message chưa ack sẽ được broker giao
   * lại khi channel đóng nên bỏ qua lỗi này; ném ra ngoài sẽ thành unhandled rejection.
   */
  private settle(operation: () => void): void {
    try {
      operation();
    } catch (error) {
      this.options.onWarning?.(
        `Không ack/nack được (channel đã đóng?): ${error instanceof Error ? error.message : 'lỗi không rõ'}`,
      );
    }
  }
}

function safeJson(content: Buffer): unknown {
  try {
    return JSON.parse(content.toString('utf8'));
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

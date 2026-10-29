import { jest } from '@jest/globals';
import type { ConsumeMessage } from 'amqplib';

import {
  buildCommandEnvelope,
  buildQueueName,
  commandEnvelopeSchema,
} from '../../src/messaging/command-envelope.js';
import { runOnce } from '../../src/messaging/inbox.js';
import { OutboxRelayLoop } from '../../src/messaging/outbox-relay-loop.js';
import { RabbitMqCommandConsumer } from '../../src/messaging/rabbitmq-command-consumer.js';
import type { RabbitMqCommandPublisher } from '../../src/messaging/rabbitmq-command-publisher.js';
import type { RabbitMqSession } from '../../src/messaging/rabbitmq-session.js';
import { PostgresOutbox, relayOutboxOnce } from '../../src/messaging/outbox.js';
import type { SqlClient, TransactionalSqlClient } from '../../src/prisma/sql-client.js';

class FakeSql implements TransactionalSqlClient {
  readonly executed: { query: string; values: unknown[] }[] = [];
  claimed: unknown[] = [];
  inserted = 1;

  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number> {
    this.executed.push({ query, values });
    return Promise.resolve(this.inserted);
  }

  $queryRawUnsafe<T>(): Promise<T> {
    return Promise.resolve(this.claimed as T);
  }

  $transaction<T>(run: (tx: SqlClient) => Promise<T>): Promise<T> {
    return run(this);
  }
}

describe('command envelope', () => {
  it('dựng envelope v2 hợp lệ và tên queue theo quy ước', () => {
    const envelope = buildCommandEnvelope({
      commandName: 'media.thumbnail.generate',
      schemaVersion: 1,
      payload: { media_id: 'x' },
      producer: { serviceName: 'media', serviceVersion: '0.1.0' },
      correlationId: 'corr',
    });

    expect(commandEnvelopeSchema.safeParse(envelope).success).toBe(true);
    expect(envelope.correlation).toEqual({
      traceparent: null,
      tracestate: null,
      correlation_id: 'corr',
    });
    expect(buildQueueName('media-worker', 'synchronize-markdown-media-usage', 1)).toBe(
      'media-worker--synchronize-markdown-media-usage-v1',
    );
  });
});

describe('PostgresOutbox', () => {
  it('ghi envelope vào outbox_messages bằng transaction client', async () => {
    const sql = new FakeSql();
    await new PostgresOutbox(sql, { serviceName: 'course', serviceVersion: '0.1.0' }).enqueue({
      commandName: 'media.usages.delete-by-ids',
      schemaVersion: 1,
      routingKey: 'media-worker--delete-media-usages-by-ids-v1',
      payload: { usage_ids: [] },
    });

    const [call] = sql.executed;
    expect(call?.query).toContain('INSERT INTO outbox_messages');
    expect(call?.values[1]).toBe('media-worker--delete-media-usages-by-ids-v1');
    expect(JSON.parse(call?.values[2] as string)).toMatchObject({
      command_name: 'media.usages.delete-by-ids',
      producer: { service_name: 'course' },
    });
  });
});

describe('relayOutboxOnce', () => {
  const options = { batchSize: 10, leaseMs: 1_000, backoffMs: (attempt: number) => attempt * 100 };

  it('đánh dấu đã phát khi publish thành công và lên lịch retry khi lỗi', async () => {
    const sql = new FakeSql();
    sql.claimed = [
      { id: 'a', routing_key: 'q', envelope: {}, attempts: 1 },
      { id: 'b', routing_key: 'q', envelope: {}, attempts: 2 },
    ];

    const result = await relayOutboxOnce(
      sql,
      (message) =>
        message.id === 'b' ? Promise.reject(new Error('broker down')) : Promise.resolve(),
      options,
    );

    expect(result).toEqual({ published: 1, failed: 1 });
    expect(sql.executed[0]?.query).toContain('published_at = now()');
    expect(sql.executed[1]?.query).toContain('available_at');
    expect(sql.executed[1]?.values).toEqual(['b', '200', 'Error']);
  });
});

describe('runOnce', () => {
  it('bỏ qua message trùng và chỉ chạy handler một lần', async () => {
    const sql = new FakeSql();
    const handler = jest.fn(() => Promise.resolve());

    await expect(runOnce(sql, 'id-1', 'consumer', handler)).resolves.toBe('processed');
    sql.inserted = 0;
    await expect(runOnce(sql, 'id-1', 'consumer', handler)).resolves.toBe('deduplicated');
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('RabbitMqCommandConsumer', () => {
  type ConsumeCallback = (message: ConsumeMessage | null) => void;

  class FakeChannel {
    callback: ConsumeCallback | undefined;
    closed = false;
    readonly acked: ConsumeMessage[] = [];
    readonly nacked: ConsumeMessage[] = [];
    readonly errorQueue: Buffer[] = [];

    assertExchange(): Promise<void> {
      return Promise.resolve();
    }
    assertQueue(): Promise<void> {
      return Promise.resolve();
    }
    bindQueue(): Promise<void> {
      return Promise.resolve();
    }
    prefetch(): Promise<void> {
      return Promise.resolve();
    }
    consume(_queue: string, callback: ConsumeCallback): Promise<void> {
      this.callback = callback;
      return Promise.resolve();
    }
    once(): void {}
    ack(message: ConsumeMessage): void {
      this.assertOpen();
      this.acked.push(message);
    }
    nack(message: ConsumeMessage): void {
      this.assertOpen();
      this.nacked.push(message);
    }
    sendToQueue(_queue: string, content: Buffer): void {
      this.assertOpen();
      this.errorQueue.push(content);
    }
    private assertOpen(): void {
      if (this.closed) throw new Error('Channel closed');
    }
  }

  const envelope = buildCommandEnvelope({
    commandName: 'media.thumbnail.generate',
    schemaVersion: 1,
    payload: { media_id: 'x' },
    producer: { serviceName: 'media', serviceVersion: '0.1.0' },
    correlationId: 'corr',
  });
  const delivery = {
    content: Buffer.from(JSON.stringify(envelope)),
    properties: { headers: {} },
  } as unknown as ConsumeMessage;

  async function start(
    handler: () => Promise<void>,
    maxAttempts = 3,
  ): Promise<{
    channel: FakeChannel;
    consumer: RabbitMqCommandConsumer;
    publish: jest.Mock<() => Promise<void>>;
    warnings: string[];
  }> {
    const channel = new FakeChannel();
    const publish = jest.fn<() => Promise<void>>().mockResolvedValue();
    const warnings: string[] = [];
    const consumer = new RabbitMqCommandConsumer(
      { channel: () => Promise.resolve(channel) } as unknown as RabbitMqSession,
      { publish } as unknown as RabbitMqCommandPublisher,
      {
        queue: 'q',
        prefetch: 1,
        maxAttempts,
        retryDelayMs: 1,
        handler,
        onWarning: (message) => warnings.push(message),
      },
    );
    await consumer.start();
    return { channel, consumer, publish, warnings };
  }

  const settleMicrotasks = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 20));

  it('handler thành công mà channel đã đóng thì không retry và không ném lỗi', async () => {
    let release: () => void = () => undefined;
    const { channel, consumer, publish, warnings } = await start(
      () => new Promise<void>((resolve) => (release = resolve)),
    );
    channel.callback?.(delivery);
    channel.closed = true;
    release();
    await settleMicrotasks();

    expect(publish).not.toHaveBeenCalled();
    expect(warnings).toHaveLength(1);
    await consumer.stop();
  });

  it('handler lỗi mà channel đã đóng thì bỏ qua nack, không thành unhandled rejection', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): number => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      let fail: (error: Error) => void = () => undefined;
      const { channel, consumer, publish } = await start(
        () => new Promise<void>((_resolve, reject) => (fail = reject)),
        1,
      );
      channel.callback?.(delivery);
      channel.closed = true;
      fail(new Error('handler lỗi'));
      await settleMicrotasks();

      expect(publish).not.toHaveBeenCalled();
      expect(unhandled).toEqual([]);
      await consumer.stop();
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('stop chờ command đang xử lý xong và không phát lại command lỗi khi đang tắt', async () => {
    let fail: (error: Error) => void = () => undefined;
    const { channel, consumer, publish } = await start(
      () => new Promise<void>((_resolve, reject) => (fail = reject)),
    );
    channel.callback?.(delivery);

    let drained = false;
    const stopping = consumer.stop().then(() => (drained = true));
    await settleMicrotasks();
    expect(drained).toBe(false);

    fail(new Error('handler lỗi'));
    await stopping;

    expect(drained).toBe(true);
    expect(publish).not.toHaveBeenCalled();
    expect(channel.acked).toHaveLength(0);
    expect(channel.nacked).toHaveLength(0);
  });
});

describe('OutboxRelayLoop', () => {
  it('stop chờ lượt relay đang chạy xong rồi không còn truy vấn DB nữa', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let queries = 0;
    const sql = new FakeSql();
    sql.$queryRawUnsafe = <T>(): Promise<T> => {
      queries += 1;
      return gate.then(() => [] as unknown as T);
    };
    const loop = new OutboxRelayLoop(
      sql,
      { publish: jest.fn() } as unknown as RabbitMqCommandPublisher,
      { batchSize: 10, leaseMs: 1_000, backoffMs: () => 0, pollMs: 1 },
    );

    loop.start();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(queries).toBe(1);

    let stopped = false;
    const stopping = loop.stop().then(() => {
      stopped = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(stopped).toBe(false);

    release();
    await stopping;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(queries).toBe(1);
  });
});

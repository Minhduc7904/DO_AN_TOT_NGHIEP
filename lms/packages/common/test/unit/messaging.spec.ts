import { jest } from '@jest/globals';

import {
  buildCommandEnvelope,
  buildQueueName,
  commandEnvelopeSchema,
} from '../../src/messaging/command-envelope.js';
import { runOnce } from '../../src/messaging/inbox.js';
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

// Smoke test với RabbitMQ + PostgreSQL thật:
//   RABBITMQ_URL=amqp://… DATABASE_URL=postgresql://… node test/integration/rabbitmq-outbox.integration.mjs
// Kiểm tra: outbox → relay → exchange lms.commands → consumer → inbox chống trùng → retry → queue lỗi.
import assert from 'node:assert/strict';

import pg from 'pg';

import { PostgresOutbox, relayOutboxOnce } from '../../dist/messaging/outbox.js';
import { runOnce } from '../../dist/messaging/inbox.js';
import { RabbitMqCommandConsumer } from '../../dist/messaging/rabbitmq-command-consumer.js';
import { RabbitMqCommandPublisher } from '../../dist/messaging/rabbitmq-command-publisher.js';
import { RabbitMqSession } from '../../dist/messaging/rabbitmq-session.js';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const sql = {
  $executeRawUnsafe: async (query, ...values) => (await pool.query(query, values)).rowCount,
  $queryRawUnsafe: async (query, ...values) => (await pool.query(query, values)).rows,
  $transaction: async (run) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const tx = {
        $executeRawUnsafe: async (query, ...values) => (await client.query(query, values)).rowCount,
        $queryRawUnsafe: async (query, ...values) => (await client.query(query, values)).rows,
      };
      const result = await run(tx);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
};

await pool.query(`DROP TABLE IF EXISTS outbox_messages, inbox_states`);
await pool.query(`CREATE TABLE outbox_messages (
  id uuid PRIMARY KEY, routing_key text NOT NULL, envelope jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), available_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz, attempts int NOT NULL DEFAULT 0, published_at timestamptz, last_error text)`);
await pool.query(`CREATE TABLE inbox_states (
  message_id uuid NOT NULL, consumer text NOT NULL, processed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, consumer))`);

const suffix = Date.now();
const okQueue = `test-worker--ok-v1-${suffix}`;
const badQueue = `test-worker--bad-v1-${suffix}`;
const session = new RabbitMqSession({ url: process.env.RABBITMQ_URL, connectTimeoutMs: 5000 });
const publisher = new RabbitMqCommandPublisher(session, {
  confirmTimeoutMs: 5000,
  dependencyIdentity: 'test-rabbitmq',
});
const outbox = new PostgresOutbox(sql, { serviceName: 'test', serviceVersion: '0.0.1' });

const handled = [];
const faults = [];
const okConsumer = new RabbitMqCommandConsumer(session, publisher, {
  queue: okQueue,
  prefetch: 1,
  maxAttempts: 3,
  retryDelayMs: 50,
  handler: (envelope) =>
    runOnce(sql, envelope.message_id, 'test-worker', async () => {
      handled.push(envelope.payload.n);
    }),
});
let badAttempts = 0;
const badConsumer = new RabbitMqCommandConsumer(session, publisher, {
  queue: badQueue,
  prefetch: 1,
  maxAttempts: 3,
  retryDelayMs: 50,
  handler: () => {
    badAttempts += 1;
    return Promise.reject(new Error('boom'));
  },
  onFault: (envelope) => {
    faults.push(envelope.payload.n);
    return Promise.resolve();
  },
});
await okConsumer.start();
await badConsumer.start();

await outbox.enqueue({
  commandName: 'test.ok',
  schemaVersion: 1,
  routingKey: okQueue,
  payload: { n: 1 },
});
await outbox.enqueue({
  commandName: 'test.bad',
  schemaVersion: 1,
  routingKey: badQueue,
  payload: { n: 2 },
});

const relayOptions = { batchSize: 10, leaseMs: 5000, backoffMs: () => 100 };
const publish = (message) => publisher.publish(message.routing_key, message.envelope);
const relayed = await relayOutboxOnce(sql, publish, relayOptions);
assert.deepEqual(relayed, { published: 2, failed: 0 });
assert.deepEqual(await relayOutboxOnce(sql, publish, relayOptions), { published: 0, failed: 0 });

// Phát lại cùng message_id: inbox phải chặn xử lý lần hai.
const [{ envelope }] = (
  await pool.query(`SELECT envelope FROM outbox_messages WHERE routing_key = $1`, [okQueue])
).rows;
await publisher.publish(okQueue, envelope);

const deadline = Date.now() + 8000;
while ((handled.length < 1 || faults.length < 1) && Date.now() < deadline) {
  await new Promise((resolve) => setTimeout(resolve, 100));
}
await new Promise((resolve) => setTimeout(resolve, 500));

assert.deepEqual(handled, [1], 'handler chỉ chạy một lần dù command bị giao hai lần');
assert.equal(badAttempts, 3, 'retry đủ maxAttempts');
assert.deepEqual(faults, [2], 'onFault được gọi khi hết retry');

const channel = await session.channel();
const errorQueue = await channel.checkQueue(`${badQueue}.error`);
assert.equal(errorQueue.messageCount, 1, 'command lỗi nằm trong queue .error');

await channel.deleteQueue(okQueue);
await channel.deleteQueue(badQueue);
await channel.deleteQueue(`${okQueue}.error`);
await channel.deleteQueue(`${badQueue}.error`);
okConsumer.stop();
badConsumer.stop();
await session.close();
await pool.end();
console.log('rabbitmq-outbox integration: OK');

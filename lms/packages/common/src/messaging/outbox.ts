import { randomUUID } from 'node:crypto';

import { context, propagation } from '@opentelemetry/api';

import { getCorrelationId } from '../http/correlation.js';
import type { CommandOutbox, OutboundCommand } from '../ports/index.js';
import type { SqlClient } from '../prisma/sql-client.js';
import { buildCommandEnvelope } from './command-envelope.js';

/**
 * Bảng outbox của mỗi service (xem migration mẫu trong template):
 *
 * `outbox_messages(id uuid pk, routing_key text, envelope jsonb, created_at timestamptz,
 *   available_at timestamptz, locked_until timestamptz null, attempts int, published_at
 *   timestamptz null, last_error text null)`.
 */
export class PostgresOutbox implements CommandOutbox {
  constructor(
    /** Transaction client của use case hiện tại để command commit cùng dữ liệu nghiệp vụ. */
    private readonly sql: SqlClient,
    private readonly producer: { serviceName: string; serviceVersion: string },
  ) {}

  async enqueue<TPayload>(command: OutboundCommand<TPayload>): Promise<void> {
    const carrier: Record<string, string> = {};
    propagation.inject(context.active(), carrier);
    const envelope = buildCommandEnvelope({
      commandName: command.commandName,
      schemaVersion: command.schemaVersion,
      payload: command.payload,
      producer: this.producer,
      correlationId: getCorrelationId(),
      traceparent: carrier['traceparent'],
      tracestate: carrier['tracestate'],
    });
    await this.sql.$executeRawUnsafe(
      `INSERT INTO outbox_messages (id, routing_key, envelope) VALUES ($1::uuid, $2, $3::jsonb)`,
      randomUUID(),
      command.routingKey,
      JSON.stringify(envelope),
    );
  }
}

export interface ClaimedOutboxMessage {
  id: string;
  routing_key: string;
  envelope: unknown;
  attempts: number;
}

export interface OutboxRelayOptions {
  batchSize: number;
  leaseMs: number;
  /** Chờ trước lần thử lại thứ n (n bắt đầu từ 1). */
  backoffMs: (attempt: number) => number;
}

/**
 * Relay: claim một lô bằng `FOR UPDATE SKIP LOCKED` + lease trong một câu lệnh, publish từng message
 * ra broker, đánh dấu đã phát hoặc lên lịch thử lại. Nhiều relay chạy song song không giẫm nhau.
 */
export async function relayOutboxOnce(
  sql: SqlClient,
  publish: (message: ClaimedOutboxMessage) => Promise<void>,
  options: OutboxRelayOptions,
): Promise<{ published: number; failed: number }> {
  const claimed = await sql.$queryRawUnsafe<ClaimedOutboxMessage[]>(
    `UPDATE outbox_messages SET
       locked_until = now() + ($2 || ' milliseconds')::interval,
       attempts = attempts + 1
     WHERE id IN (
       SELECT id FROM outbox_messages
       WHERE published_at IS NULL AND available_at <= now()
         AND (locked_until IS NULL OR locked_until < now())
       ORDER BY created_at
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING id::text, routing_key, envelope, attempts`,
    options.batchSize,
    String(options.leaseMs),
  );

  let published = 0;
  let failed = 0;
  for (const message of claimed) {
    try {
      await publish(message);
      await sql.$executeRawUnsafe(
        `UPDATE outbox_messages SET published_at = now(), locked_until = NULL, last_error = NULL
         WHERE id = $1::uuid`,
        message.id,
      );
      published += 1;
    } catch (error) {
      failed += 1;
      await sql.$executeRawUnsafe(
        `UPDATE outbox_messages SET
           locked_until = NULL,
           available_at = now() + ($2 || ' milliseconds')::interval,
           last_error = $3
         WHERE id = $1::uuid`,
        message.id,
        String(options.backoffMs(message.attempts)),
        error instanceof Error ? error.name : 'unknown',
      );
    }
  }
  return { published, failed };
}

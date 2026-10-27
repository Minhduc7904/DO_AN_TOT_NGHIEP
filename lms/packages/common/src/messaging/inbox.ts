import type { SqlClient, TransactionalSqlClient } from '../prisma/sql-client.js';

/**
 * Bảng inbox: `inbox_states(message_id uuid, consumer text, processed_at timestamptz,
 * primary key (message_id, consumer))`.
 *
 * Xử lý command idempotent: chèn dấu xử lý và chạy handler trong cùng một transaction. Trùng
 * `message_id` thì bỏ qua (`deduplicated`); handler lỗi thì rollback cả dấu xử lý để lần giao lại
 * được xử lý lại.
 */
export async function runOnce(
  sql: TransactionalSqlClient,
  messageId: string,
  consumer: string,
  handler: (tx: SqlClient) => Promise<void>,
): Promise<'processed' | 'deduplicated'> {
  return sql.$transaction(async (tx) => {
    const inserted = await tx.$executeRawUnsafe(
      `INSERT INTO inbox_states (message_id, consumer) VALUES ($1::uuid, $2)
       ON CONFLICT (message_id, consumer) DO NOTHING`,
      messageId,
      consumer,
    );
    if (inserted === 0) return 'deduplicated';
    await handler(tx);
    return 'processed';
  });
}

/**
 * Giao diện SQL tối thiểu mà `PrismaClient` và transaction client của Prisma cùng thỏa. Package
 * common không import Prisma client của service (mỗi service sinh client riêng); outbox/inbox dùng
 * SQL thô qua giao diện này.
 */
export interface SqlClient {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

export interface TransactionalSqlClient extends SqlClient {
  $transaction<T>(run: (tx: SqlClient) => Promise<T>): Promise<T>;
}

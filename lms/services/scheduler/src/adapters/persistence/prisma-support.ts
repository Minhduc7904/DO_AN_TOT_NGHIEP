import { observeDependency } from '@aiops-lms/common/telemetry';

import type { Db } from './db.js';
import type { Prisma } from './generated/client.js';

const DEPENDENCY = 'scheduler-postgres';

/** Bọc một thao tác DB bằng span và metric dependency `scheduler-postgres`. */
export function observeDb<T>(operation: string, run: () => Promise<T>): Promise<T> {
  return observeDependency(DEPENDENCY, operation, run, {
    attributes: { 'db.system.name': 'postgresql' },
  });
}

/** Chạy `work` trong một transaction mới, hoặc ngay trong transaction đang mở nếu `db` là client giao dịch. */
export function inTransaction<T>(
  db: Db,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return '$transaction' in db
    ? db.$transaction((tx) => work(tx), { maxWait: 5_000, timeout: 30_000 })
    : work(db);
}

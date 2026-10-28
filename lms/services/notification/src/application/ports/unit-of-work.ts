import type { ItemRepository, BatchRepository, NotificationRepository } from './repositories.js';

/** Command phát đi, ghi vào outbox cùng transaction với dữ liệu nghiệp vụ. */
export interface NotificationCommands {
  requestBatchSnapshot(batchId: string): Promise<void>;
  requestBatchDispatch(batchId: string): Promise<void>;
  requestSingleDispatch(notificationId: string): Promise<void>;
  startMediaUsageJob(jobId: string, batchId: string): Promise<void>;
  registerMediaUsage(
    notificationId: string,
    mediaIds: readonly string[],
    actorId: string,
  ): Promise<void>;
  registerMediaUsageBatch(
    jobId: string,
    items: readonly { notificationId: string; mediaIds: readonly string[] }[],
    actorId: string,
  ): Promise<void>;
  completeMediaUsageJob(jobId: string, expectedUsageCount: number): Promise<void>;
}

export interface NotificationStores {
  notifications: NotificationRepository;
  batches: BatchRepository;
  items: ItemRepository;
  commands: NotificationCommands;
}

export const NOTIFICATION_UNIT_OF_WORK = Symbol('NOTIFICATION_UNIT_OF_WORK');

export interface NotificationUnitOfWork {
  /** Truy cập ngoài transaction (đọc, hoặc ghi đơn lẻ). */
  readonly stores: NotificationStores;
  /** Chạy `work` trong một transaction; mọi store trong `work` cùng commit hoặc cùng rollback. */
  run<T>(work: (stores: NotificationStores) => Promise<T>): Promise<T>;
  /** Như `run` nhưng bỏ qua nếu `messageId` đã được `consumer` xử lý (inbox). */
  runOnce(
    messageId: string,
    consumer: string,
    work: (stores: NotificationStores) => Promise<void>,
  ): Promise<'processed' | 'deduplicated'>;
}

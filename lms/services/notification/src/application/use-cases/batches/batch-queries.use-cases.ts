import { AppError } from '@aiops-lms/common/errors';

import type {
  BatchItem,
  BatchItemCounts,
  BatchStatus,
  NotificationBatch,
} from '../../../domain/notification.js';
import type { NotificationUnitOfWork } from '../../ports/unit-of-work.js';

async function requireBatch(
  uow: NotificationUnitOfWork,
  batchId: string,
): Promise<NotificationBatch> {
  const batch = await uow.stores.batches.findById(batchId);
  if (!batch) throw AppError.notFound('Không tìm thấy batch');
  return batch;
}

export class ListNotificationBatchesUseCase {
  constructor(private readonly uow: NotificationUnitOfWork) {}

  execute(
    status: BatchStatus | undefined,
    page: number,
    pageSize: number,
  ): Promise<{ items: NotificationBatch[]; total: number }> {
    return this.uow.stores.batches.list(status, page, pageSize);
  }
}

export class GetNotificationBatchUseCase {
  constructor(private readonly uow: NotificationUnitOfWork) {}

  execute(batchId: string): Promise<NotificationBatch> {
    return requireBatch(this.uow, batchId);
  }
}

const SNAPSHOT_PENDING: readonly BatchStatus[] = ['PENDING', 'SNAPSHOTTING'];

export class GetBatchSnapshotStatusUseCase {
  constructor(private readonly uow: NotificationUnitOfWork) {}

  async execute(batchId: string): Promise<{
    batchId: string;
    status: BatchStatus;
    snapshottedCount: number;
    finished: boolean;
  }> {
    const batch = await requireBatch(this.uow, batchId);
    return {
      batchId: batch.id,
      status: batch.status,
      snapshottedCount: await this.uow.stores.items.count(batch.id),
      // Batch lỗi khi đang chụp (FAILED không có recipient) cũng không còn chụp tiếp.
      finished: !SNAPSHOT_PENDING.includes(batch.status),
    };
  }
}

export class GetBatchDeliveryStatusUseCase {
  constructor(private readonly uow: NotificationUnitOfWork) {}

  async execute(batchId: string): Promise<{ batch: NotificationBatch; counts: BatchItemCounts }> {
    const batch = await requireBatch(this.uow, batchId);
    return { batch, counts: await this.uow.stores.items.countByStatus(batch.id) };
  }
}

export class ListFailedBatchItemsUseCase {
  constructor(private readonly uow: NotificationUnitOfWork) {}

  async execute(
    batchId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: BatchItem[]; total: number }> {
    const batch = await requireBatch(this.uow, batchId);
    return this.uow.stores.items.listFailed(batch.id, page, pageSize);
  }
}

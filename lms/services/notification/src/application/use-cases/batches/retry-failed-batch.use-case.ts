import { AppError } from '@aiops-lms/common/errors';
import type { IdGenerator } from '@aiops-lms/common/ports';

import { notificationErrors } from '../../../domain/errors.js';
import {
  extractMediaIds,
  isTerminalBatchStatus,
  type NotificationBatch,
} from '../../../domain/notification.js';
import type { NotificationUnitOfWork } from '../../ports/unit-of-work.js';

/** Tạo batch `FAILED_RECIPIENTS` từ các item `FAILED` của batch nguồn; mỗi nguồn chỉ có một retry. */
export class RetryFailedBatchUseCase {
  constructor(
    private readonly uow: NotificationUnitOfWork,
    private readonly ids: IdGenerator,
  ) {}

  async execute(actorId: string, sourceBatchId: string): Promise<NotificationBatch> {
    const source = await this.uow.stores.batches.findById(sourceBatchId);
    if (!source) throw AppError.notFound('Không tìm thấy batch');
    if (!isTerminalBatchStatus(source.status)) {
      throw notificationErrors.batchNotRetryable('Batch chưa kết thúc');
    }
    if (source.failedCount === 0) {
      throw notificationErrors.batchNotRetryable('Batch không có recipient lỗi để gửi lại');
    }
    const existing = await this.uow.stores.batches.findBySource(source.id);
    if (existing) throw notificationErrors.batchRetryExists(existing.id);

    const hasMedia = extractMediaIds(source.contentMarkdown).length > 0;
    const created = await this.uow.run(async (stores) => {
      const batch = await stores.batches.create({
        id: this.ids.next(),
        title: source.title,
        contentMarkdown: source.contentMarkdown,
        targetScope: 'FAILED_RECIPIENTS',
        batchSize: source.batchSize,
        sourceBatchId: source.id,
        createdBy: actorId,
        mediaUsageJobId: hasMedia ? this.ids.next() : null,
      });
      // `null` khi một yêu cầu retry khác thắng cuộc đua ở ràng buộc unique `source_batch_id`.
      if (!batch) return null;
      if (batch.mediaUsageJobId) {
        await stores.commands.startMediaUsageJob(batch.mediaUsageJobId, batch.id);
      }
      await stores.commands.requestBatchSnapshot(batch.id);
      return batch;
    });
    if (created) return created;
    const winner = await this.uow.stores.batches.findBySource(source.id);
    throw notificationErrors.batchRetryExists(winner?.id ?? source.id);
  }
}

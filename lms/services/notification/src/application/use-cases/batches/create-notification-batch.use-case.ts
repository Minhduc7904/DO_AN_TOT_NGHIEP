import type { IdGenerator } from '@aiops-lms/common/ports';

import {
  DEFAULT_BATCH_SIZE,
  extractMediaIds,
  type NotificationBatch,
} from '../../../domain/notification.js';
import type { NotificationUnitOfWork } from '../../ports/unit-of-work.js';

export interface CreateNotificationBatchInput {
  title: string;
  contentMarkdown: string;
  batchSize?: number | undefined;
}

/** Tạo batch gửi cho mọi student `ACTIVE`; recipient được chụp bất đồng bộ bởi `notification-worker`. */
export class CreateNotificationBatchUseCase {
  constructor(
    private readonly uow: NotificationUnitOfWork,
    private readonly ids: IdGenerator,
  ) {}

  execute(actorId: string, input: CreateNotificationBatchInput): Promise<NotificationBatch> {
    const hasMedia = extractMediaIds(input.contentMarkdown).length > 0;
    return this.uow.run(async (stores) => {
      const batch = await stores.batches.create({
        id: this.ids.next(),
        title: input.title,
        contentMarkdown: input.contentMarkdown,
        targetScope: 'ALL_STUDENTS',
        batchSize: input.batchSize ?? DEFAULT_BATCH_SIZE,
        sourceBatchId: null,
        createdBy: actorId,
        mediaUsageJobId: hasMedia ? this.ids.next() : null,
      });
      if (!batch) throw new Error('không tạo được batch');
      if (batch.mediaUsageJobId) {
        await stores.commands.startMediaUsageJob(batch.mediaUsageJobId, batch.id);
      }
      await stores.commands.requestBatchSnapshot(batch.id);
      return batch;
    });
  }
}

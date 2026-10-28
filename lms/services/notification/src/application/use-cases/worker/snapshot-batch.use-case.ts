import type { Clock, IdGenerator } from '@aiops-lms/common/ports';

import {
  MAX_BATCH_RECIPIENTS,
  SNAPSHOT_PAGE_SIZE,
  type NotificationBatch,
} from '../../../domain/notification.js';
import type { StudentDirectory } from '../../ports/student-directory.js';
import type { NotificationUnitOfWork } from '../../ports/unit-of-work.js';
import type { FailBatchUseCase } from './fail-batch.use-case.js';

/**
 * Chụp recipient của batch: `ALL_STUDENTS` duyệt student `ACTIVE` theo trang (email được lưu vào
 * item), `FAILED_RECIPIENTS` sao chép item lỗi của batch nguồn. Chèn idempotent nên command chạy
 * lại (retry, redelivery) không tạo trùng; xong thì batch sang `SNAPSHOT_READY` và phát dispatch.
 */
export class SnapshotBatchUseCase {
  constructor(
    private readonly uow: NotificationUnitOfWork,
    private readonly students: StudentDirectory,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly failBatch: FailBatchUseCase,
  ) {}

  async execute(messageId: string, consumer: string, batchId: string): Promise<void> {
    const batch = await this.uow.stores.batches.findById(batchId);
    if (!batch || (batch.status !== 'PENDING' && batch.status !== 'SNAPSHOTTING')) return;
    await this.uow.stores.batches.transition(batchId, ['PENDING', 'SNAPSHOTTING'], {
      status: 'SNAPSHOTTING',
    });

    const withinLimit = await this.collect(batch);
    if (!withinLimit) {
      await this.failBatch.execute(
        batchId,
        `Vượt trần ${MAX_BATCH_RECIPIENTS} recipient của một batch`,
      );
      return;
    }

    await this.uow.runOnce(messageId, consumer, async (stores) => {
      const total = await stores.items.count(batchId);
      if (total === 0) {
        // Không có recipient: kết thúc ngay và đóng job usage media nếu có.
        const done = await stores.batches.transition(batchId, ['SNAPSHOTTING'], {
          status: 'COMPLETED',
          requestedCount: 0,
          completedAt: this.clock.now(),
        });
        if (done && batch.mediaUsageJobId) {
          await stores.commands.completeMediaUsageJob(batch.mediaUsageJobId, 0);
        }
        return;
      }
      const ready = await stores.batches.transition(batchId, ['SNAPSHOTTING'], {
        status: 'SNAPSHOT_READY',
        requestedCount: total,
      });
      if (ready) await stores.commands.requestBatchDispatch(batchId);
    });
  }

  /** Trả `false` khi số recipient vượt trần. */
  private async collect(batch: NotificationBatch): Promise<boolean> {
    if (batch.targetScope === 'FAILED_RECIPIENTS') {
      if (!batch.sourceBatchId) return true;
      const sourceId = batch.sourceBatchId;
      await this.uow.run((stores) => stores.items.copyFailed(sourceId, batch.id));
      return true;
    }
    for (let page = 1; ; page += 1) {
      const result = await this.students.listActive(page, SNAPSHOT_PAGE_SIZE);
      if (result.total > MAX_BATCH_RECIPIENTS) return false;
      await this.uow.stores.items.insertMany(
        result.items.map((student) => ({
          id: this.ids.next(),
          batchId: batch.id,
          studentId: student.id,
          email: student.email,
        })),
      );
      if (result.items.length < SNAPSHOT_PAGE_SIZE || page * SNAPSHOT_PAGE_SIZE >= result.total) {
        return true;
      }
    }
  }
}

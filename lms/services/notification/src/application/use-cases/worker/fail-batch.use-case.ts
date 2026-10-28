import type { NotificationUnitOfWork } from '../../ports/unit-of-work.js';
import type { Clock } from '@aiops-lms/common/ports';

const OPEN_STATUSES = ['PENDING', 'SNAPSHOTTING', 'SNAPSHOT_READY', 'PROCESSING'] as const;

/**
 * Đưa batch về `FAILED` khi không thể xử lý tiếp (hết retry của command, vượt trần recipient).
 * Batch đã kết thúc thì giữ nguyên; job usage media vẫn được đóng để không treo.
 */
export class FailBatchUseCase {
  constructor(
    private readonly uow: NotificationUnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(batchId: string, reason: string): Promise<void> {
    await this.uow.run(async (stores) => {
      const changed = await stores.batches.transition(batchId, OPEN_STATUSES, {
        status: 'FAILED',
        lastError: reason.slice(0, 500),
        completedAt: this.clock.now(),
      });
      if (!changed) return;
      const batch = await stores.batches.findById(batchId);
      if (batch?.mediaUsageJobId) {
        await stores.commands.completeMediaUsageJob(
          batch.mediaUsageJobId,
          batch.mediaUsageExpected,
        );
      }
    });
  }
}

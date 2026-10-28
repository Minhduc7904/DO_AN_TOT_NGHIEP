import type { Clock, IdGenerator } from '@aiops-lms/common/ports';

import {
  extractMediaIds,
  finalBatchStatus,
  MEDIA_REGISTER_CHUNK,
  renderEmail,
  retryDelayMs,
} from '../../../domain/notification.js';
import { mapLimit, sleep } from '../../concurrency.js';
import type { EmailSender } from '../../ports/email-sender.js';
import type { NotificationUnitOfWork } from '../../ports/unit-of-work.js';

export interface DispatchSettings {
  /** Thời gian giữ lease của một lô item đang gửi. */
  leaseMs: number;
  /** Số lần gửi tối đa cho một item trước khi `FAILED`. */
  maxAttempts: number;
  /** Chờ cơ sở trước lần gửi lại (nhân đôi mỗi lần). */
  retryBaseMs: number;
  /** Số email gửi đồng thời trong một lô. */
  concurrency: number;
  /** Chờ tối đa trong một lượt khi chưa có item đến hạn nhận lại. */
  maxIdleWaitMs: number;
}

/**
 * Nhận một lô item bằng lease, gửi email, ghi thông báo vào inbox của người gửi thành công rồi tự
 * enqueue lại tới khi hết item. Kết quả của lô và command kế tiếp commit cùng một transaction, nên
 * crash giữa chừng chỉ khiến lease hết hạn và item được nhận lại (at-least-once; inbox không trùng
 * nhờ unique `(batch_id, student_id)`).
 */
export class DispatchBatchUseCase {
  constructor(
    private readonly uow: NotificationUnitOfWork,
    private readonly emails: EmailSender,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly settings: DispatchSettings,
  ) {}

  async execute(batchId: string): Promise<void> {
    const batch = await this.uow.stores.batches.findById(batchId);
    if (!batch) return;
    if (batch.status === 'SNAPSHOT_READY') {
      await this.uow.stores.batches.transition(batchId, ['SNAPSHOT_READY'], {
        status: 'PROCESSING',
      });
    } else if (batch.status !== 'PROCESSING') {
      return;
    }

    const leaseToken = this.ids.next();
    const claimed = await this.uow.stores.items.claim(
      batchId,
      batch.batchSize,
      this.settings.leaseMs,
      this.clock.now(),
      leaseToken,
    );
    const email = renderEmail(batch.title, batch.contentMarkdown);
    const outcomes = await mapLimit(claimed, this.settings.concurrency, async (item) => {
      try {
        await this.emails.send({ to: item.email, ...email });
        return { item, error: null };
      } catch (error) {
        return { item, error: error instanceof Error ? error.message : 'Gửi email thất bại' };
      }
    });
    if (claimed.length === 0) await this.waitForNextItem(batchId);

    const mediaIds = batch.mediaUsageJobId ? extractMediaIds(batch.contentMarkdown) : [];
    await this.uow.run(async (stores) => {
      const registered: { notificationId: string; mediaIds: string[] }[] = [];
      for (const { item, error } of outcomes) {
        if (error !== null) {
          await stores.items.markFailure(
            item.id,
            leaseToken,
            error,
            this.settings.maxAttempts,
            (attempt) => retryDelayMs(this.settings.retryBaseMs, attempt),
            this.clock.now(),
          );
          continue;
        }
        const { notification, created } = await stores.notifications.createForBatch({
          id: this.ids.next(),
          studentId: item.studentId,
          title: batch.title,
          contentMarkdown: batch.contentMarkdown,
          sourceType: 'BULK',
          batchId,
          emailStatus: 'SENT',
          createdBy: batch.createdBy,
        });
        const marked = await stores.items.markSuccess(item.id, leaseToken, notification.id);
        if (marked && created && mediaIds.length > 0) {
          registered.push({ notificationId: notification.id, mediaIds });
        }
      }

      if (batch.mediaUsageJobId && registered.length > 0) {
        for (let offset = 0; offset < registered.length; offset += MEDIA_REGISTER_CHUNK) {
          await stores.commands.registerMediaUsageBatch(
            batch.mediaUsageJobId,
            registered.slice(offset, offset + MEDIA_REGISTER_CHUNK),
            batch.createdBy,
          );
        }
      }

      const counts = await stores.items.countByStatus(batchId);
      await stores.batches.update(batchId, {
        successCount: counts.success,
        failedCount: counts.failed,
        mediaUsageExpectedDelta: registered.length * mediaIds.length,
      });

      if (counts.pending + counts.processing + counts.retry > 0) {
        await stores.commands.requestBatchDispatch(batchId);
        return;
      }
      const finished = await stores.batches.transition(batchId, ['PROCESSING'], {
        status: finalBatchStatus(counts),
        completedAt: this.clock.now(),
      });
      if (!finished) return;
      const latest = await stores.batches.findById(batchId);
      if (latest?.mediaUsageJobId) {
        await stores.commands.completeMediaUsageJob(
          latest.mediaUsageJobId,
          latest.mediaUsageExpected,
        );
      }
    });
  }

  /** Chưa có item đến hạn (đang chờ backoff hoặc lease): chờ rồi mới phát lượt kế tiếp, tránh quay vòng nóng. */
  private async waitForNextItem(batchId: string): Promise<void> {
    const next = await this.uow.stores.items.nextClaimableAt(batchId);
    if (!next) return;
    const wait = Math.min(
      Math.max(0, next.getTime() - this.clock.now().getTime()),
      this.settings.maxIdleWaitMs,
    );
    if (wait > 0) await sleep(wait);
  }
}

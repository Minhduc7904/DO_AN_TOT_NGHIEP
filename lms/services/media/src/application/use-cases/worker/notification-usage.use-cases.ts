import type { IdGenerator } from '@aiops-lms/common/ports';

import { evaluateJobStatus } from '../../../domain/job-progress.js';
import type { MediaStores, MediaUnitOfWork } from '../../ports/unit-of-work.js';

const jobKey = (jobId: string): string => `notification-usage:${jobId}`;

/** Job theo dõi usage của một batch thông báo; các command tới khác queue nên có thể đảo thứ tự. */
async function ensureNotificationJob(
  stores: MediaStores,
  jobId: string,
  batchId?: string,
): Promise<void> {
  await stores.jobs.ensure({
    id: jobId,
    type: 'NOTIFICATION_USAGE',
    deduplicationKey: jobKey(jobId),
    referenceId: batchId ?? null,
    status: 'PROCESSING',
  });
}

async function reevaluate(stores: MediaStores, jobId: string): Promise<void> {
  const job = await stores.jobs.findById(jobId);
  if (!job) return;
  const status = evaluateJobStatus(job);
  if (status !== job.status) await stores.jobs.update(jobId, { status });
}

export interface RegisterNotificationUsageInput {
  jobId?: string | undefined;
  actorId: string;
  items: readonly { notificationId: string; mediaIds: readonly string[] }[];
}

/** Đăng ký usage `NOTIFICATION_BODY` (đơn hoặc theo lô). Media không tồn tại/chưa sẵn sàng tính lỗi. */
export class RegisterNotificationUsageUseCase {
  constructor(
    private readonly uow: MediaUnitOfWork,
    private readonly ids: IdGenerator,
  ) {}

  async execute(
    messageId: string,
    consumer: string,
    input: RegisterNotificationUsageInput,
  ): Promise<void> {
    await this.uow.runOnce(messageId, consumer, async (stores) => {
      let registered = 0;
      let failed = 0;
      for (const item of input.items) {
        const medias = await stores.media.findManyByIds(item.mediaIds);
        const ready = new Set(
          medias.filter((media) => media.status === 'READY').map((media) => media.id),
        );
        for (const mediaId of item.mediaIds) {
          if (!ready.has(mediaId)) {
            failed += 1;
            continue;
          }
          await stores.usages.create({
            id: this.ids.next(),
            mediaId,
            ownerKind: 'NOTIFICATION',
            ownerId: item.notificationId,
            usageType: 'NOTIFICATION_BODY',
            position: 0,
            createdBy: input.actorId,
          });
          registered += 1;
        }
      }
      if (input.jobId) {
        await ensureNotificationJob(stores, input.jobId);
        await stores.jobs.update(input.jobId, { processedDelta: registered, failedDelta: failed });
        await reevaluate(stores, input.jobId);
      }
    });
  }
}

export class StartNotificationUsageJobUseCase {
  constructor(private readonly uow: MediaUnitOfWork) {}

  async execute(
    messageId: string,
    consumer: string,
    input: { jobId: string; batchId: string },
  ): Promise<void> {
    await this.uow.runOnce(messageId, consumer, async (stores) => {
      await ensureNotificationJob(stores, input.jobId, input.batchId);
    });
  }
}

export class CompleteNotificationUsageJobUseCase {
  constructor(private readonly uow: MediaUnitOfWork) {}

  async execute(
    messageId: string,
    consumer: string,
    input: { jobId: string; expectedUsageCount: number },
  ): Promise<void> {
    await this.uow.runOnce(messageId, consumer, async (stores) => {
      await ensureNotificationJob(stores, input.jobId);
      await stores.jobs.update(input.jobId, { expectedCount: input.expectedUsageCount });
      await reevaluate(stores, input.jobId);
    });
  }
}

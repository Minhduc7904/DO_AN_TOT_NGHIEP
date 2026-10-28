import type { IdGenerator } from '@aiops-lms/common/ports';

import type { MediaUnitOfWork } from '../../ports/unit-of-work.js';

/** Xóa usage theo id khi course/lesson/quiz bị xóa; id không còn tồn tại thì bỏ qua. */
export class DeleteUsagesByIdsUseCase {
  constructor(
    private readonly uow: MediaUnitOfWork,
    private readonly ids: IdGenerator,
  ) {}

  async execute(messageId: string, consumer: string, usageIds: readonly string[]): Promise<void> {
    await this.uow.runOnce(messageId, consumer, async (stores) => {
      const job = await stores.jobs.ensure({
        id: this.ids.next(),
        type: 'MEDIA_USAGE_DELETE',
        deduplicationKey: `usage-delete:${messageId}`,
        status: 'PROCESSING',
      });
      const deleted = await stores.usages.deleteByIds(usageIds);
      await stores.jobs.update(job.id, { status: 'COMPLETED', processedDelta: deleted });
    });
  }
}

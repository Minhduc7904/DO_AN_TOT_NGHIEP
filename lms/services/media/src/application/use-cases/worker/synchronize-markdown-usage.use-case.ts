import { AppError } from '@aiops-lms/common/errors';
import type { IdGenerator } from '@aiops-lms/common/ports';

import { extractMediaIds } from '../../../domain/markdown-media.js';
import {
  type UsageOwnerKind,
  type UsageType,
  USAGE_TYPES_BY_OWNER,
} from '../../../domain/media.js';
import type { MediaUnitOfWork } from '../../ports/unit-of-work.js';

export interface SynchronizeMarkdownUsageInput {
  ownerKind: UsageOwnerKind;
  ownerId: string;
  usageType: UsageType;
  markdown: string | null;
  actorId: string;
}

/**
 * So khớp media tham chiếu trong markdown với usage hiện có của owner: thêm usage thiếu (chỉ media
 * `READY` có thật), xóa usage không còn được tham chiếu. Id không tồn tại/chưa sẵn sàng tính vào
 * `failed_count` và job thành `PARTIAL_FAILED`, không làm cả command lỗi.
 */
export class SynchronizeMarkdownUsageUseCase {
  constructor(
    private readonly uow: MediaUnitOfWork,
    private readonly ids: IdGenerator,
  ) {}

  async execute(
    messageId: string,
    consumer: string,
    input: SynchronizeMarkdownUsageInput,
  ): Promise<void> {
    if (!USAGE_TYPES_BY_OWNER[input.ownerKind].includes(input.usageType)) {
      throw AppError.validation('usage_type không khớp owner_kind');
    }
    await this.uow.runOnce(messageId, consumer, async (stores) => {
      const job = await stores.jobs.ensure({
        id: this.ids.next(),
        type: 'MARKDOWN_USAGE_SYNC',
        deduplicationKey: `markdown-sync:${messageId}`,
        referenceId: input.ownerId,
        status: 'PROCESSING',
      });
      const group = {
        ownerKind: input.ownerKind,
        ownerId: input.ownerId,
        usageType: input.usageType,
      };
      const referenced = extractMediaIds(input.markdown);
      const current = await stores.usages.listByGroup(group);

      const stale = current.filter((usage) => !referenced.includes(usage.mediaId));
      if (stale.length > 0) await stores.usages.deleteByIds(stale.map((usage) => usage.id));

      const present = new Set(current.map((usage) => usage.mediaId));
      const missing = referenced.filter((id) => !present.has(id));
      const medias = await stores.media.findManyByIds(missing);
      const ready = medias.filter((media) => media.status === 'READY');
      let position = await stores.usages.nextPosition(group);
      for (const media of ready) {
        await stores.usages.create({
          id: this.ids.next(),
          mediaId: media.id,
          ...group,
          position: position++,
          createdBy: input.actorId,
        });
      }
      const failed = missing.length - ready.length;
      await stores.jobs.update(job.id, {
        status: failed > 0 ? 'PARTIAL_FAILED' : 'COMPLETED',
        processedDelta: stale.length + ready.length,
        failedDelta: failed,
        lastError: failed > 0 ? `${failed} media không tồn tại hoặc chưa sẵn sàng` : null,
      });
    });
  }
}

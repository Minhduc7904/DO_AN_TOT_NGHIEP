import type { MediaObject, MediaUsage, UsageOwnerKind, UsageType } from '../../../domain/media.js';
import type { MediaUnitOfWork } from '../../ports/unit-of-work.js';

export interface OwnerUsage {
  usage: MediaUsage;
  media: MediaObject;
}

/**
 * `course` liệt kê usage của một owner (ví dụ tệp `LESSON_ATTACHMENT` của bài học) kèm metadata tệp,
 * theo `position`. Bỏ qua usage mà media đã bị xóa mềm.
 */
export class ListOwnerUsagesUseCase {
  constructor(private readonly uow: MediaUnitOfWork) {}

  async execute(
    ownerKind: UsageOwnerKind,
    ownerId: string,
    usageType: UsageType,
  ): Promise<OwnerUsage[]> {
    const usages = await this.uow.stores.usages.listByGroup({ ownerKind, ownerId, usageType });
    const medias = await this.uow.stores.media.findManyByIds(usages.map((usage) => usage.mediaId));
    const byId = new Map(medias.map((media) => [media.id, media]));
    const result: OwnerUsage[] = [];
    for (const usage of usages) {
      const media = byId.get(usage.mediaId);
      if (media) result.push({ usage, media });
    }
    return result;
  }
}

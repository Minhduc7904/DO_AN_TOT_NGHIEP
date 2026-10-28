import type { UsageOwnerKind } from '../../../domain/media.js';
import type { MediaUnitOfWork } from '../../ports/unit-of-work.js';

/** `course` hỏi usage id theo owner (ví dụ trước khi xóa khóa học) để gửi command xóa. */
export class QueryUsageIdsUseCase {
  constructor(private readonly uow: MediaUnitOfWork) {}

  async execute(
    kind: UsageOwnerKind,
    ownerIds: readonly string[],
  ): Promise<{ ownerId: string; usageIds: string[] }[]> {
    const usages = await this.uow.stores.usages.listByOwners(kind, ownerIds);
    return ownerIds.map((ownerId) => ({
      ownerId,
      usageIds: usages.filter((usage) => usage.ownerId === ownerId).map((usage) => usage.id),
    }));
  }
}

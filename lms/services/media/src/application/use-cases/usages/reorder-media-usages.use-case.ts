import { AppError } from '@aiops-lms/common/errors';
import type { Principal } from '@aiops-lms/common/ports';

import type { MediaUsage, UsageOwnerKind, UsageType } from '../../../domain/media.js';
import type { MediaUnitOfWork } from '../../ports/unit-of-work.js';
import type { UsageRules } from './usage-attacher.js';

export interface ReorderUsagesInput {
  ownerKind: UsageOwnerKind;
  ownerId: string;
  usageType: UsageType;
  usageIds: readonly string[];
}

export class ReorderMediaUsagesUseCase {
  constructor(
    private readonly uow: MediaUnitOfWork,
    private readonly rules: UsageRules,
  ) {}

  execute(principal: Principal, input: ReorderUsagesInput): Promise<MediaUsage[]> {
    this.rules.assertCanManageOwner(principal, input.ownerKind, input.ownerId);
    const group = {
      ownerKind: input.ownerKind,
      ownerId: input.ownerId,
      usageType: input.usageType,
    };
    return this.uow.run(async (stores) => {
      const current = await stores.usages.listByGroup(group);
      if (principal.role !== 'admin' && current.some((usage) => usage.createdBy !== principal.id)) {
        throw AppError.forbidden();
      }
      const wanted = new Set(input.usageIds);
      const same =
        wanted.size === input.usageIds.length &&
        current.length === wanted.size &&
        current.every((usage) => wanted.has(usage.id));
      if (!same) {
        throw AppError.validation('usage_ids phải là danh sách đầy đủ usage của nhóm, không trùng');
      }
      return stores.usages.reorder(group, input.usageIds);
    });
  }
}

import { AppError } from '@aiops-lms/common/errors';
import type { Principal } from '@aiops-lms/common/ports';

import type { MediaUnitOfWork } from '../../ports/unit-of-work.js';
import type { UsageRules } from './usage-attacher.js';

export class DeleteMediaUsageUseCase {
  constructor(
    private readonly uow: MediaUnitOfWork,
    private readonly rules: UsageRules,
  ) {}

  async execute(principal: Principal, usageId: string): Promise<void> {
    const usage = await this.uow.stores.usages.findById(usageId);
    if (!usage) throw AppError.notFound('Không tìm thấy usage');
    this.rules.assertCanManageOwner(principal, usage.ownerKind, usage.ownerId);
    // `media` không biết ai sở hữu course: chỉ người tạo usage (hoặc admin) được gỡ nó.
    if (principal.role !== 'admin' && usage.createdBy !== principal.id) throw AppError.forbidden();
    await this.uow.stores.usages.deleteByIds([usage.id]);
  }
}

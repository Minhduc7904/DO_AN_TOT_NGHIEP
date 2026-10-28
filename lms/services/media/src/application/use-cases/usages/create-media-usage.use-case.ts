import type { Principal } from '@aiops-lms/common/ports';

import type { MediaUsage } from '../../../domain/media.js';
import type { MediaUnitOfWork } from '../../ports/unit-of-work.js';
import type { AttachUsageInput, UsageRules } from './usage-attacher.js';

export class CreateMediaUsageUseCase {
  constructor(
    private readonly uow: MediaUnitOfWork,
    private readonly rules: UsageRules,
  ) {}

  execute(principal: Principal, input: AttachUsageInput): Promise<MediaUsage> {
    return this.uow.run((stores) => this.rules.attach(stores, principal, input));
  }
}

/** Tạo nhiều usage trong một transaction: một mục sai thì không mục nào được tạo. */
export class CreateMediaUsagesUseCase {
  constructor(
    private readonly uow: MediaUnitOfWork,
    private readonly rules: UsageRules,
  ) {}

  execute(principal: Principal, inputs: readonly AttachUsageInput[]): Promise<MediaUsage[]> {
    return this.uow.run(async (stores) => {
      const created: MediaUsage[] = [];
      for (const input of inputs) created.push(await this.rules.attach(stores, principal, input));
      return created;
    });
  }
}

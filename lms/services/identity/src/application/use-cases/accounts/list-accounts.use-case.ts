import type { Role } from '@aiops-lms/common/ports';

import type { Account } from '../../../domain/account.js';
import type { AccountRepository } from '../../ports/account-repository.js';

export class ListAccountsUseCase {
  constructor(private readonly accounts: AccountRepository) {}

  execute(
    filter: { role?: Role },
    page: number,
    pageSize: number,
  ): Promise<{ items: Account[]; total: number }> {
    return this.accounts.list(filter, page, pageSize);
  }
}

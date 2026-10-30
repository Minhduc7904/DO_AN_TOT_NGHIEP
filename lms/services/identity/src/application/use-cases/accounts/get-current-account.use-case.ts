import { AppError } from '@aiops-lms/common/errors';

import type { Account } from '../../../domain/account.js';
import type { AccountRepository } from '../../ports/account-repository.js';

export class GetCurrentAccountUseCase {
  constructor(private readonly accounts: AccountRepository) {}

  async execute(accountId: string): Promise<Account> {
    const account = await this.accounts.findById(accountId);
    if (!account || account.status !== 'ACTIVE') throw AppError.unauthorized();
    return account;
  }
}

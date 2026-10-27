import type { Role } from '@aiops-lms/common/ports';

import { hashPassword } from '../../../domain/password.js';
import type { AccountRepository } from '../../ports/account-repository.js';

export interface BootstrapAccount {
  id: string;
  email: string;
  password: string;
  fullName: string;
  role: Role;
  createdAt?: Date;
}

/**
 * Seed tài khoản cố định khi khởi động (admin có `id` trùng cấu hình service `admin`, instructor
 * mẫu). Idempotent theo email: tài khoản đã có không bị ghi đè.
 */
export class BootstrapAccountsUseCase {
  constructor(private readonly accounts: AccountRepository) {}

  async execute(seeds: BootstrapAccount[]): Promise<{ created: string[] }> {
    const created: string[] = [];
    for (const seed of seeds) {
      const inserted = await this.accounts.ensure({
        id: seed.id,
        email: seed.email.trim().toLowerCase(),
        passwordHash: await hashPassword(seed.password),
        fullName: seed.fullName,
        role: seed.role,
        ...(seed.createdAt ? { createdAt: seed.createdAt } : {}),
      });
      if (inserted) created.push(seed.email);
    }
    return { created };
  }
}

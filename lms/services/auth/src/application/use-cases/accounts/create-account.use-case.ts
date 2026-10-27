import { AppError } from '@aiops-lms/common/errors';
import { randomUUID } from 'node:crypto';

import { hashPassword } from '../../../domain/password.js';
import type { Account } from '../../../domain/account.js';
import type { AccountRepository } from '../../ports/account-repository.js';

export interface CreateAccountInput {
  email: string;
  password: string;
  fullName: string;
  role: 'instructor' | 'admin';
}

/** Admin tạo tài khoản instructor hoặc admin (student tự đăng ký). */
export class CreateAccountUseCase {
  constructor(private readonly accounts: AccountRepository) {}

  async execute(input: CreateAccountInput): Promise<Account> {
    const account = await this.accounts.create({
      id: randomUUID(),
      email: input.email.trim().toLowerCase(),
      passwordHash: await hashPassword(input.password),
      fullName: input.fullName.trim(),
      role: input.role,
    });
    if (!account) throw AppError.conflict('Email đã được đăng ký');
    return account;
  }
}

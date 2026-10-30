import { AppError } from '@aiops-lms/common/errors';
import { randomUUID } from 'node:crypto';

import { hashPassword } from '../../../domain/password.js';
import type { Account } from '../../../domain/account.js';
import type { AccountRepository } from '../../ports/account-repository.js';

export interface RegisterStudentInput {
  email: string;
  password: string;
  fullName: string;
}

/**
 * Đăng ký student: tài khoản và hồ sơ student được tạo trong một transaction của `identity`, nên
 * lỗi ở bước nào cũng không để lại tài khoản không có hồ sơ. Email trùng (ràng buộc duy nhất của
 * DB, kể cả hai đăng ký đồng thời) trả 409.
 */
export class RegisterStudentUseCase {
  constructor(private readonly accounts: AccountRepository) {}

  async execute(input: RegisterStudentInput): Promise<Account> {
    const account = await this.accounts.createStudent({
      id: randomUUID(),
      email: input.email.trim().toLowerCase(),
      passwordHash: await hashPassword(input.password),
      fullName: input.fullName.trim(),
    });
    if (!account) throw AppError.conflict('Email đã được đăng ký');
    return account;
  }
}

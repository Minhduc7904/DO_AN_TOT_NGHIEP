import { AppError } from '@aiops-lms/common/errors';
import { randomUUID } from 'node:crypto';

import { hashPassword } from '../../../domain/password.js';
import type { Account } from '../../../domain/account.js';
import type { AccountRepository } from '../../ports/account-repository.js';
import type { StudentProfileClient } from '../../ports/student-profile-client.js';

export interface RegisterStudentInput {
  email: string;
  password: string;
  fullName: string;
}

/**
 * Đăng ký student: tạo tài khoản rồi tạo hồ sơ ở `student` với cùng `id`. Nếu `student` lỗi thì
 * xóa tài khoản vừa tạo để không để lại tài khoản không có hồ sơ (bù trừ, không có transaction
 * xuyên service).
 */
export class RegisterStudentUseCase {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly students: StudentProfileClient,
  ) {}

  async execute(input: RegisterStudentInput): Promise<Account> {
    const email = input.email.trim().toLowerCase();
    const account = await this.accounts.create({
      id: randomUUID(),
      email,
      passwordHash: await hashPassword(input.password),
      fullName: input.fullName.trim(),
      role: 'student',
    });
    if (!account) throw AppError.conflict('Email đã được đăng ký');

    try {
      await this.students.create({ id: account.id, email, fullName: account.fullName });
    } catch (error) {
      await this.accounts.delete(account.id);
      throw error;
    }
    return account;
  }
}

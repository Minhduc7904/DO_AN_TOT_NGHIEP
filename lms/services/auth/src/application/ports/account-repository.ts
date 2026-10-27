import type { Role } from '@aiops-lms/common/ports';

import type { Account, AccountCredentials } from '../../domain/account.js';

export interface NewAccount {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: Role;
  /** Chỉ dùng cho seed cần mốc thời gian cố định (fingerprint reset/seed). */
  createdAt?: Date;
}

export interface AccountRepository {
  /** Trả `null` khi email hoặc id đã tồn tại. */
  create(account: NewAccount): Promise<Account | null>;
  delete(id: string): Promise<void>;
  findCredentialsByEmail(email: string): Promise<AccountCredentials | null>;
  findById(id: string): Promise<Account | null>;
  list(
    filter: { role?: Role },
    page: number,
    pageSize: number,
  ): Promise<{ items: Account[]; total: number }>;
  /** Tạo tài khoản nếu chưa có email này (seed khởi động); trả `true` khi tạo mới. */
  ensure(account: NewAccount): Promise<boolean>;
  ping(): Promise<void>;
}

export const ACCOUNT_REPOSITORY = Symbol('AccountRepository');

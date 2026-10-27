import type { Role } from '@aiops-lms/common/ports';

export type AccountStatus = 'ACTIVE' | 'DISABLED';

export interface Account {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  status: AccountStatus;
  createdAt: Date;
}

/** Tài khoản kèm mật khẩu băm; chỉ dùng trong luồng đăng nhập. */
export interface AccountCredentials extends Account {
  passwordHash: string;
}

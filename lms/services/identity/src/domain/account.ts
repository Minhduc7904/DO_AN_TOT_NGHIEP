import type { Role } from '@aiops-lms/common/ports';

import type { StudentStatus } from './student.js';

export type AccountStatus = 'ACTIVE' | 'DISABLED';

export interface Account {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  status: AccountStatus;
  createdAt: Date;
}

/**
 * Tài khoản kèm mật khẩu băm và trạng thái hồ sơ student (`null` với instructor/admin); chỉ dùng
 * trong luồng đăng nhập.
 */
export interface AccountCredentials extends Account {
  passwordHash: string;
  studentStatus: StudentStatus | null;
}

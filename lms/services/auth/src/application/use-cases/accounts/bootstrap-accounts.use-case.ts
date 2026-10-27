import type { Role } from '@aiops-lms/common/ports';

import { hashPassword } from '../../../domain/password.js';
import type { AccountRepository } from '../../ports/account-repository.js';
import type { StudentProfileClient } from '../../ports/student-profile-client.js';

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
 * mẫu, student mẫu). Idempotent theo email: tài khoản đã có không bị ghi đè. Tài khoản student seed
 * luôn được bảo đảm có hồ sơ ở `student`, nếu không đăng nhập sẽ bị từ chối.
 */
export class BootstrapAccountsUseCase {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly students: StudentProfileClient,
  ) {}

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
      if (seed.role === 'student') await this.ensureStudentProfile(seed);
    }
    return { created };
  }

  private async ensureStudentProfile(seed: BootstrapAccount): Promise<void> {
    if ((await this.students.findStatus(seed.id)) !== null) return;
    await this.students.create({
      id: seed.id,
      email: seed.email.trim().toLowerCase(),
      fullName: seed.fullName,
    });
  }
}

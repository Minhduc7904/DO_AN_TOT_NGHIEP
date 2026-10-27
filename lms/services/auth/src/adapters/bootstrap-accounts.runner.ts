import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  BootstrapAccountsUseCase,
  type BootstrapAccount,
} from '../application/use-cases/accounts/bootstrap-accounts.use-case.js';

// Mốc cố định để dữ liệu seed cho cùng fingerprint ở mọi lần reset.
const SEED_CREATED_AT = new Date('2026-08-27T09:00:00Z');

/** Đọc cấu hình seed từ môi trường và chạy use case khi service khởi động. */
@Injectable()
export class BootstrapAccountsRunner implements OnApplicationBootstrap {
  private readonly logger = new Logger(BootstrapAccountsRunner.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(BootstrapAccountsUseCase) private readonly bootstrap: BootstrapAccountsUseCase,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const seeds = [
      this.seed('ADMIN', 'admin', 'Quản trị viên'),
      this.seed('INSTRUCTOR', 'instructor', 'Giảng viên mẫu'),
      this.seed('STUDENT', 'student', 'Học viên mẫu'),
    ].filter((seed): seed is BootstrapAccount => seed !== undefined);
    if (seeds.length === 0) return;

    const { created } = await this.bootstrap.execute(seeds);
    if (created.length > 0) this.logger.log(`Đã seed ${created.length} tài khoản khởi tạo`);
  }

  private seed(
    prefix: 'ADMIN' | 'INSTRUCTOR' | 'STUDENT',
    role: BootstrapAccount['role'],
    fullName: string,
  ): BootstrapAccount | undefined {
    const email = this.config.get<string>(`AUTH_BOOTSTRAP_${prefix}_EMAIL`);
    const password = this.config.get<string>(`AUTH_BOOTSTRAP_${prefix}_PASSWORD`);
    if (!email || !password) return undefined;
    return {
      id: this.config.getOrThrow<string>(`AUTH_BOOTSTRAP_${prefix}_ID`),
      email,
      password,
      fullName,
      role,
      createdAt: SEED_CREATED_AT,
    };
  }
}

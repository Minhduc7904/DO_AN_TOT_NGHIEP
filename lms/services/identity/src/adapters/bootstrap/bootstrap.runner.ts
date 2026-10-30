import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  BootstrapAccountsUseCase,
  type BootstrapAccount,
} from '../../application/use-cases/accounts/bootstrap-accounts.use-case.js';
import {
  BootstrapServiceClientsUseCase,
  type BootstrapServiceClient,
} from '../../application/use-cases/service-auth/bootstrap-service-clients.use-case.js';

// Mốc cố định để dữ liệu seed cho cùng fingerprint ở mọi lần reset.
const SEED_CREATED_AT = new Date('2026-08-27T09:00:00Z');

/**
 * Seed trước khi service listen, theo thứ tự cố định: client dịch vụ trước, tài khoản sau. Mọi dữ
 * liệu (kể cả hồ sơ student của tài khoản student seed) nằm trong DB của chính service nên không
 * cần chờ service nào khác; seed lỗi thì khởi động lỗi.
 */
@Injectable()
export class BootstrapRunner implements OnApplicationBootstrap {
  private readonly logger = new Logger(BootstrapRunner.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(BootstrapServiceClientsUseCase)
    private readonly bootstrapClients: BootstrapServiceClientsUseCase,
    @Inject(BootstrapAccountsUseCase) private readonly bootstrapAccounts: BootstrapAccountsUseCase,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.seedServiceClients();
    await this.seedAccounts();
  }

  private async seedServiceClients(): Promise<void> {
    const clients = this.config.getOrThrow<BootstrapServiceClient[]>('SERVICE_CLIENTS_BOOTSTRAP');
    if (clients.length === 0) return;
    const { written } = await this.bootstrapClients.execute(clients);
    if (written.length > 0) this.logger.log(`Đã đồng bộ ${written.length} client dịch vụ`);
  }

  private async seedAccounts(): Promise<void> {
    const seeds = [
      this.seed('ADMIN', 'admin', 'Quản trị viên'),
      this.seed('INSTRUCTOR', 'instructor', 'Giảng viên mẫu'),
      this.seed('STUDENT', 'student', 'Học viên mẫu'),
    ].filter((seed): seed is BootstrapAccount => seed !== undefined);
    if (seeds.length === 0) return;

    const { created } = await this.bootstrapAccounts.execute(seeds);
    if (created.length > 0) this.logger.log(`Đã seed ${created.length} tài khoản khởi tạo`);
  }

  private seed(
    prefix: 'ADMIN' | 'INSTRUCTOR' | 'STUDENT',
    role: BootstrapAccount['role'],
    fullName: string,
  ): BootstrapAccount | undefined {
    const email = this.config.get<string>(`IDENTITY_BOOTSTRAP_${prefix}_EMAIL`);
    const password = this.config.get<string>(`IDENTITY_BOOTSTRAP_${prefix}_PASSWORD`);
    if (!email || !password) return undefined;
    return {
      id: this.config.getOrThrow<string>(`IDENTITY_BOOTSTRAP_${prefix}_ID`),
      email,
      password,
      fullName,
      role,
      createdAt: SEED_CREATED_AT,
    };
  }
}

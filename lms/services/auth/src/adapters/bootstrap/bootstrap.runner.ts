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

const ACCOUNT_SEED_RETRY_DELAY_MS = 1_000;
const ACCOUNT_SEED_MAX_ATTEMPTS = 60;

/**
 * Seed theo thứ tự cố định: client dịch vụ trước (để auth tự xin được token gọi student), tài
 * khoản sau. Tài khoản chỉ seed được khi auth đã listen, vì student verify service token của auth
 * bằng JWKS do chính auth phục vụ; nên seed tài khoản chạy nền sau `listen` (`startAccountSeeding`)
 * và `/ready` chỉ báo sẵn sàng khi seed xong.
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

  private accountsSeeded = false;
  private accountSeeding: Promise<void> | undefined;

  async onApplicationBootstrap(): Promise<void> {
    await this.seedServiceClients();
  }

  /** Gọi sau khi HTTP server đã listen. Thử lại vì student có thể chưa lấy được JWKS ngay. */
  startAccountSeeding(): Promise<void> {
    this.accountSeeding ??= this.seedAccountsWithRetry();
    return this.accountSeeding;
  }

  /** Readiness check: lỗi cho tới khi tài khoản khởi tạo đã được seed. */
  ensureAccountsSeeded(): Promise<void> {
    return this.accountsSeeded
      ? Promise.resolve()
      : Promise.reject(new Error('Tài khoản khởi tạo chưa seed xong'));
  }

  private async seedAccountsWithRetry(): Promise<void> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        await this.seedAccounts();
        this.accountsSeeded = true;
        return;
      } catch (error) {
        if (attempt >= ACCOUNT_SEED_MAX_ATTEMPTS) {
          this.logger.error(
            'Seed tài khoản khởi tạo thất bại, service giữ trạng thái chưa sẵn sàng',
          );
          return;
        }
        this.logger.warn(
          `Seed tài khoản lần ${attempt} lỗi (${error instanceof Error ? error.message : 'unknown'}), thử lại`,
        );
        await new Promise((resolve) => setTimeout(resolve, ACCOUNT_SEED_RETRY_DELAY_MS));
      }
    }
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

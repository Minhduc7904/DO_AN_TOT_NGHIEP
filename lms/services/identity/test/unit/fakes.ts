import type { Role } from '@aiops-lms/common/ports';

import type { Account, AccountCredentials } from '../../src/domain/account.js';
import type {
  AccountRepository,
  NewAccount,
} from '../../src/application/ports/account-repository.js';
import type { ServiceClient } from '../../src/domain/service-client.js';
import type { ServiceClientRepository } from '../../src/application/ports/service-client-repository.js';
import type { RefreshTokenRepository } from '../../src/application/ports/refresh-token-repository.js';
import type { StudentRepository } from '../../src/application/ports/student-repository.js';
import type { Student, StudentStatus } from '../../src/domain/student.js';

interface InMemoryProfile {
  status: StudentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class InMemoryAccounts implements AccountRepository {
  readonly rows = new Map<string, AccountCredentials>();
  /** Hồ sơ student theo id tài khoản (bản thật là bảng `identity_student_profiles`). */
  readonly profiles = new Map<string, InMemoryProfile>();
  /** Giả lập lỗi khi chèn hồ sơ: transaction thật hoàn tác luôn cả tài khoản. */
  failProfileInsert = false;

  private duplicate(account: { id: string; email: string }): boolean {
    return [...this.rows.values()].some(
      (row) => row.id === account.id || row.email === account.email,
    );
  }

  private insert(account: NewAccount): AccountCredentials {
    const row: AccountCredentials = {
      id: account.id,
      email: account.email,
      passwordHash: account.passwordHash,
      fullName: account.fullName,
      role: account.role,
      status: 'ACTIVE',
      createdAt: account.createdAt ?? new Date('2026-11-02T00:00:00Z'),
      studentStatus: null,
    };
    this.rows.set(row.id, row);
    return row;
  }

  private insertProfile(id: string): void {
    const now = new Date('2026-11-02T00:00:00Z');
    this.profiles.set(id, { status: 'ACTIVE', createdAt: now, updatedAt: now });
  }

  create(account: NewAccount): Promise<Account | null> {
    if (this.duplicate(account)) return Promise.resolve(null);
    return Promise.resolve(this.insert(account));
  }

  createStudent(account: Omit<NewAccount, 'role'>): Promise<Account | null> {
    if (this.duplicate(account)) return Promise.resolve(null);
    // Mô phỏng transaction: lỗi chèn hồ sơ thì chưa có gì được ghi.
    if (this.failProfileInsert) return Promise.reject(new Error('profile insert failed'));
    const row = this.insert({ ...account, role: 'student' });
    this.insertProfile(row.id);
    return Promise.resolve(row);
  }

  findCredentialsByEmail(email: string): Promise<AccountCredentials | null> {
    const row = [...this.rows.values()].find((item) => item.email === email);
    return Promise.resolve(
      row ? { ...row, studentStatus: this.profiles.get(row.id)?.status ?? null } : null,
    );
  }

  findById(id: string): Promise<Account | null> {
    return Promise.resolve(this.rows.get(id) ?? null);
  }

  list(
    filter: { role?: Role },
    page: number,
    pageSize: number,
  ): Promise<{ items: Account[]; total: number }> {
    const all = [...this.rows.values()].filter((row) => !filter.role || row.role === filter.role);
    return Promise.resolve({
      items: all.slice((page - 1) * pageSize, page * pageSize),
      total: all.length,
    });
  }

  ensure(account: NewAccount): Promise<boolean> {
    const existing = [...this.rows.values()].some((row) => row.email === account.email);
    const created = !existing && !this.duplicate(account);
    if (created) this.insert(account);
    if (account.role === 'student' && this.rows.has(account.id) && !this.profiles.has(account.id)) {
      this.insertProfile(account.id);
    }
    return Promise.resolve(created);
  }

  ping(): Promise<void> {
    return Promise.resolve();
  }
}

/** Đọc hồ sơ student ghép với tài khoản, như `PrismaStudentRepository`. */
export class InMemoryStudents implements StudentRepository {
  constructor(private readonly accounts: InMemoryAccounts) {}

  private all(): Student[] {
    return [...this.accounts.profiles.entries()].flatMap(([id, profile]) => {
      const account = this.accounts.rows.get(id);
      return account
        ? [
            {
              id,
              email: account.email,
              fullName: account.fullName,
              status: profile.status,
              createdAt: profile.createdAt,
              updatedAt: profile.updatedAt,
            },
          ]
        : [];
    });
  }

  findById(id: string): Promise<Student | null> {
    return Promise.resolve(this.all().find((student) => student.id === id) ?? null);
  }

  list(
    page: number,
    pageSize: number,
    status?: Student['status'],
  ): Promise<{ items: Student[]; total: number }> {
    const matching = this.all()
      .filter((student) => !status || student.status === status)
      .sort((left, right) => left.id.localeCompare(right.id));
    return Promise.resolve({
      items: matching.slice((page - 1) * pageSize, page * pageSize),
      total: matching.length,
    });
  }
}

export class InMemoryRefreshTokens implements RefreshTokenRepository {
  readonly tokens = new Map<string, { userId: string; expiresAt: Date }>();

  constructor(private readonly accounts: InMemoryAccounts) {}

  save(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    this.tokens.set(tokenHash, { userId, expiresAt });
    return Promise.resolve();
  }

  consume(tokenHash: string): Promise<Account | null> {
    const token = this.tokens.get(tokenHash);
    this.tokens.delete(tokenHash);
    if (!token || token.expiresAt.getTime() <= Date.now()) return Promise.resolve(null);
    return this.accounts.findById(token.userId);
  }
}

export class InMemoryServiceClients implements ServiceClientRepository {
  readonly rows = new Map<string, ServiceClient>();
  upserts = 0;

  findById(clientId: string): Promise<ServiceClient | null> {
    return Promise.resolve(this.rows.get(clientId) ?? null);
  }

  upsert(client: ServiceClient): Promise<void> {
    this.upserts += 1;
    this.rows.set(client.clientId, client);
    return Promise.resolve();
  }
}

export const TOKEN_SETTINGS = {
  jwtTtlSeconds: 3_600,
  refreshTtlSeconds: 86_400,
  serviceTokenTtlSeconds: 600,
};

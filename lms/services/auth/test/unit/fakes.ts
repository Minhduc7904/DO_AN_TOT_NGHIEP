import type { Role } from '@aiops-lms/common/ports';

import type { Account, AccountCredentials } from '../../src/domain/account.js';
import type {
  AccountRepository,
  NewAccount,
} from '../../src/application/ports/account-repository.js';
import type { RefreshTokenRepository } from '../../src/application/ports/refresh-token-repository.js';
import type {
  StudentProfile,
  StudentProfileClient,
} from '../../src/application/ports/student-profile-client.js';

export class InMemoryAccounts implements AccountRepository {
  readonly rows = new Map<string, AccountCredentials>();

  create(account: NewAccount): Promise<Account | null> {
    const duplicate = [...this.rows.values()].some(
      (row) => row.id === account.id || row.email === account.email,
    );
    if (duplicate) return Promise.resolve(null);
    const row: AccountCredentials = {
      id: account.id,
      email: account.email,
      passwordHash: account.passwordHash,
      fullName: account.fullName,
      role: account.role,
      status: 'ACTIVE',
      createdAt: new Date('2026-11-02T00:00:00Z'),
    };
    this.rows.set(row.id, row);
    return Promise.resolve(row);
  }

  delete(id: string): Promise<void> {
    this.rows.delete(id);
    return Promise.resolve();
  }

  findCredentialsByEmail(email: string): Promise<AccountCredentials | null> {
    return Promise.resolve([...this.rows.values()].find((row) => row.email === email) ?? null);
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

  async ensure(account: NewAccount): Promise<boolean> {
    if ([...this.rows.values()].some((row) => row.email === account.email)) return false;
    return (await this.create(account)) !== null;
  }

  ping(): Promise<void> {
    return Promise.resolve();
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

export class RecordingStudentClient implements StudentProfileClient {
  readonly created: StudentProfile[] = [];
  failure: Error | undefined;

  create(profile: StudentProfile): Promise<void> {
    if (this.failure) return Promise.reject(this.failure);
    this.created.push(profile);
    return Promise.resolve();
  }
}

export const TOKEN_SETTINGS = {
  jwtSecret: 'unit-test-secret-with-at-least-32-characters',
  jwtTtlSeconds: 3_600,
  refreshTtlSeconds: 86_400,
};

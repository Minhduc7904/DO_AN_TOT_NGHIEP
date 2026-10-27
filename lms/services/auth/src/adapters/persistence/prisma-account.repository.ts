import type { Role } from '@aiops-lms/common/ports';
import { observeDependency } from '@aiops-lms/common/telemetry';
import { Injectable } from '@nestjs/common';

import type { Account, AccountCredentials } from '../../domain/account.js';
import type { AccountRepository, NewAccount } from '../../application/ports/account-repository.js';
import type { AuthUser, AuthRole } from './generated/client.js';
import { PrismaService } from './prisma.service.js';

const DEPENDENCY = 'auth-postgres';
const ATTRIBUTES = { 'db.system.name': 'postgresql' };
const UNIQUE_VIOLATION = 'P2002';

const ROLE_TO_DB: Record<Role, AuthRole> = {
  student: 'STUDENT',
  instructor: 'INSTRUCTOR',
  admin: 'ADMIN',
};
const ROLE_FROM_DB: Record<AuthRole, Role> = {
  STUDENT: 'student',
  INSTRUCTOR: 'instructor',
  ADMIN: 'admin',
};

function toAccount(row: AuthUser): Account {
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    role: ROLE_FROM_DB[row.role],
    status: row.status,
    createdAt: row.createdAt,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === UNIQUE_VIOLATION;
}

@Injectable()
export class PrismaAccountRepository implements AccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(account: NewAccount): Promise<Account | null> {
    return observeDependency(
      DEPENDENCY,
      'account.create',
      async () => {
        try {
          return toAccount(
            await this.prisma.authUser.create({
              data: { ...account, role: ROLE_TO_DB[account.role] },
            }),
          );
        } catch (error) {
          if (isUniqueViolation(error)) return null;
          throw error;
        }
      },
      { attributes: ATTRIBUTES },
    );
  }

  delete(id: string): Promise<void> {
    return observeDependency(
      DEPENDENCY,
      'account.delete',
      async () => {
        await this.prisma.authUser.deleteMany({ where: { id } });
      },
      { attributes: ATTRIBUTES },
    );
  }

  findCredentialsByEmail(email: string): Promise<AccountCredentials | null> {
    return observeDependency(
      DEPENDENCY,
      'account.find-by-email',
      async () => {
        const row = await this.prisma.authUser.findUnique({ where: { email } });
        return row ? { ...toAccount(row), passwordHash: row.passwordHash } : null;
      },
      { attributes: ATTRIBUTES },
    );
  }

  findById(id: string): Promise<Account | null> {
    return observeDependency(
      DEPENDENCY,
      'account.find-by-id',
      async () => {
        const row = await this.prisma.authUser.findUnique({ where: { id } });
        return row ? toAccount(row) : null;
      },
      { attributes: ATTRIBUTES },
    );
  }

  list(
    filter: { role?: Role },
    page: number,
    pageSize: number,
  ): Promise<{ items: Account[]; total: number }> {
    return observeDependency(
      DEPENDENCY,
      'account.list',
      async () => {
        const where = filter.role ? { role: ROLE_TO_DB[filter.role] } : {};
        const [rows, total] = await Promise.all([
          this.prisma.authUser.findMany({
            where,
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
          this.prisma.authUser.count({ where }),
        ]);
        return { items: rows.map(toAccount), total };
      },
      { attributes: ATTRIBUTES },
    );
  }

  ensure(account: NewAccount): Promise<boolean> {
    return observeDependency(
      DEPENDENCY,
      'account.ensure',
      async () => {
        const result = await this.prisma.authUser.createMany({
          data: [{ ...account, role: ROLE_TO_DB[account.role] }],
          skipDuplicates: true,
        });
        return result.count > 0;
      },
      { attributes: ATTRIBUTES },
    );
  }

  async ping(): Promise<void> {
    await this.prisma.ping();
  }
}

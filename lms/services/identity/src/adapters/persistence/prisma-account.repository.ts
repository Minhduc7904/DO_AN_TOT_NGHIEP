import type { Role } from '@aiops-lms/common/ports';
import { observeDependency } from '@aiops-lms/common/telemetry';
import { Injectable } from '@nestjs/common';

import type { Account, AccountCredentials } from '../../domain/account.js';
import type { AccountRepository, NewAccount } from '../../application/ports/account-repository.js';
import type { AccountRole, User } from './generated/client.js';
import { PrismaService } from './prisma.service.js';

const DEPENDENCY = 'identity-postgres';
const ATTRIBUTES = { 'db.system.name': 'postgresql' };
const UNIQUE_VIOLATION = 'P2002';

const ROLE_TO_DB: Record<Role, AccountRole> = {
  student: 'STUDENT',
  instructor: 'INSTRUCTOR',
  admin: 'ADMIN',
};
const ROLE_FROM_DB: Record<AccountRole, Role> = {
  STUDENT: 'student',
  INSTRUCTOR: 'instructor',
  ADMIN: 'admin',
};

function toAccount(row: User): Account {
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
            await this.prisma.user.create({
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

  createStudent(account: Omit<NewAccount, 'role'>): Promise<Account | null> {
    return observeDependency(
      DEPENDENCY,
      'account.create-student',
      async () => {
        try {
          // Tài khoản và hồ sơ cùng một transaction: lỗi ở bất kỳ bước nào đều không để lại gì.
          return await this.prisma.$transaction(async (tx) => {
            const user = await tx.user.create({ data: { ...account, role: 'STUDENT' } });
            await tx.studentProfile.create({ data: { userId: user.id } });
            return toAccount(user);
          });
        } catch (error) {
          if (isUniqueViolation(error)) return null;
          throw error;
        }
      },
      { attributes: ATTRIBUTES },
    );
  }

  findCredentialsByEmail(email: string): Promise<AccountCredentials | null> {
    return observeDependency(
      DEPENDENCY,
      'account.find-by-email',
      async () => {
        const row = await this.prisma.user.findUnique({
          where: { email },
          include: { studentProfile: { select: { status: true } } },
        });
        return row
          ? {
              ...toAccount(row),
              passwordHash: row.passwordHash,
              studentStatus: row.studentProfile?.status ?? null,
            }
          : null;
      },
      { attributes: ATTRIBUTES },
    );
  }

  findById(id: string): Promise<Account | null> {
    return observeDependency(
      DEPENDENCY,
      'account.find-by-id',
      async () => {
        const row = await this.prisma.user.findUnique({ where: { id } });
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
          this.prisma.user.findMany({
            where,
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
          this.prisma.user.count({ where }),
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
      async () =>
        this.prisma.$transaction(async (tx) => {
          const result = await tx.user.createMany({
            data: [{ ...account, role: ROLE_TO_DB[account.role] }],
            skipDuplicates: true,
          });
          if (
            account.role === 'student' &&
            (await tx.user.findUnique({ where: { id: account.id } }))
          ) {
            await tx.studentProfile.createMany({
              data: [{ userId: account.id }],
              skipDuplicates: true,
            });
          }
          return result.count > 0;
        }),
      { attributes: ATTRIBUTES },
    );
  }

  async ping(): Promise<void> {
    await this.prisma.ping();
  }
}

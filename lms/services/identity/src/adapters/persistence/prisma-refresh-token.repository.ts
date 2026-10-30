import { observeDependency } from '@aiops-lms/common/telemetry';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import type { Account } from '../../domain/account.js';
import type { RefreshTokenRepository } from '../../application/ports/refresh-token-repository.js';
import { PrismaService } from './prisma.service.js';

const DEPENDENCY = 'identity-postgres';
const ATTRIBUTES = { 'db.system.name': 'postgresql' };

interface ConsumedRow {
  id: string;
  email: string;
  full_name: string;
  role: Account['role'];
  status: Account['status'];
  created_at: Date;
}

@Injectable()
export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  save(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    return observeDependency(
      DEPENDENCY,
      'refresh-token.save',
      async () => {
        await this.prisma.refreshToken.create({
          data: { id: randomUUID(), userId, tokenHash, expiresAt },
        });
      },
      { attributes: ATTRIBUTES },
    );
  }

  consume(tokenHash: string): Promise<Account | null> {
    return observeDependency(
      DEPENDENCY,
      'refresh-token.consume',
      async () => {
        // Xóa và đọc chủ sở hữu trong một câu lệnh: hai refresh đồng thời chỉ một bên thành công.
        const rows = await this.prisma.$queryRaw<ConsumedRow[]>`
          WITH consumed AS (
            DELETE FROM identity_refresh_tokens
            WHERE token_hash = ${tokenHash} AND expires_at > now()
            RETURNING user_id
          )
          SELECT u.id::text, u.email, u.full_name, u.role::text AS role,
                 u.status::text AS status, u.created_at
          FROM consumed c
          JOIN identity_users u ON u.id = c.user_id`;
        const row = rows[0];
        return row
          ? {
              id: row.id,
              email: row.email,
              fullName: row.full_name,
              role: row.role,
              status: row.status,
              createdAt: row.created_at,
            }
          : null;
      },
      { attributes: ATTRIBUTES },
    );
  }
}

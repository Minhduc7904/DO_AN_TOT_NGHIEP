import type { Prisma } from './generated/client.js';
import type { PrismaService } from './prisma.service.js';

/** Client dùng cho repository: `PrismaService` thường hoặc client trong một transaction. */
export type Db = PrismaService | Prisma.TransactionClient;

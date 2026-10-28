import { Inject, Injectable } from '@nestjs/common';

import type { Provider, ProviderCredential } from '../../domain/ai.js';
import type {
  DeleteOutcome,
  NewProvider,
  Paged,
  ProviderFilter,
  ProviderPatch,
  ProviderRepository,
} from '../../application/ports/repositories.js';
import type { Prisma } from './generated/client.js';
import { toCredential, toProvider } from './mappers.js';
import {
  isForeignKeyViolation,
  isRecordNotFound,
  isUniqueViolation,
  observeDb,
} from './prisma-support.js';
import { PrismaService } from './prisma.service.js';

function where(filter: ProviderFilter): Prisma.AiProviderWhereInput {
  return {
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.providerType ? { providerType: filter.providerType } : {}),
    ...(filter.search ? { name: { contains: filter.search, mode: 'insensitive' as const } } : {}),
  };
}

@Injectable()
export class PrismaProviderRepository implements ProviderRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  create(provider: NewProvider): Promise<Provider | null> {
    return observeDb('provider.create', async () => {
      try {
        return toProvider(await this.prisma.aiProvider.create({ data: provider }));
      } catch (error) {
        if (isUniqueViolation(error)) return null;
        throw error;
      }
    });
  }

  findById(id: string): Promise<Provider | null> {
    return observeDb('provider.find-by-id', async () => {
      const row = await this.prisma.aiProvider.findUnique({ where: { id } });
      return row ? toProvider(row) : null;
    });
  }

  findCredentialById(id: string): Promise<ProviderCredential | null> {
    return observeDb('provider.find-credential', async () => {
      const row = await this.prisma.aiProvider.findUnique({ where: { id } });
      return row ? toCredential(row) : null;
    });
  }

  nameTaken(name: string, exceptId?: string): Promise<boolean> {
    return observeDb('provider.name-taken', async () => {
      const count = await this.prisma.aiProvider.count({
        where: {
          name: { equals: name, mode: 'insensitive' },
          ...(exceptId ? { NOT: { id: exceptId } } : {}),
        },
      });
      return count > 0;
    });
  }

  list(filter: ProviderFilter, page: number, pageSize: number): Promise<Paged<Provider>> {
    return observeDb('provider.list', async () => {
      const [rows, total] = await Promise.all([
        this.prisma.aiProvider.findMany({
          where: where(filter),
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        this.prisma.aiProvider.count({ where: where(filter) }),
      ]);
      return { items: rows.map(toProvider), total };
    });
  }

  listCredentials(): Promise<ProviderCredential[]> {
    return observeDb('provider.list-credentials', async () => {
      const rows = await this.prisma.aiProvider.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      });
      return rows.map(toCredential);
    });
  }

  update(id: string, patch: ProviderPatch): Promise<Provider | 'conflict' | null> {
    return observeDb('provider.update', async () => {
      try {
        const row = await this.prisma.aiProvider.update({
          where: { id },
          data: {
            name: patch.name,
            providerType: patch.providerType,
            baseUrl: patch.baseUrl,
            status: patch.status,
            ...(patch.apiKeyEncrypted === undefined || patch.apiKeyHint === undefined
              ? {}
              : { apiKeyEncrypted: patch.apiKeyEncrypted, apiKeyHint: patch.apiKeyHint }),
          },
        });
        return toProvider(row);
      } catch (error) {
        if (isUniqueViolation(error)) return 'conflict';
        if (isRecordNotFound(error)) return null;
        throw error;
      }
    });
  }

  delete(id: string): Promise<DeleteOutcome> {
    return observeDb('provider.delete', async () => {
      try {
        const result = await this.prisma.aiProvider.deleteMany({ where: { id } });
        return result.count === 0 ? 'not-found' : 'deleted';
      } catch (error) {
        if (isForeignKeyViolation(error)) return 'in-use';
        throw error;
      }
    });
  }
}

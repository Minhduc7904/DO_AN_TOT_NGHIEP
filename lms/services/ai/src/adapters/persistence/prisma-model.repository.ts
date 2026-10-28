import { Inject, Injectable } from '@nestjs/common';

import type { Model } from '../../domain/ai.js';
import type {
  DeleteOutcome,
  ModelFilter,
  ModelPatch,
  ModelRepository,
  NewModel,
  Paged,
} from '../../application/ports/repositories.js';
import type { Prisma } from './generated/client.js';
import { toModel } from './mappers.js';
import {
  isForeignKeyViolation,
  isRecordNotFound,
  isUniqueViolation,
  observeDb,
} from './prisma-support.js';
import { PrismaService } from './prisma.service.js';

const WITH_PROVIDER = { provider: true } as const;

function where(filter: ModelFilter): Prisma.AiModelWhereInput {
  return {
    ...(filter.providerId ? { providerId: filter.providerId } : {}),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.search
      ? {
          OR: [
            { modelName: { contains: filter.search, mode: 'insensitive' as const } },
            { displayName: { contains: filter.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
}

@Injectable()
export class PrismaModelRepository implements ModelRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  create(model: NewModel): Promise<Model | null> {
    return observeDb('model.create', async () => {
      try {
        return toModel(await this.prisma.aiModel.create({ data: model, include: WITH_PROVIDER }));
      } catch (error) {
        if (isUniqueViolation(error)) return null;
        throw error;
      }
    });
  }

  findById(id: string): Promise<Model | null> {
    return observeDb('model.find-by-id', async () => {
      const row = await this.prisma.aiModel.findUnique({
        where: { id },
        include: WITH_PROVIDER,
      });
      return row ? toModel(row) : null;
    });
  }

  list(filter: ModelFilter, page: number, pageSize: number): Promise<Paged<Model>> {
    return observeDb('model.list', async () => {
      const [rows, total] = await Promise.all([
        this.prisma.aiModel.findMany({
          where: where(filter),
          include: WITH_PROVIDER,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        this.prisma.aiModel.count({ where: where(filter) }),
      ]);
      return { items: rows.map(toModel), total };
    });
  }

  update(id: string, patch: ModelPatch): Promise<Model | 'conflict' | null> {
    return observeDb('model.update', async () => {
      try {
        return toModel(
          await this.prisma.aiModel.update({ where: { id }, data: patch, include: WITH_PROVIDER }),
        );
      } catch (error) {
        if (isUniqueViolation(error)) return 'conflict';
        if (isRecordNotFound(error)) return null;
        throw error;
      }
    });
  }

  delete(id: string): Promise<DeleteOutcome> {
    return observeDb('model.delete', async () => {
      try {
        const result = await this.prisma.aiModel.deleteMany({ where: { id } });
        return result.count === 0 ? 'not-found' : 'deleted';
      } catch (error) {
        if (isForeignKeyViolation(error)) return 'in-use';
        throw error;
      }
    });
  }
}

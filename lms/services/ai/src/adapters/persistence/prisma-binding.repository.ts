import { Inject, Injectable } from '@nestjs/common';

import type { ServiceBinding, TaskKey } from '../../domain/ai.js';
import type { BindingRepository, BindingTarget } from '../../application/ports/repositories.js';
import { toBinding, toCredential, toModel } from './mappers.js';
import { observeDb } from './prisma-support.js';
import { PrismaService } from './prisma.service.js';

const WITH_MODEL = { model: { include: { provider: true } } } as const;

@Injectable()
export class PrismaBindingRepository implements BindingRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  list(): Promise<ServiceBinding[]> {
    return observeDb('binding.list', async () => {
      const rows = await this.prisma.aiServiceBinding.findMany({
        include: WITH_MODEL,
        orderBy: { taskKey: 'asc' },
      });
      return rows.map(toBinding);
    });
  }

  findByTask(taskKey: TaskKey): Promise<ServiceBinding | null> {
    return observeDb('binding.find-by-task', async () => {
      const row = await this.prisma.aiServiceBinding.findUnique({
        where: { taskKey },
        include: WITH_MODEL,
      });
      return row ? toBinding(row) : null;
    });
  }

  findTarget(taskKey: TaskKey): Promise<BindingTarget | null> {
    return observeDb('binding.find-target', async () => {
      const row = await this.prisma.aiServiceBinding.findUnique({
        where: { taskKey },
        include: WITH_MODEL,
      });
      if (!row) return null;
      return { model: toModel(row.model), provider: toCredential(row.model.provider) };
    });
  }

  upsert(
    id: string,
    taskKey: TaskKey,
    modelId: string,
  ): Promise<{ binding: ServiceBinding; created: boolean }> {
    return observeDb('binding.upsert', async () => {
      const existing = await this.prisma.aiServiceBinding.findUnique({ where: { taskKey } });
      const row = await this.prisma.aiServiceBinding.upsert({
        where: { taskKey },
        create: { id, taskKey, modelId },
        update: { modelId },
        include: WITH_MODEL,
      });
      return { binding: toBinding(row), created: existing === null };
    });
  }

  delete(taskKey: TaskKey): Promise<boolean> {
    return observeDb('binding.delete', async () => {
      const result = await this.prisma.aiServiceBinding.deleteMany({ where: { taskKey } });
      return result.count > 0;
    });
  }
}

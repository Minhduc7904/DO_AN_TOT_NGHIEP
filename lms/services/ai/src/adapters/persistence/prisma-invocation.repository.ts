import { Inject, Injectable } from '@nestjs/common';

import type { InvocationRepository, NewInvocation } from '../../application/ports/repositories.js';
import { observeDb } from './prisma-support.js';
import { PrismaService } from './prisma.service.js';

@Injectable()
export class PrismaInvocationRepository implements InvocationRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  record(invocation: NewInvocation): Promise<void> {
    return observeDb('invocation.record', async () => {
      await this.prisma.aiInvocation.create({ data: invocation });
    });
  }
}

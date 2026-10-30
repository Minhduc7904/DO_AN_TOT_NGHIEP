import { observeDependency } from '@aiops-lms/common/telemetry';
import { Injectable } from '@nestjs/common';

import type { ServiceClient } from '../../domain/service-client.js';
import type { ServiceClientRepository } from '../../application/ports/service-client-repository.js';
import { PrismaService } from './prisma.service.js';

const DEPENDENCY = 'identity-postgres';
const ATTRIBUTES = { 'db.system.name': 'postgresql' };

@Injectable()
export class PrismaServiceClientRepository implements ServiceClientRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(clientId: string): Promise<ServiceClient | null> {
    return observeDependency(
      DEPENDENCY,
      'service-client.find',
      async () => {
        const row = await this.prisma.serviceClient.findUnique({ where: { clientId } });
        return row
          ? {
              clientId: row.clientId,
              secretHash: row.secretHash,
              allowedAudiences: row.allowedAudiences,
              allowedScopes: row.allowedScopes,
              active: row.active,
            }
          : null;
      },
      { attributes: ATTRIBUTES },
    );
  }

  upsert(client: ServiceClient): Promise<void> {
    return observeDependency(
      DEPENDENCY,
      'service-client.upsert',
      async () => {
        const data = {
          secretHash: client.secretHash,
          allowedAudiences: [...client.allowedAudiences],
          allowedScopes: [...client.allowedScopes],
          active: client.active,
        };
        await this.prisma.serviceClient.upsert({
          where: { clientId: client.clientId },
          create: { clientId: client.clientId, ...data },
          update: data,
        });
      },
      { attributes: ATTRIBUTES },
    );
  }
}

import { PostgresOutbox } from '@aiops-lms/common/messaging';
import type { SqlClient } from '@aiops-lms/common/prisma';
import { MEDIA_COMMANDS } from '@aiops-lms/contracts/commands';

import type { MediaEffect } from '../../application/ports/media-effects.js';
import type { Prisma } from '../persistence/generated/client.js';

export interface OutboxProducer {
  serviceName: string;
  serviceVersion: string;
}

/**
 * Ghi tác động `media` vào outbox bằng chính transaction của thay đổi nghiệp vụ, nên command chỉ
 * tồn tại khi thay đổi commit. Tên command và queue chỉ xuất hiện ở adapter, application không biết.
 */
export async function enqueueMediaEffects(
  tx: Prisma.TransactionClient,
  producer: OutboxProducer,
  effects: readonly MediaEffect[],
): Promise<void> {
  if (effects.length === 0) return;
  const outbox = new PostgresOutbox(tx as unknown as SqlClient, producer);
  for (const effect of effects) {
    if (effect.kind === 'sync-markdown-usage') {
      const command = MEDIA_COMMANDS.markdownUsageSynchronize;
      await outbox.enqueue({
        commandName: command.name,
        schemaVersion: command.version,
        routingKey: command.queue,
        payload: {
          owner_kind: 'COURSE',
          owner_id: effect.ownerId,
          usage_type: effect.usageType,
          markdown: effect.markdown,
          actor_id: effect.actorId,
        },
      });
    } else {
      const command = MEDIA_COMMANDS.usagesDeleteByIds;
      // Schema giới hạn 1000 usage mỗi command.
      for (let offset = 0; offset < effect.usageIds.length; offset += 1000) {
        await outbox.enqueue({
          commandName: command.name,
          schemaVersion: command.version,
          routingKey: command.queue,
          payload: { usage_ids: effect.usageIds.slice(offset, offset + 1000) },
        });
      }
    }
  }
}

/** Token DI cho thông tin producer ghi vào envelope outbox. */
export const OUTBOX_PRODUCER = Symbol('OUTBOX_PRODUCER');

import type { MediaUsage } from '../../domain/media.js';
import { mediaErrors } from '../../domain/errors.js';
import type {
  NewUsage,
  UsageGroup,
  UsageRepository,
} from '../../application/ports/repositories.js';
import type { Db } from './db.js';
import type { MediaUsage as UsageRow, UsageOwnerKind } from './generated/client.js';
import { observeDb } from './prisma-support.js';

const toUsage = (row: UsageRow): MediaUsage => ({ ...row });

export class PrismaUsageRepository implements UsageRepository {
  constructor(private readonly db: Db) {}

  create(usage: NewUsage): Promise<MediaUsage> {
    return observeDb('usage.create', async () => {
      // ON CONFLICT DO NOTHING: lỗi unique làm hỏng transaction PostgreSQL đang mở.
      await this.db.mediaUsage.createMany({ data: [usage], skipDuplicates: true });
      const row = await this.db.mediaUsage.findFirst({
        where: {
          mediaId: usage.mediaId,
          ownerKind: usage.ownerKind,
          ownerId: usage.ownerId,
          usageType: usage.usageType,
        },
      });
      // Không thấy bộ khóa này nghĩa là partial index (thumbnail/avatar duy nhất) đã chặn.
      if (!row) throw mediaErrors.usageConflict('Owner đã có usage duy nhất của loại này');
      return toUsage(row);
    });
  }

  findById(id: string): Promise<MediaUsage | null> {
    return observeDb('usage.find-by-id', async () => {
      const row = await this.db.mediaUsage.findUnique({ where: { id } });
      return row ? toUsage(row) : null;
    });
  }

  findManyByIds(ids: readonly string[]): Promise<MediaUsage[]> {
    return observeDb('usage.find-many', async () => {
      const rows = await this.db.mediaUsage.findMany({ where: { id: { in: [...ids] } } });
      return rows.map(toUsage);
    });
  }

  listByGroup(group: UsageGroup): Promise<MediaUsage[]> {
    return observeDb('usage.list-by-group', async () => {
      const rows = await this.db.mediaUsage.findMany({
        where: group,
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      });
      return rows.map(toUsage);
    });
  }

  listByOwners(kind: UsageOwnerKind, ownerIds: readonly string[]): Promise<MediaUsage[]> {
    return observeDb('usage.list-by-owners', async () => {
      const rows = await this.db.mediaUsage.findMany({
        where: { ownerKind: kind, ownerId: { in: [...ownerIds] } },
      });
      return rows.map(toUsage);
    });
  }

  nextPosition(group: UsageGroup): Promise<number> {
    return observeDb('usage.next-position', async () => {
      const result = await this.db.mediaUsage.aggregate({ where: group, _max: { position: true } });
      return result._max.position === null ? 0 : result._max.position + 1;
    });
  }

  reorder(group: UsageGroup, orderedIds: readonly string[]): Promise<MediaUsage[]> {
    return observeDb('usage.reorder', async () => {
      for (const [index, id] of orderedIds.entries()) {
        await this.db.mediaUsage.update({ where: { id }, data: { position: index } });
      }
      const rows = await this.db.mediaUsage.findMany({
        where: group,
        orderBy: [{ position: 'asc' }],
      });
      return rows.map(toUsage);
    });
  }

  deleteByIds(ids: readonly string[]): Promise<number> {
    return observeDb('usage.delete-by-ids', async () => {
      const result = await this.db.mediaUsage.deleteMany({ where: { id: { in: [...ids] } } });
      return result.count;
    });
  }

  deleteGroup(group: UsageGroup): Promise<number> {
    return observeDb('usage.delete-group', async () => {
      const result = await this.db.mediaUsage.deleteMany({ where: group });
      return result.count;
    });
  }
}

import type { MediaObject } from '../../domain/media.js';
import type {
  MediaFilter,
  MediaPatch,
  MediaRepository,
  MediaSummary,
  NewMedia,
} from '../../application/ports/repositories.js';
import type { Db } from './db.js';
import type { MediaObject as MediaRow, Prisma } from './generated/client.js';
import { isRecordNotFound, observeDb, omitUndefined } from './prisma-support.js';

const toMedia = (row: MediaRow): MediaObject => ({ ...row });

function whereOf(filter: MediaFilter): Prisma.MediaObjectWhereInput {
  return {
    deletedAt: null,
    // Thư viện chỉ có file người dùng tải lên, không có thumbnail sinh tự động.
    sourceMediaId: null,
    ...omitUndefined({
      uploadedBy: filter.uploadedBy,
      type: filter.type,
      status: filter.status,
      originalName: filter.search
        ? { contains: filter.search, mode: 'insensitive' as const }
        : undefined,
    }),
  };
}

export class PrismaMediaRepository implements MediaRepository {
  constructor(private readonly db: Db) {}

  create(media: NewMedia): Promise<MediaObject> {
    return observeDb('media.create', async () =>
      toMedia(await this.db.mediaObject.create({ data: omitUndefined(media) as never })),
    );
  }

  findById(id: string): Promise<MediaObject | null> {
    return observeDb('media.find-by-id', async () => {
      const row = await this.db.mediaObject.findFirst({ where: { id, deletedAt: null } });
      return row ? toMedia(row) : null;
    });
  }

  findManyByIds(ids: readonly string[]): Promise<MediaObject[]> {
    return observeDb('media.find-many', async () => {
      const rows = await this.db.mediaObject.findMany({
        where: { id: { in: [...ids] }, deletedAt: null },
      });
      return rows.map(toMedia);
    });
  }

  findThumbnailOf(sourceMediaId: string): Promise<MediaObject | null> {
    return observeDb('media.find-thumbnail', async () => {
      const row = await this.db.mediaObject.findFirst({
        where: { sourceMediaId, deletedAt: null },
      });
      return row ? toMedia(row) : null;
    });
  }

  update(id: string, patch: MediaPatch): Promise<MediaObject | null> {
    return observeDb('media.update', async () => {
      try {
        return toMedia(
          await this.db.mediaObject.update({ where: { id }, data: omitUndefined(patch) }),
        );
      } catch (error) {
        if (isRecordNotFound(error)) return null;
        throw error;
      }
    });
  }

  list(
    filter: MediaFilter,
    page: number,
    pageSize: number,
  ): Promise<{ items: MediaObject[]; total: number }> {
    return observeDb('media.list', async () => {
      const where = whereOf(filter);
      const [rows, total] = await Promise.all([
        this.db.mediaObject.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        this.db.mediaObject.count({ where }),
      ]);
      return { items: rows.map(toMedia), total };
    });
  }

  summary(): Promise<MediaSummary> {
    return observeDb('media.summary', async () => {
      const where = { deletedAt: null, sourceMediaId: null } as const;
      const [byStatus, byType, size, usages, unused, total] = await Promise.all([
        this.db.mediaObject.groupBy({ by: ['status'], where, _count: { _all: true } }),
        this.db.mediaObject.groupBy({ by: ['type'], where, _count: { _all: true } }),
        this.db.mediaObject.aggregate({ where, _sum: { sizeBytes: true } }),
        this.db.mediaUsage.count(),
        this.db.mediaObject.count({ where: { ...where, status: 'READY', usages: { none: {} } } }),
        this.db.mediaObject.count({ where }),
      ]);
      return {
        total,
        byStatus: Object.fromEntries(byStatus.map((row) => [row.status, row._count._all])),
        byType: Object.fromEntries(byType.map((row) => [row.type, row._count._all])),
        totalSizeBytes: size._sum.sizeBytes ?? 0,
        activeUsages: usages,
        unusedReady: unused,
      };
    });
  }
}

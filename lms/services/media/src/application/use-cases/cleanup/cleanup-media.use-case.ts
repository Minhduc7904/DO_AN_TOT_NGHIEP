import { AppError } from '@aiops-lms/common/errors';
import type { Clock } from '@aiops-lms/common/ports';

import type { MediaObject } from '../../../domain/media.js';
import type { ObjectStorage } from '../../ports/object-storage.js';
import type { MediaStores, MediaUnitOfWork } from '../../ports/unit-of-work.js';

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

/** Lý do ghi vào `failure_reason` của upload `PENDING` bị bỏ dở. */
export const UPLOAD_ABANDONED = 'UPLOAD_ABANDONED';

export interface CleanupMediaOptions {
  defaultRetentionHours: number;
  minRetentionHours: number;
  maxRetentionHours: number;
  defaultPendingGraceMinutes: number;
  defaultLimit: number;
  maxLimit: number;
  /** Lỗi từng media (không chứa object key); dùng để ghi log. */
  onItemError?: (mediaId: string, error: unknown) => void;
}

export interface CleanupMediaInput {
  retentionHours?: number | undefined;
  pendingGraceMinutes?: number | undefined;
  limit?: number | undefined;
}

export interface CleanupMediaSummary {
  retentionHours: number;
  pendingGraceMinutes: number;
  limit: number;
  unusedDeleted: number;
  thumbnailsDeleted: number;
  objectsRemoved: number;
  pendingRecovered: number;
  pendingOrphanObjectsRemoved: number;
  skipped: number;
  failed: number;
  hasMore: boolean;
}

type Counter = Exclude<
  keyof CleanupMediaSummary,
  'retentionHours' | 'pendingGraceMinutes' | 'limit' | 'hasMore'
>;
/** Số đếm của một media; chỉ cộng vào tóm tắt sau khi transaction của media đó commit. */
type Delta = Partial<Record<Counter, number>>;
type Outcome = Delta | 'skipped';

/**
 * Dọn media theo lịch, idempotent: (1) phục hồi upload `PENDING` stale, (2) xóa mềm media gốc
 * `READY` không còn usage và quá thời gian lưu giữ cùng thumbnail của nó, (3) dọn thumbnail mồ côi.
 *
 * Mỗi media xử lý trong transaction riêng: khóa dòng (`FOR UPDATE SKIP LOCKED`), kiểm lại điều kiện
 * (kể cả usage vừa phát sinh), cập nhật DB rồi xóa object; lỗi MinIO làm rollback nên media giữ
 * nguyên và lần sau thử lại. Xóa object đã mất sẵn không phải lỗi. Media còn usage (kể cả
 * singleton như thumbnail khóa học, avatar) không bao giờ bị chọn.
 */
export class CleanupMediaUseCase {
  constructor(
    private readonly uow: MediaUnitOfWork,
    private readonly storage: ObjectStorage,
    private readonly clock: Clock,
    private readonly options: CleanupMediaOptions,
  ) {}

  async execute(input: CleanupMediaInput): Promise<CleanupMediaSummary> {
    const retentionHours = this.resolve(
      'retention_hours',
      input.retentionHours,
      this.options.defaultRetentionHours,
      this.options.minRetentionHours,
      this.options.maxRetentionHours,
    );
    const pendingGraceMinutes = this.resolve(
      'pending_grace_minutes',
      input.pendingGraceMinutes,
      this.options.defaultPendingGraceMinutes,
      0,
      10_080,
    );
    const limit = this.resolve(
      'limit',
      input.limit,
      this.options.defaultLimit,
      1,
      this.options.maxLimit,
    );

    const now = this.clock.now();
    const unusedBefore = new Date(now.getTime() - retentionHours * HOUR_MS);
    const pendingBefore = new Date(now.getTime() - pendingGraceMinutes * MINUTE_MS);

    const summary: CleanupMediaSummary = {
      retentionHours,
      pendingGraceMinutes,
      limit,
      unusedDeleted: 0,
      thumbnailsDeleted: 0,
      objectsRemoved: 0,
      pendingRecovered: 0,
      pendingOrphanObjectsRemoved: 0,
      skipped: 0,
      failed: 0,
      hasMore: false,
    };

    const stale = await this.uow.stores.media.listStalePendingIds(pendingBefore, limit + 1);
    summary.hasMore ||= stale.length > limit;
    for (const id of stale.slice(0, limit)) {
      await this.item(id, summary, () => this.recoverPending(id, pendingBefore));
    }

    const unused = await this.uow.stores.media.listUnusedReadyIds(unusedBefore, limit + 1);
    summary.hasMore ||= unused.length > limit;
    for (const id of unused.slice(0, limit)) {
      await this.item(id, summary, () => this.deleteUnused(id, unusedBefore, now));
    }

    const orphans = await this.uow.stores.media.listOrphanThumbnailIds(limit + 1);
    summary.hasMore ||= orphans.length > limit;
    for (const id of orphans.slice(0, limit)) {
      await this.item(id, summary, () => this.deleteOrphanThumbnail(id, now));
    }
    return summary;
  }

  private resolve(
    name: string,
    value: number | undefined,
    fallback: number,
    min: number,
    max: number,
  ): number {
    const resolved = value ?? fallback;
    if (resolved < min || resolved > max) {
      throw AppError.validation(`${name} phải nằm trong khoảng ${min}–${max}`, {
        [name]: { min, max },
      });
    }
    return resolved;
  }

  private async item(
    id: string,
    summary: CleanupMediaSummary,
    work: () => Promise<Outcome>,
  ): Promise<void> {
    try {
      const outcome = await work();
      if (outcome === 'skipped') {
        summary.skipped += 1;
        return;
      }
      for (const [counter, count] of Object.entries(outcome) as [Counter, number][]) {
        summary[counter] += count;
      }
    } catch (error) {
      summary.failed += 1;
      this.options.onItemError?.(id, error);
    }
  }

  private recoverPending(id: string, pendingBefore: Date): Promise<Outcome> {
    return this.uow.run(async (stores) => {
      const media = await stores.media.lockForCleanup(id);
      const expiry = media ? (media.uploadExpiresAt ?? media.createdAt) : null;
      if (!media || media.status !== 'PENDING' || !expiry || expiry >= pendingBefore) {
        return 'skipped';
      }
      await stores.media.update(media.id, {
        status: 'FAILED',
        tmpObjectKey: null,
        failureReason: UPLOAD_ABANDONED,
      });
      // Object tạm (upload xong nhưng chưa hoàn tất) và object cuối (copy xong mà chưa kịp READY).
      let orphans = 0;
      for (const key of new Set([media.tmpObjectKey, media.objectKey])) {
        if (key && (await this.storage.stat(media.bucket, key))) {
          await this.storage.remove(media.bucket, key);
          orphans += 1;
        }
      }
      return { pendingRecovered: 1, pendingOrphanObjectsRemoved: orphans };
    });
  }

  private deleteUnused(id: string, unusedBefore: Date, now: Date): Promise<Outcome> {
    return this.uow.run(async (stores) => {
      const media = await stores.media.lockForCleanup(id);
      if (!media || !isUnusedReady(media, unusedBefore)) return 'skipped';
      // Kiểm usage SAU khi giữ khóa dòng: usage mới chèn sau đó phải chờ khóa này.
      if ((await stores.usages.countByMedia(media.id)) > 0) return 'skipped';

      const thumbnail = await stores.media.findThumbnailOf(media.id);
      await stores.media.update(media.id, { deletedAt: now });
      let removed = [media];
      if (thumbnail) {
        await this.tombstoneThumbnail(stores, thumbnail, now);
        removed = [media, thumbnail];
      }
      for (const object of removed) await this.storage.remove(object.bucket, object.objectKey);
      return {
        unusedDeleted: 1,
        thumbnailsDeleted: thumbnail ? 1 : 0,
        objectsRemoved: removed.length,
      };
    });
  }

  private deleteOrphanThumbnail(id: string, now: Date): Promise<Outcome> {
    return this.uow.run(async (stores) => {
      const thumbnail = await stores.media.lockForCleanup(id);
      if (!thumbnail?.sourceMediaId) return 'skipped';
      const source = await stores.media.findIncludingDeleted(thumbnail.sourceMediaId);
      if (source && !source.deletedAt) return 'skipped';
      await this.tombstoneThumbnail(stores, thumbnail, now);
      await this.storage.remove(thumbnail.bucket, thumbnail.objectKey);
      return { thumbnailsDeleted: 1, objectsRemoved: 1 };
    });
  }

  /** Thumbnail là một dòng `media_objects` có `source_media_id`, và usage `MEDIA_THUMBNAIL` trỏ vào nó. */
  private async tombstoneThumbnail(
    stores: MediaStores,
    thumbnail: MediaObject,
    now: Date,
  ): Promise<void> {
    const usages = await stores.usages.listByOwners('MEDIA', [thumbnail.sourceMediaId ?? '']);
    await stores.usages.deleteByIds(
      usages.filter((usage) => usage.mediaId === thumbnail.id).map((usage) => usage.id),
    );
    await stores.media.update(thumbnail.id, { deletedAt: now });
  }
}

function isUnusedReady(media: MediaObject, unusedBefore: Date): boolean {
  return (
    media.status === 'READY' &&
    media.sourceMediaId === null &&
    media.createdAt < unusedBefore &&
    media.updatedAt < unusedBefore
  );
}

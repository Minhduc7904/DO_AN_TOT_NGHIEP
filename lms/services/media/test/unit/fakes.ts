import { Readable } from 'node:stream';

import type { ObjectStorage, PresignedUpload } from '../../src/application/ports/object-storage.js';
import type {
  JobPatch,
  JobRepository,
  MediaPatch,
  MediaRepository,
  NewJob,
  NewMedia,
  NewUsage,
  UsageGroup,
  UsageRepository,
} from '../../src/application/ports/repositories.js';
import type { MediaStores, MediaUnitOfWork } from '../../src/application/ports/unit-of-work.js';
import type { MediaJob, MediaObject, MediaUsage } from '../../src/domain/media.js';

const NOW = new Date('2026-10-28T10:00:00Z');

export class InMemoryMedia implements MediaRepository {
  readonly rows = new Map<string, MediaObject>();

  create(media: NewMedia): Promise<MediaObject> {
    const row: MediaObject = {
      tmpObjectKey: null,
      uploadExpiresAt: null,
      sourceMediaId: null,
      failureReason: null,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
      ...media,
    };
    this.rows.set(row.id, row);
    return Promise.resolve(row);
  }

  findById(id: string): Promise<MediaObject | null> {
    const row = this.rows.get(id);
    return Promise.resolve(row && !row.deletedAt ? row : null);
  }

  findManyByIds(ids: readonly string[]): Promise<MediaObject[]> {
    return Promise.resolve([...this.rows.values()].filter((row) => ids.includes(row.id)));
  }

  findThumbnailOf(sourceMediaId: string): Promise<MediaObject | null> {
    return Promise.resolve(
      [...this.rows.values()].find(
        (row) => row.sourceMediaId === sourceMediaId && !row.deletedAt,
      ) ?? null,
    );
  }

  update(id: string, patch: MediaPatch): Promise<MediaObject | null> {
    const row = this.rows.get(id);
    if (!row) return Promise.resolve(null);
    const updated = { ...row, ...patch };
    this.rows.set(id, updated);
    return Promise.resolve(updated);
  }

  list(): Promise<{ items: MediaObject[]; total: number }> {
    const items = [...this.rows.values()];
    return Promise.resolve({ items, total: items.length });
  }

  summary(): Promise<never> {
    return Promise.reject(new Error('không dùng'));
  }

  /** Dùng cho cleanup: tập usage lấy từ `usages` được nối vào bằng `bindUsages`. */
  private usages: InMemoryUsages | null = null;
  /** Khóa giả lập: media nằm trong tập này coi như đang bị lượt khác giữ (`SKIP LOCKED`). */
  readonly lockedByOthers = new Set<string>();

  bindUsages(usages: InMemoryUsages): void {
    this.usages = usages;
  }

  private hasUsage(mediaId: string): boolean {
    return [...(this.usages?.rows.values() ?? [])].some((usage) => usage.mediaId === mediaId);
  }

  listUnusedReadyIds(olderThan: Date, limit: number): Promise<string[]> {
    return Promise.resolve(
      [...this.rows.values()]
        .filter(
          (row) =>
            !row.deletedAt &&
            row.status === 'READY' &&
            row.sourceMediaId === null &&
            row.createdAt < olderThan &&
            row.updatedAt < olderThan &&
            !this.hasUsage(row.id),
        )
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .slice(0, limit)
        .map((row) => row.id),
    );
  }

  listStalePendingIds(expiredBefore: Date, limit: number): Promise<string[]> {
    return Promise.resolve(
      [...this.rows.values()]
        .filter(
          (row) =>
            !row.deletedAt &&
            row.status === 'PENDING' &&
            (row.uploadExpiresAt ?? row.createdAt) < expiredBefore,
        )
        .slice(0, limit)
        .map((row) => row.id),
    );
  }

  listOrphanThumbnailIds(limit: number): Promise<string[]> {
    return Promise.resolve(
      [...this.rows.values()]
        .filter(
          (row) =>
            !row.deletedAt &&
            row.sourceMediaId !== null &&
            this.rows.get(row.sourceMediaId)?.deletedAt != null,
        )
        .slice(0, limit)
        .map((row) => row.id),
    );
  }

  lockForCleanup(id: string): Promise<MediaObject | null> {
    const row = this.rows.get(id);
    return Promise.resolve(row && !row.deletedAt && !this.lockedByOthers.has(id) ? row : null);
  }

  findIncludingDeleted(id: string): Promise<MediaObject | null> {
    return Promise.resolve(this.rows.get(id) ?? null);
  }
}

export class InMemoryUsages implements UsageRepository {
  readonly rows = new Map<string, MediaUsage>();

  create(usage: NewUsage): Promise<MediaUsage> {
    const existing = [...this.rows.values()].find(
      (row) =>
        row.mediaId === usage.mediaId &&
        row.ownerKind === usage.ownerKind &&
        row.ownerId === usage.ownerId &&
        row.usageType === usage.usageType,
    );
    if (existing) return Promise.resolve(existing);
    const row: MediaUsage = { ...usage, createdAt: NOW };
    this.rows.set(row.id, row);
    return Promise.resolve(row);
  }

  findById(id: string): Promise<MediaUsage | null> {
    return Promise.resolve(this.rows.get(id) ?? null);
  }

  findManyByIds(ids: readonly string[]): Promise<MediaUsage[]> {
    return Promise.resolve([...this.rows.values()].filter((row) => ids.includes(row.id)));
  }

  listByGroup(group: UsageGroup): Promise<MediaUsage[]> {
    return Promise.resolve(
      [...this.rows.values()]
        .filter(
          (row) =>
            row.ownerKind === group.ownerKind &&
            row.ownerId === group.ownerId &&
            row.usageType === group.usageType,
        )
        .sort((a, b) => a.position - b.position),
    );
  }

  listByOwners(kind: string, ownerIds: readonly string[]): Promise<MediaUsage[]> {
    return Promise.resolve(
      [...this.rows.values()].filter(
        (row) => row.ownerKind === kind && ownerIds.includes(row.ownerId),
      ),
    );
  }

  countByMedia(mediaId: string): Promise<number> {
    return Promise.resolve([...this.rows.values()].filter((row) => row.mediaId === mediaId).length);
  }

  async nextPosition(group: UsageGroup): Promise<number> {
    const rows = await this.listByGroup(group);
    return rows.length === 0 ? 0 : Math.max(...rows.map((row) => row.position)) + 1;
  }

  async reorder(group: UsageGroup, orderedIds: readonly string[]): Promise<MediaUsage[]> {
    orderedIds.forEach((id, index) => {
      const row = this.rows.get(id);
      if (row) this.rows.set(id, { ...row, position: index });
    });
    return this.listByGroup(group);
  }

  deleteByIds(ids: readonly string[]): Promise<number> {
    let count = 0;
    for (const id of ids) if (this.rows.delete(id)) count += 1;
    return Promise.resolve(count);
  }

  async deleteGroup(group: UsageGroup): Promise<number> {
    return this.deleteByIds((await this.listByGroup(group)).map((row) => row.id));
  }
}

export class InMemoryJobs implements JobRepository {
  readonly rows = new Map<string, MediaJob>();

  ensure(job: NewJob): Promise<MediaJob> {
    const existing = [...this.rows.values()].find(
      (row) => row.deduplicationKey === job.deduplicationKey,
    );
    if (existing) return Promise.resolve(existing);
    const row: MediaJob = {
      status: 'QUEUED',
      referenceId: null,
      expectedCount: null,
      processedCount: 0,
      failedCount: 0,
      lastError: null,
      createdAt: NOW,
      updatedAt: NOW,
      ...job,
    } as MediaJob;
    this.rows.set(row.id, row);
    return Promise.resolve(row);
  }

  findById(id: string): Promise<MediaJob | null> {
    return Promise.resolve(this.rows.get(id) ?? null);
  }

  findByKey(key: string): Promise<MediaJob | null> {
    return Promise.resolve(
      [...this.rows.values()].find((row) => row.deduplicationKey === key) ?? null,
    );
  }

  update(id: string, patch: JobPatch): Promise<MediaJob | null> {
    const row = this.rows.get(id);
    if (!row) return Promise.resolve(null);
    const { processedDelta = 0, failedDelta = 0, ...rest } = patch;
    const updated = {
      ...row,
      ...rest,
      processedCount: row.processedCount + processedDelta,
      failedCount: row.failedCount + failedDelta,
    } as MediaJob;
    this.rows.set(id, updated);
    return Promise.resolve(updated);
  }

  list(): Promise<{ items: MediaJob[]; total: number }> {
    const items = [...this.rows.values()];
    return Promise.resolve({ items, total: items.length });
  }
}

export class InMemoryUnitOfWork implements MediaUnitOfWork {
  readonly media = new InMemoryMedia();
  readonly usages = new InMemoryUsages();
  readonly jobs = new InMemoryJobs();
  readonly commands: string[] = [];
  readonly processed = new Set<string>();
  readonly stores: MediaStores = {
    media: this.media,
    usages: this.usages,
    jobs: this.jobs,
    commands: {
      requestThumbnail: (mediaId) => {
        this.commands.push(`thumbnail:${mediaId}`);
        return Promise.resolve();
      },
    },
  };

  constructor() {
    this.media.bindUsages(this.usages);
  }

  run<T>(work: (stores: MediaStores) => Promise<T>): Promise<T> {
    // Giả lập transaction: lỗi thì hoàn tác media và usage về trạng thái trước `run`.
    const media = new Map(this.media.rows);
    const usages = new Map(this.usages.rows);
    return work(this.stores).catch((error: unknown) => {
      this.media.rows.clear();
      media.forEach((row, id) => this.media.rows.set(id, row));
      this.usages.rows.clear();
      usages.forEach((row, id) => this.usages.rows.set(id, row));
      throw error;
    });
  }

  async runOnce(
    messageId: string,
    consumer: string,
    work: (stores: MediaStores) => Promise<void>,
  ): Promise<'processed' | 'deduplicated'> {
    const key = `${messageId}:${consumer}`;
    if (this.processed.has(key)) return 'deduplicated';
    await work(this.stores);
    this.processed.add(key);
    return 'processed';
  }
}

export class FakeStorage implements ObjectStorage {
  readonly objects = new Map<string, { body: Buffer; contentType: string }>();
  failPut = false;
  failRemove = false;

  private k(bucket: string, key: string): string {
    return `${bucket}/${key}`;
  }

  presignUpload(input: { bucket: string; key: string }): Promise<PresignedUpload> {
    return Promise.resolve({
      url: 'http://minio.test/' + input.bucket,
      fields: { key: input.key },
      expiresAt: new Date('2026-10-28T10:15:00Z'),
    });
  }

  stat(
    bucket: string,
    key: string,
  ): Promise<{ sizeBytes: number; contentType: string | null } | null> {
    const object = this.objects.get(this.k(bucket, key));
    return Promise.resolve(
      object ? { sizeBytes: object.body.length, contentType: object.contentType } : null,
    );
  }

  async sha256(bucket: string, key: string): Promise<string> {
    const { createHash } = await import('node:crypto');
    const object = this.objects.get(this.k(bucket, key));
    if (!object) throw new Error('không có object');
    return createHash('sha256').update(object.body).digest('hex');
  }

  put(bucket: string, key: string, body: Buffer, contentType: string): Promise<void> {
    if (this.failPut) return Promise.reject(new Error('MinIO lỗi'));
    this.objects.set(this.k(bucket, key), { body, contentType });
    return Promise.resolve();
  }

  copy(bucket: string, fromKey: string, toKey: string): Promise<void> {
    const object = this.objects.get(this.k(bucket, fromKey));
    if (!object) return Promise.reject(new Error('không có nguồn'));
    this.objects.set(this.k(bucket, toKey), object);
    return Promise.resolve();
  }

  remove(bucket: string, key: string): Promise<void> {
    if (this.failRemove) return Promise.reject(new Error('MinIO lỗi'));
    this.objects.delete(this.k(bucket, key));
    return Promise.resolve();
  }

  get(
    bucket: string,
    key: string,
  ): Promise<{ stream: Readable; sizeBytes: number; contentType: string | null }> {
    const object = this.objects.get(this.k(bucket, key));
    if (!object) return Promise.reject(new Error('không có object'));
    return Promise.resolve({
      stream: Readable.from([object.body]),
      sizeBytes: object.body.length,
      contentType: object.contentType,
    });
  }

  download(): Promise<void> {
    return Promise.resolve();
  }

  ping(): Promise<void> {
    return Promise.resolve();
  }
}

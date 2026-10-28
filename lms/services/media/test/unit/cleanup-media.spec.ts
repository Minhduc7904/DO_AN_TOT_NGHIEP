import type { Clock } from '@aiops-lms/common/ports';

import {
  CleanupMediaUseCase,
  type CleanupMediaOptions,
  UPLOAD_ABANDONED,
} from '../../src/application/use-cases/cleanup/cleanup-media.use-case.js';
import type { MediaObject, MediaUsage } from '../../src/domain/media.js';
import { FakeStorage, InMemoryUnitOfWork } from './fakes.js';

const NOW = new Date('2026-10-28T12:00:00Z');
const clock: Clock = { now: () => NOW };
const hoursAgo = (hours: number): Date => new Date(NOW.getTime() - hours * 3_600_000);

const OPTIONS: CleanupMediaOptions = {
  defaultRetentionHours: 168,
  minRetentionHours: 1,
  maxRetentionHours: 8_760,
  defaultPendingGraceMinutes: 15,
  defaultLimit: 200,
  maxLimit: 1_000,
};

let sequence = 0;
const uuid = (): string => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;

function setup(options: Partial<CleanupMediaOptions> = {}): {
  uow: InMemoryUnitOfWork;
  storage: FakeStorage;
  cleanup: CleanupMediaUseCase;
  seed: (media: Partial<MediaObject>) => Promise<MediaObject>;
  attach: (mediaId: string, usageType?: MediaUsage['usageType']) => void;
} {
  const uow = new InMemoryUnitOfWork();
  const storage = new FakeStorage();
  const cleanup = new CleanupMediaUseCase(uow, storage, clock, { ...OPTIONS, ...options });

  async function seed(media: Partial<MediaObject>): Promise<MediaObject> {
    const id = media.id ?? uuid();
    const row: MediaObject = {
      id,
      type: 'IMAGE',
      status: 'READY',
      thumbnailStatus: 'NOT_APPLICABLE',
      originalName: 'a.png',
      mimeType: 'image/png',
      sizeBytes: 3,
      checksumSha256: 'x',
      bucket: 'images',
      objectKey: `2026/10/01/${id}.png`,
      tmpObjectKey: null,
      uploadExpiresAt: null,
      uploadedBy: uuid(),
      sourceMediaId: null,
      failureReason: null,
      createdAt: hoursAgo(1_000),
      updatedAt: hoursAgo(1_000),
      deletedAt: null,
      ...media,
    };
    uow.media.rows.set(id, row);
    // Upload `PENDING` chưa có object ở key cuối; chỉ object tạm (nếu client đã upload).
    const keys = row.status === 'READY' ? [row.objectKey, row.tmpObjectKey] : [row.tmpObjectKey];
    for (const key of keys) {
      if (key) await storage.put(row.bucket, key, Buffer.from('x'), row.mimeType);
    }
    return row;
  }

  const attach = (mediaId: string, usageType: MediaUsage['usageType'] = 'LESSON_CONTENT'): void => {
    const id = uuid();
    uow.usages.rows.set(id, {
      id,
      mediaId,
      ownerKind: usageType === 'STUDENT_AVATAR' ? 'STUDENT' : 'COURSE',
      ownerId: uuid(),
      usageType,
      position: 0,
      createdBy: uuid(),
      createdAt: hoursAgo(900),
    });
  };
  return { uow, storage, cleanup, seed, attach };
}

const has = (storage: FakeStorage, media: MediaObject): boolean =>
  storage.objects.has(`${media.bucket}/${media.objectKey}`);

describe('CleanupMediaUseCase', () => {
  it('xóa mềm media không dùng quá hạn và object của nó, giữ media còn usage hoặc còn mới', async () => {
    const { uow, storage, cleanup, seed, attach } = setup();
    const unused = await seed({});
    const used = await seed({});
    attach(used.id);
    const avatar = await seed({});
    attach(avatar.id, 'STUDENT_AVATAR');
    const thumbnailOfCourse = await seed({});
    attach(thumbnailOfCourse.id, 'COURSE_THUMBNAIL');
    const recent = await seed({ createdAt: hoursAgo(2), updatedAt: hoursAgo(2) });
    const touched = await seed({ updatedAt: hoursAgo(1) });

    const summary = await cleanup.execute({ retentionHours: 24 });

    expect(summary).toMatchObject({
      retentionHours: 24,
      unusedDeleted: 1,
      objectsRemoved: 1,
      failed: 0,
      hasMore: false,
    });
    expect(uow.media.rows.get(unused.id)?.deletedAt).toEqual(NOW);
    expect(has(storage, unused)).toBe(false);
    for (const kept of [used, avatar, thumbnailOfCourse, recent, touched]) {
      expect(uow.media.rows.get(kept.id)?.deletedAt).toBeNull();
      expect(has(storage, kept)).toBe(true);
    }
  });

  it('xóa cả thumbnail của media gốc và usage MEDIA_THUMBNAIL của nó', async () => {
    const { uow, storage, cleanup, seed } = setup();
    const source = await seed({ type: 'IMAGE', thumbnailStatus: 'READY' });
    const thumbnail = await seed({ sourceMediaId: source.id, objectKey: 'thumb.webp' });
    const usageId = uuid();
    uow.usages.rows.set(usageId, {
      id: usageId,
      mediaId: thumbnail.id,
      ownerKind: 'MEDIA',
      ownerId: source.id,
      usageType: 'MEDIA_THUMBNAIL',
      position: 0,
      createdBy: source.uploadedBy,
      createdAt: NOW,
    });

    const summary = await cleanup.execute({ retentionHours: 24 });

    // Thumbnail có usage nên không bao giờ bị chọn như media không dùng, chỉ đi theo media gốc.
    expect(summary).toMatchObject({ unusedDeleted: 1, thumbnailsDeleted: 1, objectsRemoved: 2 });
    expect(uow.media.rows.get(source.id)?.deletedAt).toEqual(NOW);
    expect(uow.media.rows.get(thumbnail.id)?.deletedAt).toEqual(NOW);
    expect(uow.usages.rows.has(usageId)).toBe(false);
    expect(has(storage, source) || has(storage, thumbnail)).toBe(false);
  });

  it('dọn thumbnail mồ côi khi media gốc đã bị xóa mềm', async () => {
    const { uow, storage, cleanup, seed } = setup();
    const source = await seed({ deletedAt: hoursAgo(5) });
    const thumbnail = await seed({ sourceMediaId: source.id, objectKey: 'orphan.webp' });

    const summary = await cleanup.execute({ retentionHours: 24 });

    expect(summary).toMatchObject({ unusedDeleted: 0, thumbnailsDeleted: 1, objectsRemoved: 1 });
    expect(uow.media.rows.get(thumbnail.id)?.deletedAt).toEqual(NOW);
    expect(has(storage, thumbnail)).toBe(false);
  });

  it('không xóa thumbnail còn media gốc', async () => {
    const { uow, cleanup, seed } = setup();
    const source = await seed({ createdAt: hoursAgo(1), updatedAt: hoursAgo(1) });
    const thumbnail = await seed({ sourceMediaId: source.id });

    const summary = await cleanup.execute({ retentionHours: 24 });

    expect(summary.thumbnailsDeleted).toBe(0);
    expect(uow.media.rows.get(thumbnail.id)?.deletedAt).toBeNull();
  });

  it('phục hồi upload PENDING stale: xóa object tạm/cuối mồ côi và chuyển FAILED', async () => {
    const { uow, storage, cleanup, seed } = setup();
    const stale = await seed({
      status: 'PENDING',
      objectKey: 'final/stale.png',
      tmpObjectKey: 'tmp/stale.png',
      uploadExpiresAt: new Date(NOW.getTime() - 60 * 60_000),
    });
    // Crash giữa copy và commit: object cuối cũng đã có ngoài object tạm.
    await storage.put('images', 'final/stale.png', Buffer.from('x'), 'image/png');
    const abandonedBeforeUpload = await seed({
      status: 'PENDING',
      objectKey: 'final/empty.png',
      tmpObjectKey: 'tmp/empty.png',
      uploadExpiresAt: new Date(NOW.getTime() - 60 * 60_000),
    });
    // Client không bao giờ upload: không có object nào để xóa.
    storage.objects.delete('images/tmp/empty.png');
    const fresh = await seed({
      status: 'PENDING',
      objectKey: 'final/fresh.png',
      tmpObjectKey: 'tmp/fresh.png',
      uploadExpiresAt: new Date(NOW.getTime() + 10 * 60_000),
    });
    const withinGrace = await seed({
      status: 'PENDING',
      objectKey: 'final/grace.png',
      tmpObjectKey: 'tmp/grace.png',
      uploadExpiresAt: new Date(NOW.getTime() - 5 * 60_000),
    });

    const summary = await cleanup.execute({});

    expect(summary).toMatchObject({
      pendingGraceMinutes: 15,
      pendingRecovered: 2,
      pendingOrphanObjectsRemoved: 2,
      failed: 0,
    });
    for (const recovered of [stale, abandonedBeforeUpload]) {
      expect(uow.media.rows.get(recovered.id)).toMatchObject({
        status: 'FAILED',
        tmpObjectKey: null,
        failureReason: UPLOAD_ABANDONED,
      });
    }
    expect(storage.objects.has('images/tmp/stale.png')).toBe(false);
    expect(storage.objects.has('images/final/stale.png')).toBe(false);
    expect(uow.media.rows.get(fresh.id)?.status).toBe('PENDING');
    expect(uow.media.rows.get(withinGrace.id)?.status).toBe('PENDING');
    expect(storage.objects.has('images/tmp/fresh.png')).toBe(true);
  });

  it('PENDING không có hạn presigned dùng ngày tạo để xác định stale', async () => {
    const { uow, cleanup, seed } = setup();
    const old = await seed({ status: 'PENDING', createdAt: hoursAgo(3), uploadExpiresAt: null });

    const summary = await cleanup.execute({});

    expect(summary.pendingRecovered).toBe(1);
    expect(uow.media.rows.get(old.id)?.status).toBe('FAILED');
  });

  it('chạy lặp là idempotent và đối tượng đã mất sẵn không phải lỗi', async () => {
    const { uow, storage, cleanup, seed } = setup();
    const gone = await seed({});
    storage.objects.clear();

    const first = await cleanup.execute({ retentionHours: 24 });
    const second = await cleanup.execute({ retentionHours: 24 });

    expect(first).toMatchObject({ unusedDeleted: 1, failed: 0 });
    expect(second).toMatchObject({
      unusedDeleted: 0,
      thumbnailsDeleted: 0,
      objectsRemoved: 0,
      pendingRecovered: 0,
      skipped: 0,
      failed: 0,
    });
    expect(uow.media.rows.get(gone.id)?.deletedAt).toEqual(NOW);
  });

  it('MinIO lỗi: rollback, media giữ nguyên, đếm failed và lần sau thử lại được', async () => {
    const errors: string[] = [];
    const { uow, storage, cleanup, seed } = setup({ onItemError: (id) => errors.push(id) });
    const unused = await seed({});
    storage.failRemove = true;

    const failed = await cleanup.execute({ retentionHours: 24 });

    expect(failed).toMatchObject({ unusedDeleted: 0, objectsRemoved: 0, failed: 1 });
    expect(errors).toEqual([unused.id]);
    expect(uow.media.rows.get(unused.id)?.deletedAt).toBeNull();

    storage.failRemove = false;
    const retried = await cleanup.execute({ retentionHours: 24 });
    expect(retried).toMatchObject({ unusedDeleted: 1, failed: 0 });
  });

  it('bỏ qua media vừa có usage sau khi được chọn hoặc đang bị lượt khác khóa', async () => {
    const { uow, cleanup, seed, attach } = setup();
    const raced = await seed({});
    const locked = await seed({});
    uow.media.lockedByOthers.add(locked.id);
    // Usage xuất hiện giữa lúc liệt kê ứng viên và lúc khóa dòng.
    const listUnused = uow.media.listUnusedReadyIds.bind(uow.media);
    uow.media.listUnusedReadyIds = async (olderThan, limit) => {
      const ids = await listUnused(olderThan, limit);
      attach(raced.id);
      return ids;
    };

    const summary = await cleanup.execute({ retentionHours: 24 });

    expect(summary).toMatchObject({ unusedDeleted: 0, skipped: 2, failed: 0 });
    expect(uow.media.rows.get(raced.id)?.deletedAt).toBeNull();
    expect(uow.media.rows.get(locked.id)?.deletedAt).toBeNull();
  });

  it('giới hạn limit mỗi pha và báo has_more', async () => {
    const { uow, cleanup, seed } = setup();
    for (let i = 0; i < 3; i += 1) await seed({});

    const first = await cleanup.execute({ retentionHours: 24, limit: 2 });
    expect(first).toMatchObject({ unusedDeleted: 2, hasMore: true });

    const second = await cleanup.execute({ retentionHours: 24, limit: 2 });
    expect(second).toMatchObject({ unusedDeleted: 1, hasMore: false });
    expect([...uow.media.rows.values()].every((row) => row.deletedAt)).toBe(true);
  });

  it('dùng mặc định từ cấu hình và từ chối tham số ngoài biên', async () => {
    const { cleanup } = setup();

    await expect(cleanup.execute({})).resolves.toMatchObject({
      retentionHours: 168,
      pendingGraceMinutes: 15,
      limit: 200,
    });
    await expect(cleanup.execute({ retentionHours: 0 })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    await expect(cleanup.execute({ retentionHours: 9_000 })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    await expect(cleanup.execute({ limit: 5_000 })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });
});

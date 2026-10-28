import { createHash } from 'node:crypto';

import type { Clock, IdGenerator, Principal } from '@aiops-lms/common/ports';

import { CompleteDirectUploadUseCase } from '../../src/application/use-cases/media/complete-direct-upload.use-case.js';
import { CreateUploadIntentUseCase } from '../../src/application/use-cases/media/create-upload-intent.use-case.js';
import { RetryMediaThumbnailUseCase } from '../../src/application/use-cases/media/retry-media-thumbnail.use-case.js';
import { UploadMediaUseCase } from '../../src/application/use-cases/media/upload-media.use-case.js';
import { FakeStorage, InMemoryUnitOfWork } from './fakes.js';

const clock: Clock = { now: () => new Date('2026-10-28T10:00:00Z') };

function sequentialIds(): IdGenerator {
  let n = 0;
  return {
    next: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  };
}

const owner: Principal = { id: '11111111-1111-4111-8111-111111111111', role: 'instructor' };
const other: Principal = { id: '22222222-2222-4222-8222-222222222222', role: 'instructor' };
const sha = (content: Buffer): string => createHash('sha256').update(content).digest('hex');

function setup(): {
  uow: InMemoryUnitOfWork;
  storage: FakeStorage;
  upload: UploadMediaUseCase;
  intent: CreateUploadIntentUseCase;
  complete: CompleteDirectUploadUseCase;
  retry: RetryMediaThumbnailUseCase;
} {
  const uow = new InMemoryUnitOfWork();
  const storage = new FakeStorage();
  const ids = sequentialIds();
  return {
    uow,
    storage,
    upload: new UploadMediaUseCase(uow, storage, ids, clock),
    intent: new CreateUploadIntentUseCase(uow, storage, ids, clock, 900),
    complete: new CompleteDirectUploadUseCase(uow, storage, ids, clock),
    retry: new RetryMediaThumbnailUseCase(uow, ids),
  };
}

describe('UploadMediaUseCase', () => {
  it('ghi object vào bucket/key theo ngày UTC, READY và phát command thumbnail cho ảnh', async () => {
    const { uow, storage, upload } = setup();
    const content = Buffer.from('png-bytes');

    const media = await upload.execute(owner, {
      content,
      originalName: 'Ảnh.PNG',
      mimeType: 'image/png',
    });

    expect(media).toMatchObject({
      type: 'IMAGE',
      status: 'READY',
      thumbnailStatus: 'PENDING',
      bucket: 'images',
      objectKey: `2026/10/28/${media.id}.png`,
      checksumSha256: sha(content),
      uploadedBy: owner.id,
    });
    expect(storage.objects.has(`images/${media.objectKey}`)).toBe(true);
    expect(uow.commands).toEqual([`thumbnail:${media.id}`]);
    expect([...uow.jobs.rows.values()][0]).toMatchObject({
      type: 'THUMBNAIL_DERIVATION',
      deduplicationKey: `thumbnail:${media.id}`,
    });
  });

  it('tài liệu không phát command thumbnail', async () => {
    const { uow, upload } = setup();
    const media = await upload.execute(owner, {
      content: Buffer.from('%PDF'),
      originalName: 'a.pdf',
      mimeType: 'application/pdf',
    });
    expect(media).toMatchObject({ type: 'DOCUMENT', thumbnailStatus: 'NOT_APPLICABLE' });
    expect(uow.commands).toEqual([]);
  });

  it('từ chối file rỗng và file vượt giới hạn của loại', async () => {
    const { upload } = setup();
    await expect(
      upload.execute(owner, {
        content: Buffer.alloc(0),
        originalName: 'a.png',
        mimeType: 'image/png',
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      upload.execute(owner, {
        content: Buffer.alloc(10 * 1024 * 1024 + 1),
        originalName: 'a.png',
        mimeType: 'image/png',
      }),
    ).rejects.toMatchObject({ code: 'MEDIA_TOO_LARGE', status: 413 });
  });

  it('DB lỗi thì xóa object đã ghi, không để mồ côi', async () => {
    const { uow, storage, upload } = setup();
    uow.run = () => Promise.reject(new Error('db down'));
    await expect(
      upload.execute(owner, {
        content: Buffer.from('x'),
        originalName: 'a.png',
        mimeType: 'image/png',
      }),
    ).rejects.toThrow('db down');
    expect(storage.objects.size).toBe(0);
  });
});

describe('upload trực tiếp (intent → complete)', () => {
  const content = Buffer.from('direct-upload-bytes');

  async function intentFor(
    ctx: ReturnType<typeof setup>,
    checksum = sha(content),
  ): Promise<{ id: string; tmpKey: string; finalKey: string }> {
    const result = await ctx.intent.execute(owner, {
      fileName: 'bai.png',
      mimeType: 'image/png',
      sizeBytes: content.length,
      checksumSha256: checksum,
    });
    const media = (await ctx.uow.media.findById(result.mediaId))!;
    return { id: media.id, tmpKey: media.tmpObjectKey!, finalKey: media.objectKey };
  }

  it('intent tạo media PENDING với key tạm và key cuối cùng theo quy ước', async () => {
    const ctx = setup();
    const { id, tmpKey, finalKey } = await intentFor(ctx);
    expect(tmpKey).toBe(`tmp/${id}.png`);
    expect(finalKey).toBe(`2026/10/28/${id}.png`);
    expect(await ctx.uow.media.findById(id)).toMatchObject({
      status: 'PENDING',
      bucket: 'images',
      uploadExpiresAt: new Date('2026-10-28T10:15:00Z'),
    });
  });

  it('complete: promote sang key cuối cùng, xóa key tạm, READY, phát command thumbnail', async () => {
    const ctx = setup();
    const { id, tmpKey, finalKey } = await intentFor(ctx);
    await ctx.storage.put('images', tmpKey, content, 'image/png');

    const media = await ctx.complete.execute(owner, id);

    expect(media).toMatchObject({
      status: 'READY',
      tmpObjectKey: null,
      thumbnailStatus: 'PENDING',
    });
    expect(ctx.storage.objects.has(`images/${finalKey}`)).toBe(true);
    expect(ctx.storage.objects.has(`images/${tmpKey}`)).toBe(false);
    expect(ctx.uow.commands).toEqual([`thumbnail:${id}`]);
    // Gọi lại là no-op: không phát thêm command.
    await ctx.complete.execute(owner, id);
    expect(ctx.uow.commands).toHaveLength(1);
  });

  it('sai checksum: xóa object tạm, FAILED, MEDIA_CHECKSUM_MISMATCH', async () => {
    const ctx = setup();
    const { id, tmpKey } = await intentFor(ctx, 'f'.repeat(64));
    await ctx.storage.put('images', tmpKey, content, 'image/png');

    await expect(ctx.complete.execute(owner, id)).rejects.toMatchObject({
      code: 'MEDIA_CHECKSUM_MISMATCH',
      status: 400,
    });
    expect(ctx.storage.objects.size).toBe(0);
    expect(await ctx.uow.media.findById(id)).toMatchObject({ status: 'FAILED' });
    expect(ctx.uow.commands).toEqual([]);
  });

  it('sai dung lượng cũng bị coi là không khớp', async () => {
    const ctx = setup();
    const { id, tmpKey } = await intentFor(ctx);
    await ctx.storage.put('images', tmpKey, Buffer.from('ngắn'), 'image/png');
    await expect(ctx.complete.execute(owner, id)).rejects.toMatchObject({
      code: 'MEDIA_CHECKSUM_MISMATCH',
    });
  });

  it('chưa upload hoặc phiên hết hạn → MEDIA_UPLOAD_NOT_COMPLETED', async () => {
    const ctx = setup();
    const { id } = await intentFor(ctx);
    await expect(ctx.complete.execute(owner, id)).rejects.toMatchObject({
      code: 'MEDIA_UPLOAD_NOT_COMPLETED',
    });

    const late = new CompleteDirectUploadUseCase(ctx.uow, ctx.storage, sequentialIds(), {
      now: () => new Date('2026-10-28T11:00:00Z'),
    });
    await expect(late.execute(owner, id)).rejects.toMatchObject({
      code: 'MEDIA_UPLOAD_NOT_COMPLETED',
    });
  });

  it('chỉ chủ sở hữu hoặc admin được hoàn tất', async () => {
    const ctx = setup();
    const { id } = await intentFor(ctx);
    await expect(ctx.complete.execute(other, id)).rejects.toMatchObject({ status: 403 });
  });

  it('intent từ chối file vượt giới hạn trước khi ký URL', async () => {
    const ctx = setup();
    await expect(
      ctx.intent.execute(owner, {
        fileName: 'a.png',
        mimeType: 'image/png',
        sizeBytes: 10 * 1024 * 1024 + 1,
        checksumSha256: 'a'.repeat(64),
      }),
    ).rejects.toMatchObject({ code: 'MEDIA_TOO_LARGE' });
    expect(ctx.uow.media.rows.size).toBe(0);
  });
});

describe('RetryMediaThumbnailUseCase', () => {
  it('đặt lại job FAILED về QUEUED và phát command mới', async () => {
    const ctx = setup();
    const media = await ctx.upload.execute(owner, {
      content: Buffer.from('x'),
      originalName: 'a.png',
      mimeType: 'image/png',
    });
    await ctx.uow.media.update(media.id, { thumbnailStatus: 'FAILED' });
    const job = (await ctx.uow.jobs.findByKey(`thumbnail:${media.id}`))!;
    await ctx.uow.jobs.update(job.id, { status: 'FAILED', lastError: 'boom' });

    const retried = await ctx.retry.execute(owner, media.id);

    expect(retried.thumbnailStatus).toBe('PENDING');
    expect(await ctx.uow.jobs.findById(job.id)).toMatchObject({
      status: 'QUEUED',
      lastError: null,
    });
    expect(ctx.uow.commands).toHaveLength(2);
  });

  it('đã READY thì không làm gì; tài liệu và người lạ bị từ chối', async () => {
    const ctx = setup();
    const media = await ctx.upload.execute(owner, {
      content: Buffer.from('x'),
      originalName: 'a.png',
      mimeType: 'image/png',
    });
    await ctx.uow.media.update(media.id, { thumbnailStatus: 'READY' });
    await ctx.retry.execute(owner, media.id);
    expect(ctx.uow.commands).toHaveLength(1);
    await expect(ctx.retry.execute(other, media.id)).rejects.toMatchObject({ status: 403 });

    const doc = await ctx.upload.execute(owner, {
      content: Buffer.from('x'),
      originalName: 'a.txt',
      mimeType: 'text/plain',
    });
    await expect(ctx.retry.execute(owner, doc.id)).rejects.toMatchObject({ status: 400 });
  });
});

import { createHash } from 'node:crypto';

import type { Clock, IdGenerator, Principal } from '@aiops-lms/common/ports';

import { CompleteDirectUploadUseCase } from '../../src/application/use-cases/media/complete-direct-upload.use-case.js';
import { CreateUploadIntentUseCase } from '../../src/application/use-cases/media/create-upload-intent.use-case.js';
import { UploadMediaUseCase } from '../../src/application/use-cases/media/upload-media.use-case.js';
import { EXTRACT_TEXT_MAX_BYTES, isExtractableDocument } from '../../src/domain/media-type.js';
import { FakeStorage, InMemoryUnitOfWork } from './fakes.js';

const clock: Clock = { now: () => new Date('2026-10-28T10:00:00Z') };
const owner: Principal = { id: '11111111-1111-4111-8111-111111111111', role: 'instructor' };
const sha = (content: Buffer): string => createHash('sha256').update(content).digest('hex');

function setup(): {
  uow: InMemoryUnitOfWork;
  storage: FakeStorage;
  upload: UploadMediaUseCase;
  intent: CreateUploadIntentUseCase;
  complete: CompleteDirectUploadUseCase;
} {
  const uow = new InMemoryUnitOfWork();
  const storage = new FakeStorage();
  let n = 0;
  const ids: IdGenerator = {
    next: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  };
  return {
    uow,
    storage,
    upload: new UploadMediaUseCase(uow, storage, ids, clock),
    intent: new CreateUploadIntentUseCase(uow, storage, ids, clock, 900),
    complete: new CompleteDirectUploadUseCase(uow, storage, ids, clock),
  };
}

describe('isExtractableDocument', () => {
  it('khớp bảng định dạng của ai (MIME trước, đuôi tệp sau)', () => {
    // Cùng bảng ví dụ với `classifyDocument` trong services/ai/test/unit/lesson-ai-domain.spec.ts.
    expect(isExtractableDocument('a.bin', 'application/pdf')).toBe(true);
    expect(isExtractableDocument('Bai.MD', 'application/octet-stream')).toBe(true);
    expect(isExtractableDocument('a', 'text/plain; charset=utf-8')).toBe(true);
    expect(isExtractableDocument('a.docx', 'application/octet-stream')).toBe(true);
    expect(isExtractableDocument('anh.JPG', 'application/octet-stream')).toBe(true);
    expect(isExtractableDocument('a.png', 'image/png')).toBe(true);
    expect(isExtractableDocument('phim.mp4', 'video/mp4')).toBe(false);
    expect(isExtractableDocument('khong-duoi', 'application/zip')).toBe(false);
    expect(isExtractableDocument('bang.xlsx', 'application/vnd.ms-excel')).toBe(false);
  });
});

describe('extract_text khi upload multipart', () => {
  it('tệp hợp lệ: lưu cờ và ghi lệnh trích văn bản vào outbox cùng transaction', async () => {
    const { uow, upload } = setup();

    const media = await upload.execute(owner, {
      content: Buffer.from('xin chào'),
      originalName: 'bai.txt',
      extractText: true,
    });

    expect(media).toMatchObject({ status: 'READY', extractText: true });
    expect(uow.commands).toEqual([`extract:${media.id}`]);
  });

  it('không có cờ: không phát lệnh và extractText = false', async () => {
    const { uow, upload } = setup();

    const media = await upload.execute(owner, {
      content: Buffer.from('xin chào'),
      originalName: 'bai.txt',
    });

    expect(media.extractText).toBe(false);
    expect(uow.commands).toEqual([]);
  });

  it('loại tệp không hỗ trợ hoặc quá 15 MB: 400 VALIDATION_ERROR, không tạo media, không phát lệnh', async () => {
    const { uow, upload } = setup();

    await expect(
      upload.execute(owner, {
        content: Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom')]),
        originalName: 'phim.mp4',
        extractText: true,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 });
    await expect(
      upload.execute(owner, {
        content: Buffer.concat([Buffer.from('%PDF-1.4'), Buffer.alloc(EXTRACT_TEXT_MAX_BYTES)]),
        originalName: 'lon.pdf',
        extractText: true,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 });

    expect(uow.media.rows.size).toBe(0);
    expect(uow.commands).toEqual([]);
  });
});

describe('extract_text khi upload trực tiếp', () => {
  const content = Buffer.from('direct-upload-bytes');
  const input = {
    fileName: 'bai.pdf',
    mimeType: 'application/pdf',
    sizeBytes: content.length,
    checksumSha256: sha(content),
    extractText: true,
  };

  async function pending(ctx: ReturnType<typeof setup>, storageContent = content): Promise<string> {
    const result = await ctx.intent.execute(owner, input);
    const media = (await ctx.uow.media.findById(result.mediaId))!;
    // Mô phỏng client đã upload object tạm.
    await ctx.storage.put(media.bucket, media.tmpObjectKey!, storageContent, input.mimeType);
    return media.id;
  }

  it('intent lưu cờ nhưng chưa phát lệnh (tệp chưa READY)', async () => {
    const ctx = setup();

    const result = await ctx.intent.execute(owner, input);

    expect((await ctx.uow.media.findById(result.mediaId))?.extractText).toBe(true);
    expect(ctx.uow.commands).toEqual([]);
  });

  it('intent từ chối cờ với tệp không hỗ trợ', async () => {
    const ctx = setup();

    await expect(
      ctx.intent.execute(owner, { ...input, fileName: 'phim.mp4', mimeType: 'video/mp4' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 });
    expect(ctx.uow.media.rows.size).toBe(0);
  });

  it('upload-complete chuyển READY và phát đúng một lệnh; gọi lại không phát thêm', async () => {
    const ctx = setup();
    const id = await pending(ctx);

    await ctx.complete.execute(owner, id);
    await ctx.complete.execute(owner, id);

    expect(ctx.uow.commands).toEqual([`extract:${id}`]);
  });

  it('checksum sai: FAILED và không phát lệnh', async () => {
    const ctx = setup();
    const id = await pending(ctx, Buffer.from('noi-dung-khac-nhau!'));

    await expect(ctx.complete.execute(owner, id)).rejects.toMatchObject({ status: 400 });

    expect(ctx.uow.commands).toEqual([]);
  });
});

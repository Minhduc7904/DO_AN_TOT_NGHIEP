import { AppError } from '@aiops-lms/common/errors';

import { ExtractDocumentUseCase } from '../../src/application/use-cases/documents/extract-document.use-case.js';
import { QueryDocumentsUseCase } from '../../src/application/use-cases/documents/query-documents.use-case.js';
import { SyncDocumentsUseCase } from '../../src/application/use-cases/documents/sync-documents.use-case.js';
import { AI_LIMITS } from '../../src/domain/lesson-ai.js';
import { FakeClock, SequenceIds } from './fakes.js';
import {
  FakeDocx,
  FakeMedia,
  InMemoryAiUnitOfWork,
  NOW,
  ScriptedCompletions,
  textReply,
} from './lesson-ai-fakes.js';

const LEASE_MS = 600_000;
const CONSUMER = 'ai-worker--extract-ai-document-v1';
const MEDIA_A = 'd0000000-0000-4000-8000-00000000000a';
const MEDIA_B = 'd0000000-0000-4000-8000-00000000000b';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

type Script = ConstructorParameters<typeof ScriptedCompletions>[0];

function setup(script: Script = []): {
  uow: InMemoryAiUnitOfWork;
  media: FakeMedia;
  completions: ScriptedCompletions;
  clock: FakeClock;
  sync: SyncDocumentsUseCase;
  query: QueryDocumentsUseCase;
  extract: ExtractDocumentUseCase;
  run: (
    mediaId: string,
    fileName: string,
    contentType: string,
    messageId?: string,
  ) => Promise<void>;
} {
  const uow = new InMemoryAiUnitOfWork();
  const media = new FakeMedia();
  const completions = new ScriptedCompletions(script);
  const clock = new FakeClock(NOW);
  const ids = new SequenceIds();
  const extract = new ExtractDocumentUseCase(
    uow,
    media,
    completions,
    new FakeDocx(),
    ids,
    clock,
    CONSUMER,
    LEASE_MS,
  );
  return {
    uow,
    media,
    completions,
    clock,
    sync: new SyncDocumentsUseCase(uow, ids, clock),
    query: new QueryDocumentsUseCase(uow.documents),
    extract,
    run: (mediaId, fileName, contentType, messageId = `m-${mediaId}`) =>
      extract.execute(messageId, { mediaId, fileName, contentType, mediaType: 'DOCUMENT' }),
  };
}

describe('SyncDocuments / QueryDocuments', () => {
  const doc = (
    mediaId: string,
    fileName: string,
    contentType: string,
  ): { mediaId: string; fileName: string; contentType: string; mediaType: string } => ({
    mediaId,
    fileName,
    contentType,
    mediaType: 'DOCUMENT',
  });

  it('thêm PENDING (gửi command) hoặc UNSUPPORTED (không gửi), idempotent, trả theo thứ tự đầu vào', async () => {
    const { sync, uow } = setup();

    const first = await sync.execute(
      [doc(MEDIA_A, 'a.txt', 'text/plain'), doc(MEDIA_B, 'phim.mp4', 'video/mp4')],
      false,
    );

    expect(first.map((d) => [d.mediaId, d.status])).toEqual([
      [MEDIA_A, 'PENDING'],
      [MEDIA_B, 'UNSUPPORTED'],
    ]);
    expect(uow.sent).toEqual([
      {
        name: 'ai.document.extract',
        payload: {
          mediaId: MEDIA_A,
          fileName: 'a.txt',
          contentType: 'text/plain',
          mediaType: 'DOCUMENT',
        },
      },
    ]);

    await sync.execute([doc(MEDIA_A, 'a.txt', 'text/plain')], false);
    expect(uow.sent).toHaveLength(1);
  });

  it('retry_failed đặt FAILED về PENDING và gửi lại command; không có cờ thì giữ FAILED', async () => {
    const { sync, uow } = setup();
    await sync.execute([doc(MEDIA_A, 'a.txt', 'text/plain')], false);
    Object.assign(uow.documents.byMedia(MEDIA_A) ?? {}, {
      status: 'FAILED',
      errorCode: 'EXTRACTION_EMPTY',
      attemptCount: 1,
    });
    uow.sent.length = 0;

    expect((await sync.execute([doc(MEDIA_A, 'a.txt', 'text/plain')], false))[0]?.status).toBe(
      'FAILED',
    );
    expect(uow.sent).toHaveLength(0);

    const retried = await sync.execute([doc(MEDIA_A, 'a.txt', 'text/plain')], true);
    expect(retried[0]).toMatchObject({ status: 'PENDING', errorCode: null });
    expect(uow.documents.byMedia(MEDIA_A)?.attemptCount).toBe(0);
    expect(uow.sent).toHaveLength(1);
  });

  it('PROCESSING quá hạn lease được gửi lại; hết lượt thử thì FAILED EXTRACTION_INTERRUPTED', async () => {
    const { sync, uow, clock } = setup();
    await sync.execute([doc(MEDIA_A, 'a.txt', 'text/plain')], false);
    const row = uow.documents.byMedia(MEDIA_A);
    if (!row) throw new Error('thiếu tài liệu');
    uow.sent.length = 0;

    Object.assign(row, {
      status: 'PROCESSING',
      attemptCount: 1,
      leaseExpiresAt: new Date(NOW.getTime() + 1),
    });
    await sync.execute([doc(MEDIA_A, 'a.txt', 'text/plain')], false);
    expect(row.status).toBe('PROCESSING');
    expect(uow.sent).toHaveLength(0);

    clock.advance(10);
    await sync.execute([doc(MEDIA_A, 'a.txt', 'text/plain')], false);
    expect(row.status).toBe('PENDING');
    expect(uow.sent).toHaveLength(1);

    Object.assign(row, {
      status: 'PROCESSING',
      attemptCount: AI_LIMITS.maxExtractionAttempts,
      leaseExpiresAt: new Date(NOW.getTime() - 1),
    });
    await sync.execute([doc(MEDIA_A, 'a.txt', 'text/plain')], false);
    expect(row).toMatchObject({ status: 'FAILED', errorCode: 'EXTRACTION_INTERRUPTED' });
    expect(uow.sent).toHaveLength(1);
  });

  it('query trả một phần tử cho mỗi tệp: NOT_QUEUED hoặc UNSUPPORTED khi chưa có bản ghi, không ghi, không kèm văn bản', async () => {
    const { sync, query, uow } = setup();
    await sync.execute([doc(MEDIA_A, 'a.txt', 'text/plain')], false);

    const found = await query.execute([
      doc(MEDIA_B, 'b.pdf', 'application/pdf'),
      doc(MEDIA_A, 'a.txt', 'text/plain'),
      doc('d0000000-0000-4000-8000-00000000000c', 'phim.mp4', 'video/mp4'),
    ]);

    expect(found.map((d) => [d.mediaId, d.status, d.updatedAt === null])).toEqual([
      [MEDIA_B, 'NOT_QUEUED', true],
      [MEDIA_A, 'PENDING', false],
      ['d0000000-0000-4000-8000-00000000000c', 'UNSUPPORTED', true],
    ]);
    expect(found[1]).not.toHaveProperty('text');
    expect(uow.documents.rows.size).toBe(1);
    expect(uow.sent).toHaveLength(1);
  });
});

describe('ExtractDocument (ai.document.extract)', () => {
  it('TXT/MD đọc thẳng, DOCX qua parser, không tốn lượt gọi provider; tự tạo bản ghi nếu chưa có', async () => {
    const { run, media, uow, completions } = setup();
    media.add(MEDIA_A, 'Xin chào  ');
    media.add(MEDIA_B, 'Nội dung docx');

    await run(MEDIA_A, 'a.txt', 'text/plain');
    await run(MEDIA_B, 'b.docx', DOCX);

    expect(uow.documents.byMedia(MEDIA_A)).toMatchObject({
      status: 'EXTRACTED',
      text: 'Xin chào',
      textLength: 8,
    });
    expect(uow.documents.byMedia(MEDIA_B)?.text).toBe('# DOCX\n\nNội dung docx');
    expect(completions.requests).toHaveLength(0);
  });

  it('PDF và ảnh gửi base64 cho provider (task document-extraction); finish_reason length được ghi chú', async () => {
    const { run, media, uow, completions } = setup([
      textReply('# Từ PDF'),
      textReply('Chữ trong ảnh', 'length'),
    ]);
    media.add(MEDIA_A, new Uint8Array([1, 2, 3]));
    media.add(MEDIA_B, new Uint8Array([4, 5]));

    await run(MEDIA_A, 'a.pdf', 'application/pdf');
    await run(MEDIA_B, 'b.png', 'image/png');

    expect(completions.requests[0]).toMatchObject({ task: 'document-extraction' });
    const parts = (completions.requests[0]?.messages[1] as { parts: unknown[] }).parts;
    expect(parts[1]).toEqual({
      type: 'file',
      mediaType: 'application/pdf',
      dataBase64: 'AQID',
      fileName: 'a.pdf',
    });
    expect((completions.requests[1]?.messages[1] as { parts: unknown[] }).parts[1]).toEqual({
      type: 'image',
      mediaType: 'image/png',
      dataBase64: 'BAU=',
    });
    expect(uow.documents.byMedia(MEDIA_A)?.text).toBe('# Từ PDF');
    expect(uow.documents.byMedia(MEDIA_B)?.text).toContain('chưa đầy đủ');
  });

  it('văn bản quá 300.000 ký tự bị cắt kèm ghi chú', async () => {
    const { run, media, uow } = setup();
    media.add(MEDIA_A, 'x'.repeat(300_500));

    await run(MEDIA_A, 'dai.txt', 'text/plain');

    const text = uow.documents.byMedia(MEDIA_A)?.text ?? '';
    expect(text.startsWith('x'.repeat(300_000))).toBe(true);
    expect(text).toContain('đã bị cắt');
  });

  it('lỗi được ghi vào tài liệu: rỗng, DOCX hỏng, media không đọc được, provider lỗi (giữ mã), quá lớn', async () => {
    const { run, media, uow } = setup([
      new AppError('AI_TASK_NOT_CONFIGURED', 409, 'Tác vụ chưa cấu hình model'),
    ]);
    const ids = [0, 1, 2, 3, 4].map((n) => `d0000000-0000-4000-8000-00000000010${n}`);
    media.add(ids[0] ?? '', '   ');
    media.add(ids[1] ?? '', 'hỏng');
    media.add(ids[2] ?? '', new Uint8Array([1]));
    media.add(ids[4] ?? '', new Uint8Array(AI_LIMITS.maxDocumentBytes + 1));

    await run(ids[0] ?? '', 'rong.txt', 'text/plain');
    await run(ids[1] ?? '', 'hong.docx', DOCX);
    await run(ids[2] ?? '', 'a.pdf', 'application/pdf');
    await run(ids[3] ?? '', 'thieu.txt', 'text/plain');
    await run(ids[4] ?? '', 'lon.txt', 'text/plain');

    expect(
      ids.map((id) => [uow.documents.byMedia(id)?.status, uow.documents.byMedia(id)?.errorCode]),
    ).toEqual([
      ['FAILED', 'EXTRACTION_EMPTY'],
      ['FAILED', 'EXTRACTION_FAILED'],
      ['FAILED', 'AI_TASK_NOT_CONFIGURED'],
      ['FAILED', 'NOT_FOUND'],
      ['FAILED', 'DOCUMENT_TOO_LARGE'],
    ]);
  });

  it('định dạng không hỗ trợ: giữ UNSUPPORTED, không tải nội dung', async () => {
    const { run, media, uow } = setup();

    await run(MEDIA_A, 'phim.mp4', 'video/mp4');

    expect(uow.documents.byMedia(MEDIA_A)?.status).toBe('UNSUPPORTED');
    expect(media.downloads).toEqual([]);
  });

  it('giao lại: tài liệu đã xong hoặc đang được xử lý (lease còn hạn) thì không làm gì', async () => {
    const { run, media, uow, completions } = setup([textReply('x')]);
    media.add(MEDIA_A, new Uint8Array([1]));

    await run(MEDIA_A, 'a.pdf', 'application/pdf', 'm1');
    await run(MEDIA_A, 'a.pdf', 'application/pdf', 'm2');
    expect(completions.requests).toHaveLength(1);
    expect(uow.documents.byMedia(MEDIA_A)?.status).toBe('EXTRACTED');

    const row = uow.documents.byMedia(MEDIA_A);
    if (!row) throw new Error('thiếu tài liệu');
    Object.assign(row, {
      status: 'PROCESSING',
      attemptCount: 1,
      leaseExpiresAt: new Date(NOW.getTime() + 1),
    });
    media.downloads.length = 0;
    await run(MEDIA_A, 'a.pdf', 'application/pdf', 'm3');
    expect(media.downloads).toEqual([]);
    expect(row.status).toBe('PROCESSING');
  });

  it('lease: PROCESSING quá hạn được nhận lại; đủ 3 lần thử thì FAILED EXTRACTION_INTERRUPTED không tải', async () => {
    const { run, media, uow } = setup();
    media.add(MEDIA_A, 'nội dung');
    await run(MEDIA_A, 'a.txt', 'text/plain', 'm0');
    const row = uow.documents.byMedia(MEDIA_A);
    if (!row) throw new Error('thiếu tài liệu');

    Object.assign(row, {
      status: 'PROCESSING',
      attemptCount: 1,
      leaseExpiresAt: new Date(NOW.getTime() - 1),
    });
    await run(MEDIA_A, 'a.txt', 'text/plain', 'm1');
    expect(row).toMatchObject({ status: 'EXTRACTED', attemptCount: 2 });

    Object.assign(row, {
      status: 'PROCESSING',
      attemptCount: AI_LIMITS.maxExtractionAttempts,
      leaseExpiresAt: new Date(NOW.getTime() - 1),
    });
    media.downloads.length = 0;
    await run(MEDIA_A, 'a.txt', 'text/plain', 'm2');
    expect(row).toMatchObject({ status: 'FAILED', errorCode: 'EXTRACTION_INTERRUPTED' });
    expect(media.downloads).toEqual([]);
  });

  it('markFaulted: command vào hàng đợi lỗi thì tài liệu PENDING/PROCESSING thành FAILED, tài liệu đã xong giữ nguyên', async () => {
    const { extract, sync, uow, media, run } = setup();
    await sync.execute(
      [{ mediaId: MEDIA_A, fileName: 'a.txt', contentType: 'text/plain', mediaType: 'DOCUMENT' }],
      false,
    );
    await extract.markFaulted(MEDIA_A);
    expect(uow.documents.byMedia(MEDIA_A)).toMatchObject({
      status: 'FAILED',
      errorCode: 'EXTRACTION_FAILED',
    });

    media.add(MEDIA_B, 'ok');
    await run(MEDIA_B, 'b.txt', 'text/plain');
    await extract.markFaulted(MEDIA_B);
    expect(uow.documents.byMedia(MEDIA_B)?.status).toBe('EXTRACTED');
  });
});

import {
  MEDIA_COMMANDS,
  mediaCommandFixtures,
  markdownUsageSynchronizePayloadSchema,
  notificationUsageCompleteJobPayloadSchema,
  notificationUsageRegisterBatchPayloadSchema,
  notificationUsageRegisterPayloadSchema,
  notificationUsageStartJobPayloadSchema,
  thumbnailGeneratePayloadSchema,
  usagesDeleteByIdsPayloadSchema,
} from '@aiops-lms/contracts/commands';
import { buildQueueName } from '@aiops-lms/common/messaging';

import { parseRange } from '../../src/domain/http-range.js';
import { evaluateJobStatus } from '../../src/domain/job-progress.js';
import { extractMediaIds } from '../../src/domain/markdown-media.js';
import {
  BUCKET_BY_TYPE,
  classifyMedia,
  MEDIA_SIZE_LIMITS,
  supportsThumbnail,
} from '../../src/domain/media-type.js';
import { buildObjectKey, buildTmpObjectKey, safeExtension } from '../../src/domain/object-key.js';

describe('phân loại media', () => {
  it.each([
    ['image/png', 'IMAGE'],
    ['VIDEO/MP4', 'VIDEO'],
    ['audio/mpeg', 'AUDIO'],
    ['application/pdf', 'DOCUMENT'],
    ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'DOCUMENT'],
    ['text/plain', 'DOCUMENT'],
    ['application/zip', 'OTHER'],
  ])('%s → %s', (mime, type) => {
    expect(classifyMedia(mime)).toBe(type);
  });

  it('giới hạn và bucket theo loại khớp contracts v2', () => {
    const mb = 1024 * 1024;
    expect(MEDIA_SIZE_LIMITS).toEqual({
      IMAGE: 10 * mb,
      VIDEO: 500 * mb,
      DOCUMENT: 50 * mb,
      AUDIO: 100 * mb,
      OTHER: 25 * mb,
    });
    expect(Object.values(BUCKET_BY_TYPE).sort()).toEqual([
      'audios',
      'documents',
      'images',
      'other',
      'videos',
    ]);
    expect(supportsThumbnail('IMAGE')).toBe(true);
    expect(supportsThumbnail('VIDEO')).toBe(true);
    expect(supportsThumbnail('DOCUMENT')).toBe(false);
  });
});

describe('object key', () => {
  const id = '3f9c1e52-8a4b-4d7e-9b1a-0c6e2d5f7a10';

  it('dạng yyyy/MM/dd/{uuid}.{ext} theo UTC', () => {
    // 23:30 UTC ngày 31/12 vẫn là ngày 31 dù máy ở múi giờ khác.
    expect(buildObjectKey(new Date('2026-12-31T23:30:00Z'), id, 'png')).toBe(
      `2026/12/31/${id}.png`,
    );
    expect(buildObjectKey(new Date('2026-01-02T00:00:00Z'), id, 'webp')).toBe(
      `2026/01/02/${id}.webp`,
    );
  });

  it('key tạm nằm dưới tmp/ và không đoán được từ tên file', () => {
    expect(buildTmpObjectKey(id, 'png')).toBe(`tmp/${id}.png`);
  });

  it.each([
    ['ảnh bìa.PNG', 'png'],
    ['archive.tar.gz', 'gz'],
    ['noext', 'bin'],
    ['evil.p/../ng', 'ng'],
    ['x.verylongextension', 'bin'],
    ['a.', 'bin'],
  ])('phần mở rộng an toàn: %s → %s', (name, extension) => {
    expect(safeExtension(name)).toBe(extension);
  });
});

describe('tham chiếu media trong markdown', () => {
  const a = '3f9c1e52-8a4b-4d7e-9b1a-0c6e2d5f7a10';
  const b = '6d1b2c3e-0a4f-4b8e-8c1d-2f3a4b5c6d7e';

  it('lấy id từ content/thumbnail, bỏ trùng lặp và chữ hoa', () => {
    const markdown = [
      `![a](/api/v1/media/${a}/content)`,
      `<img src="/api/v1/media/${b.toUpperCase()}/thumbnail">`,
      `lặp lại [a](https://host/api/v1/media/${a}/content?x=1)`,
      `/media/${a}/other không tính`,
      '/media/not-a-uuid/content',
    ].join('\n');
    expect(extractMediaIds(markdown)).toEqual([a, b]);
  });

  it('rỗng hoặc null → không có id', () => {
    expect(extractMediaIds(null)).toEqual([]);
    expect(extractMediaIds('')).toEqual([]);
  });
});

describe('header Range', () => {
  it.each([
    [undefined, null],
    ['bytes=0-9', { start: 0, end: 9 }],
    ['bytes=90-', { start: 90, end: 99 }],
    ['bytes=-10', { start: 90, end: 99 }],
    ['bytes=50-500', { start: 50, end: 99 }],
    ['bytes=100-', 'invalid'],
    ['bytes=9-3', 'invalid'],
    ['bytes=-', 'invalid'],
    ['bytes=0-1,5-6', null],
    ['items=0-1', null],
  ])('%s', (header, expected) => {
    expect(parseRange(header, 100)).toEqual(expected);
  });
});

describe('tiến độ job', () => {
  it('chưa biết số kỳ vọng hoặc chưa đủ thì PROCESSING', () => {
    expect(evaluateJobStatus({ expectedCount: null, processedCount: 5, failedCount: 0 })).toBe(
      'PROCESSING',
    );
    expect(evaluateJobStatus({ expectedCount: 3, processedCount: 1, failedCount: 1 })).toBe(
      'PROCESSING',
    );
  });

  it('đủ số lượng: COMPLETED, hoặc PARTIAL_FAILED nếu có lỗi', () => {
    expect(evaluateJobStatus({ expectedCount: 2, processedCount: 2, failedCount: 0 })).toBe(
      'COMPLETED',
    );
    expect(evaluateJobStatus({ expectedCount: 2, processedCount: 1, failedCount: 1 })).toBe(
      'PARTIAL_FAILED',
    );
  });
});

describe('contract command của media-worker', () => {
  const schemas = {
    thumbnailGenerate: thumbnailGeneratePayloadSchema,
    markdownUsageSynchronize: markdownUsageSynchronizePayloadSchema,
    usagesDeleteByIds: usagesDeleteByIdsPayloadSchema,
    notificationUsageRegister: notificationUsageRegisterPayloadSchema,
    notificationUsageRegisterBatch: notificationUsageRegisterBatchPayloadSchema,
    notificationUsageStartJob: notificationUsageStartJobPayloadSchema,
    notificationUsageCompleteJob: notificationUsageCompleteJobPayloadSchema,
  } as const;

  it.each(Object.keys(schemas) as (keyof typeof schemas)[])(
    '%s: fixture hợp lệ và queue theo quy ước canonical',
    (key) => {
      expect(schemas[key].safeParse(mediaCommandFixtures[key]).success).toBe(true);
      const command = MEDIA_COMMANDS[key];
      // Tên queue: <worker>--<command-kebab>-v<version>.
      const kebab = command.queue.replace(/^media-worker--/u, '').replace(/-v\d+$/u, '');
      expect(command.queue).toBe(buildQueueName('media-worker', kebab, command.version));
      expect(command.name).toMatch(/^media\.[a-z-]+(\.[a-z-]+)?$/u);
    },
  );

  it('queue không trùng nhau', () => {
    const queues = Object.values(MEDIA_COMMANDS).map((command) => command.queue);
    expect(new Set(queues).size).toBe(queues.length);
  });

  it('payload thiếu trường bắt buộc bị từ chối', () => {
    expect(thumbnailGeneratePayloadSchema.safeParse({}).success).toBe(false);
    expect(usagesDeleteByIdsPayloadSchema.safeParse({ usage_ids: [] }).success).toBe(false);
  });
});

import {
  extractMediaIds,
  finalBatchStatus,
  isTerminalBatchStatus,
  MAX_MEDIA_PER_NOTIFICATION,
  renderEmail,
  retryDelayMs,
} from '../../src/domain/notification.js';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('finalBatchStatus', () => {
  it('không lỗi → COMPLETED, có lẫn → PARTIAL_FAILED, toàn lỗi → FAILED', () => {
    expect(finalBatchStatus({ success: 3, failed: 0 })).toBe('COMPLETED');
    expect(finalBatchStatus({ success: 2, failed: 1 })).toBe('PARTIAL_FAILED');
    expect(finalBatchStatus({ success: 0, failed: 3 })).toBe('FAILED');
  });

  it('chỉ ba trạng thái cuối là terminal', () => {
    expect(
      ['COMPLETED', 'PARTIAL_FAILED', 'FAILED'].every((s) => isTerminalBatchStatus(s as never)),
    ).toBe(true);
    expect(
      ['PENDING', 'SNAPSHOTTING', 'SNAPSHOT_READY', 'PROCESSING'].some((s) =>
        isTerminalBatchStatus(s as never),
      ),
    ).toBe(false);
  });
});

describe('retryDelayMs', () => {
  it('nhân đôi theo số lần thử', () => {
    expect([1, 2, 3, 4].map((n) => retryDelayMs(1_000, n))).toEqual([1_000, 2_000, 4_000, 8_000]);
  });
});

describe('extractMediaIds', () => {
  it('lấy id từ link content/thumbnail, bỏ trùng, đổi về chữ thường', () => {
    const markdown = [
      `![a](/api/v1/media/${A}/content)`,
      `[b](https://lms.local/api/v1/media/${B}/thumbnail)`,
      `![again](/api/v1/media/${A.toUpperCase()}/content)`,
      '![x](/api/v1/media/not-a-uuid/content)',
    ].join('\n');

    expect(extractMediaIds(markdown)).toEqual([A, B]);
  });

  it('không có media → rỗng; vượt trần thì cắt', () => {
    expect(extractMediaIds('chỉ là văn bản')).toEqual([]);
    const many = Array.from({ length: MAX_MEDIA_PER_NOTIFICATION + 5 }, (_, i) => {
      const suffix = String(i).padStart(12, '0');
      return `/media/00000000-0000-4000-8000-${suffix}/content`;
    }).join(' ');
    expect(extractMediaIds(many)).toHaveLength(MAX_MEDIA_PER_NOTIFICATION);
  });
});

describe('renderEmail', () => {
  it('subject là tiêu đề, nội dung giữ nguyên markdown', () => {
    expect(renderEmail('Chào', '**đậm**')).toEqual({ subject: 'Chào', text: 'Chào\n\n**đậm**\n' });
  });
});

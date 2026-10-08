export type GradeEventPublishErrorCode =
  'BROKER_UNAVAILABLE' | 'PUBLISH_TIMEOUT' | 'PUBLISH_NACKED' | 'EVENT_INVALID';

/** Lỗi publish đã được phân loại; `code` hữu hạn nên an toàn để lưu DB và dùng làm label. */
export class GradeEventPublishError extends Error {
  constructor(readonly code: GradeEventPublishErrorCode) {
    super(`Publish grade.completed thất bại (${code})`);
  }

  get kind(): 'timeout' | 'unavailable' | 'invalid' {
    if (this.code === 'PUBLISH_TIMEOUT') return 'timeout';
    return this.code === 'EVENT_INVALID' ? 'invalid' : 'unavailable';
  }
}

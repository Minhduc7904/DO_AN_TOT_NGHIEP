import {
  type AiDocument,
  type AiDocumentStatus,
  classifyDocument,
} from '../../../domain/lesson-ai.js';

/** Trạng thái một tệp trả cho course; `NOT_QUEUED` là trạng thái giả (chưa có bản ghi, định dạng hỗ trợ). */
export interface AiDocumentView {
  mediaId: string;
  status: AiDocumentStatus | 'NOT_QUEUED';
  errorCode: string | null;
  errorMessage: string | null;
  textLength: number;
  updatedAt: Date | null;
}

export interface DocumentRef {
  mediaId: string;
  fileName: string;
  contentType: string;
}

export function viewOf(record: AiDocument): AiDocumentView {
  return {
    mediaId: record.mediaId,
    status: record.status,
    errorCode: record.errorCode,
    errorMessage: record.errorMessage,
    textLength: record.textLength,
    updatedAt: record.updatedAt,
  };
}

/** Một phần tử cho mỗi tệp theo thứ tự đầu vào; tệp chưa có bản ghi là `NOT_QUEUED` hoặc `UNSUPPORTED`. */
export function viewsFor(
  refs: readonly DocumentRef[],
  records: readonly AiDocument[],
): AiDocumentView[] {
  const byMedia = new Map(records.map((record) => [record.mediaId, record]));
  return refs.map((ref) => {
    const record = byMedia.get(ref.mediaId);
    if (record) return viewOf(record);
    return {
      mediaId: ref.mediaId,
      status:
        classifyDocument(ref.fileName, ref.contentType) === null ? 'UNSUPPORTED' : 'NOT_QUEUED',
      errorCode: null,
      errorMessage: null,
      textLength: 0,
      updatedAt: null,
    };
  });
}

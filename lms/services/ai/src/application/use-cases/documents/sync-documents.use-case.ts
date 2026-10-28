import type { IdGenerator } from '@aiops-lms/common/ports';
import type { Clock } from '@aiops-lms/common/ports';

import { AI_LIMITS, classifyDocument } from '../../../domain/lesson-ai.js';
import type { AiUnitOfWork } from '../../ports/unit-of-work.js';
import type { DocumentToExtract } from '../../ports/lesson-ai-repositories.js';
import { type AiDocumentView, viewsFor } from './document-view.js';

export interface DocumentInput {
  mediaId: string;
  fileName: string;
  contentType: string;
  mediaType: string;
}

/**
 * Đưa tài liệu vào hàng chờ trích xuất: tạo bản ghi `PENDING` (hoặc `UNSUPPORTED` nếu định dạng không
 * hỗ trợ) cho tài liệu chưa có, tùy chọn đặt lại `FAILED`, và gửi `ai.document.extract` cho mỗi tài liệu
 * cần chạy (cùng transaction). Tài liệu `PROCESSING` đã quá hạn lease cũng được nhận lại (hoặc `FAILED` nếu
 * đã hết lượt thử): đây là đường phục hồi khi worker chết giữa chừng. Idempotent; trả một trạng thái cho mỗi tài liệu theo thứ tự đầu vào.
 */
export class SyncDocumentsUseCase {
  constructor(
    private readonly uow: AiUnitOfWork,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(
    documents: readonly DocumentInput[],
    retryFailed: boolean,
  ): Promise<AiDocumentView[]> {
    const unique = [...new Map(documents.map((document) => [document.mediaId, document])).values()];
    const mediaIds = unique.map((document) => document.mediaId);
    const now = this.clock.now();

    return this.uow.run(async (stores) => {
      const toExtract = new Map<string, DocumentToExtract>();
      await stores.documents.failExhausted(mediaIds, now, AI_LIMITS.maxExtractionAttempts);
      for (const stale of await stores.documents.requeueStale(
        mediaIds,
        now,
        AI_LIMITS.maxExtractionAttempts,
      )) {
        toExtract.set(stale.mediaId, stale);
      }
      const inserted = await stores.documents.insertMissing(
        unique.map((document) => ({
          id: this.ids.next(),
          mediaId: document.mediaId,
          fileName: document.fileName,
          contentType: document.contentType,
          mediaType: document.mediaType,
          status:
            classifyDocument(document.fileName, document.contentType) === null
              ? 'UNSUPPORTED'
              : 'PENDING',
        })),
      );
      for (const document of inserted) toExtract.set(document.mediaId, document);
      if (retryFailed) {
        for (const document of await stores.documents.resetFailed(mediaIds)) {
          toExtract.set(document.mediaId, document);
        }
      }
      for (const document of toExtract.values()) {
        await stores.commands.requestDocumentExtraction(document);
      }

      return viewsFor(unique, await stores.documents.list(mediaIds));
    });
  }
}

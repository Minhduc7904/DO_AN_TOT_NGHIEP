import type { DocumentRepository } from '../../ports/lesson-ai-repositories.js';
import { type AiDocumentView, type DocumentRef, viewsFor } from './document-view.js';

/** Trạng thái trích xuất của các tệp (không ghi, không kèm văn bản), một phần tử cho mỗi tệp theo thứ tự yêu cầu. */
export class QueryDocumentsUseCase {
  constructor(private readonly documents: DocumentRepository) {}

  async execute(refs: readonly DocumentRef[]): Promise<AiDocumentView[]> {
    const records = await this.documents.list([...new Set(refs.map((ref) => ref.mediaId))]);
    return viewsFor(refs, records);
  }
}

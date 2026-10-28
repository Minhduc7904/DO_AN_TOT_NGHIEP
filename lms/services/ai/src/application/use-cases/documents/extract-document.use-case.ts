import { AppError } from '@aiops-lms/common/errors';
import type { Clock, IdGenerator } from '@aiops-lms/common/ports';

import {
  AI_LIMITS,
  classifyDocument,
  DOCUMENT_ERROR_CODES,
  type DocumentKind,
  limitExtractedText,
  OUTPUT_TRUNCATED_NOTE,
  truncateErrorMessage,
} from '../../../domain/lesson-ai.js';
import type { DocxTextExtractor } from '../../ports/docx-text-extractor.js';
import type { ClaimedDocument } from '../../ports/lesson-ai-repositories.js';
import type { MediaContentSource } from '../../ports/lesson-course-client.js';
import type { AiUnitOfWork } from '../../ports/unit-of-work.js';
import type { CreateCompletionUseCase } from '../completions/create-completion.use-case.js';
import { EXTRACTION_SYSTEM_PROMPT, extractionUserText } from './prompts.js';

/** Lỗi trích xuất có mã ổn định để UI hiển thị (`error_code` của tài liệu). */
class ExtractionFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ExtractionFailure';
  }
}

export interface ExtractDocumentInput {
  mediaId: string;
  fileName: string;
  contentType: string;
  mediaType: string;
}

type Outcome = { ok: true; text: string } | { ok: false; code: string; message: string };

/**
 * Xử lý `ai.document.extract`: bảo đảm có bản ghi tài liệu (`PENDING`/`UNSUPPORTED`), nhận nó bằng lease,
 * tải byte từ `media` và trích văn bản. TXT/MD đọc thẳng, DOCX qua parser, PDF/ảnh qua provider (task
 * `document-extraction`, gọi trong process). Chuyển trạng thái cuối cùng được ghi cùng inbox trong một transaction.
 * Lỗi nghiệp vụ được ghi vào tài liệu (`FAILED`); chỉ lỗi hạ tầng (DB) mới ném ra để consumer thử lại.
 */
export class ExtractDocumentUseCase {
  constructor(
    private readonly uow: AiUnitOfWork,
    private readonly media: MediaContentSource,
    private readonly completions: Pick<CreateCompletionUseCase, 'execute'>,
    private readonly docx: DocxTextExtractor,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly consumer: string,
    private readonly leaseMs: number,
  ) {}

  async execute(messageId: string, input: ExtractDocumentInput): Promise<void> {
    const now = this.clock.now();
    const supported = classifyDocument(input.fileName, input.contentType) !== null;
    await this.uow.stores.documents.insertMissing([
      {
        id: this.ids.next(),
        mediaId: input.mediaId,
        fileName: input.fileName,
        contentType: input.contentType,
        mediaType: input.mediaType,
        status: supported ? 'PENDING' : 'UNSUPPORTED',
      },
    ]);
    await this.uow.stores.documents.failExhausted(
      [input.mediaId],
      now,
      AI_LIMITS.maxExtractionAttempts,
    );
    const claimed = await this.uow.stores.documents.claim(
      input.mediaId,
      now,
      new Date(now.getTime() + this.leaseMs),
      AI_LIMITS.maxExtractionAttempts,
    );
    // Đã xong, đang do worker khác xử lý (lease còn hạn) hoặc không phải việc của command này.
    if (!claimed) return;

    const outcome = await this.extract(claimed);
    await this.uow.runOnce(messageId, this.consumer, async (stores) => {
      const at = this.clock.now();
      if (outcome.ok) await stores.documents.complete(claimed.id, outcome.text, at);
      else await stores.documents.fail(claimed.id, outcome.code, outcome.message, at);
    });
  }

  /** Command vào hàng đợi lỗi sau khi hết lượt thử: không để tài liệu kẹt `PENDING|PROCESSING`. */
  async markFaulted(mediaId: string): Promise<void> {
    await this.uow.stores.documents.failActiveByMedia(
      mediaId,
      DOCUMENT_ERROR_CODES.failed,
      'Trích xuất tài liệu thất bại',
      this.clock.now(),
    );
  }

  private async extract(document: ClaimedDocument): Promise<Outcome> {
    try {
      return { ok: true, text: await this.read(document) };
    } catch (error) {
      return { ok: false, ...toFailure(error) };
    }
  }

  private async read(document: ClaimedDocument): Promise<string> {
    const kind = classifyDocument(document.fileName, document.contentType);
    if (!kind) {
      throw new ExtractionFailure(
        DOCUMENT_ERROR_CODES.unsupported,
        'Định dạng tệp chưa được hỗ trợ',
      );
    }
    const bytes = await this.media.downloadContent(document.mediaId);
    if (bytes.byteLength > AI_LIMITS.maxDocumentBytes) {
      throw new ExtractionFailure(
        DOCUMENT_ERROR_CODES.tooLarge,
        `Tệp lớn hơn ${AI_LIMITS.maxDocumentBytes / (1024 * 1024)} MB`,
      );
    }
    const text = (await this.toText(kind, document, bytes)).trim();
    if (text.length === 0) {
      throw new ExtractionFailure(DOCUMENT_ERROR_CODES.empty, 'Không trích xuất được văn bản nào');
    }
    return limitExtractedText(text);
  }

  private async toText(
    kind: DocumentKind,
    document: ClaimedDocument,
    bytes: Uint8Array,
  ): Promise<string> {
    if (kind === 'TEXT') return new TextDecoder('utf-8').decode(bytes);
    if (kind === 'DOCX') {
      try {
        return this.docx.toMarkdown(bytes);
      } catch {
        throw new ExtractionFailure(DOCUMENT_ERROR_CODES.failed, 'Tệp DOCX không đọc được');
      }
    }
    const mediaType = document.contentType.split(';')[0]?.trim() || 'application/octet-stream';
    const dataBase64 = Buffer.from(bytes).toString('base64');
    const completion = await this.completions.execute({
      task: 'document-extraction',
      messages: [
        { role: 'system', text: EXTRACTION_SYSTEM_PROMPT },
        {
          role: 'user',
          parts: [
            { type: 'text', text: extractionUserText(kind, document.fileName) },
            kind === 'IMAGE'
              ? { type: 'image', mediaType, dataBase64 }
              : { type: 'file', mediaType, dataBase64, fileName: document.fileName },
          ],
        },
      ],
      tools: [],
    });
    const text = completion.text ?? '';
    return completion.finishReason === 'length' ? text + OUTPUT_TRUNCATED_NOTE : text;
  }
}

function toFailure(error: unknown): { code: string; message: string } {
  if (error instanceof ExtractionFailure) return { code: error.code, message: error.message };
  if (error instanceof AppError) {
    return { code: error.code, message: truncateErrorMessage(error.message) };
  }
  return { code: DOCUMENT_ERROR_CODES.failed, message: 'Trích xuất tài liệu thất bại' };
}

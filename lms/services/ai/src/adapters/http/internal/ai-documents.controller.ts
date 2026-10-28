import { InternalApi, parseInput } from '@aiops-lms/common/http';
import {
  type AiDocumentDto,
  INTERNAL_PREFIX,
  queryAiDocumentsRequestSchema,
  syncAiDocumentsRequestSchema,
} from '@aiops-lms/contracts';
import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';

import { QueryDocumentsUseCase } from '../../../application/use-cases/documents/query-documents.use-case.js';
import { SyncDocumentsUseCase } from '../../../application/use-cases/documents/sync-documents.use-case.js';
import { presentDocument } from '../shared/lesson-ai.presenter.js';

/** Tài liệu trích xuất cho course; không qua Gateway. Văn bản trích xuất không bao giờ ra khỏi `ai`. */
@Controller(`${INTERNAL_PREFIX}/ai/documents`)
export class AiDocumentsController {
  constructor(
    @Inject(SyncDocumentsUseCase) private readonly syncDocuments: SyncDocumentsUseCase,
    @Inject(QueryDocumentsUseCase) private readonly queryDocuments: QueryDocumentsUseCase,
  ) {}

  @InternalApi({ scopes: ['ai:document:write'] })
  @Post('sync')
  @HttpCode(200)
  async sync(@Body() body: unknown): Promise<AiDocumentDto[]> {
    const input = parseInput(syncAiDocumentsRequestSchema, body);
    const documents = await this.syncDocuments.execute(
      input.documents.map((document) => ({
        mediaId: document.media_id,
        fileName: document.file_name,
        contentType: document.content_type,
        mediaType: document.media_type,
      })),
      input.retry_failed,
    );
    return documents.map(presentDocument);
  }

  /** POST vì danh sách media id có thể dài; không ghi dữ liệu. */
  @InternalApi({ scopes: ['ai:document:read'] })
  @Post('query')
  @HttpCode(200)
  async query(@Body() body: unknown): Promise<AiDocumentDto[]> {
    const input = parseInput(queryAiDocumentsRequestSchema, body);
    return (
      await this.queryDocuments.execute(
        input.documents.map((document) => ({
          mediaId: document.media_id,
          fileName: document.file_name,
          contentType: document.content_type,
        })),
      )
    ).map(presentDocument);
  }
}

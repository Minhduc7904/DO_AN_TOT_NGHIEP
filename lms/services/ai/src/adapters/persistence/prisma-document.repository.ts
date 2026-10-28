import type {
  ClaimedDocument,
  DocumentRepository,
  DocumentText,
  DocumentToExtract,
  NewDocument,
} from '../../application/ports/lesson-ai-repositories.js';
import {
  type AiDocument,
  type AiDocumentStatus,
  DOCUMENT_ERROR_CODES,
} from '../../domain/lesson-ai.js';
import type { Db } from './db.js';
import { observeDb } from './prisma-support.js';

interface DocumentRow {
  id: string;
  mediaId: string;
  fileName: string;
  contentType: string;
  mediaType: string;
  status: AiDocumentStatus;
  attemptCount: number;
  errorCode: string | null;
  errorMessage: string | null;
  textLength: number;
  updatedAt: Date;
}

type ToExtractRow = DocumentToExtract;

/**
 * Tài liệu trích xuất. Worker nhận việc bằng một câu lệnh `UPDATE … WHERE id = (SELECT … FOR UPDATE SKIP
 * LOCKED)` nên nhiều instance không xử lý trùng; lease hết hạn thì việc được nhận lại. Không bắt unique
 * violation trong transaction: chèn dùng `ON CONFLICT DO NOTHING`.
 */
export class PrismaDocumentRepository implements DocumentRepository {
  constructor(private readonly db: Db) {}

  list(mediaIds: readonly string[]): Promise<AiDocument[]> {
    return observeDb('document.list', async () => {
      if (mediaIds.length === 0) return [];
      // Không tải `extracted_text`: chỉ lấy độ dài.
      return this.db.$queryRaw<DocumentRow[]>`
        SELECT id, media_id AS "mediaId", file_name AS "fileName", content_type AS "contentType",
               media_type AS "mediaType", status::text AS status, attempt_count AS "attemptCount",
               error_code AS "errorCode", error_message AS "errorMessage",
               COALESCE(length(extracted_text), 0)::int AS "textLength", updated_at AS "updatedAt"
        FROM ai_documents
        WHERE media_id = ANY(${[...mediaIds]}::uuid[])`;
    });
  }

  getTexts(mediaIds: readonly string[]): Promise<DocumentText[]> {
    return observeDb('document.get-texts', async () => {
      const rows = await this.db.aiDocument.findMany({
        where: { mediaId: { in: [...mediaIds] } },
        select: { mediaId: true, fileName: true, status: true, extractedText: true },
      });
      const byMedia = new Map(rows.map((row) => [row.mediaId, row]));
      return mediaIds.flatMap((mediaId) => {
        const row = byMedia.get(mediaId);
        return row
          ? [{ mediaId, fileName: row.fileName, status: row.status, text: row.extractedText }]
          : [];
      });
    });
  }

  insertMissing(documents: readonly NewDocument[]): Promise<DocumentToExtract[]> {
    return observeDb('document.insert-missing', async () => {
      const inserted: DocumentToExtract[] = [];
      for (const document of documents) {
        const rows = await this.db.$queryRaw<{ mediaId: string }[]>`
          INSERT INTO ai_documents (id, media_id, file_name, content_type, media_type, status, updated_at)
          VALUES (${document.id}::uuid, ${document.mediaId}::uuid, ${document.fileName},
                  ${document.contentType}, ${document.mediaType}, ${document.status}::ai_document_status, now())
          ON CONFLICT (media_id) DO NOTHING
          RETURNING media_id AS "mediaId"`;
        if (rows.length > 0 && document.status === 'PENDING') {
          inserted.push({
            mediaId: document.mediaId,
            fileName: document.fileName,
            contentType: document.contentType,
            mediaType: document.mediaType,
          });
        }
      }
      return inserted;
    });
  }

  resetFailed(mediaIds: readonly string[]): Promise<DocumentToExtract[]> {
    return observeDb('document.reset-failed', async () => {
      if (mediaIds.length === 0) return [];
      return this.db.$queryRaw<ToExtractRow[]>`
        UPDATE ai_documents
        SET status = 'PENDING', attempt_count = 0, error_code = NULL, error_message = NULL,
            lease_expires_at = NULL, updated_at = now()
        WHERE media_id = ANY(${[...mediaIds]}::uuid[]) AND status = 'FAILED'
        RETURNING media_id AS "mediaId", file_name AS "fileName", content_type AS "contentType",
                  media_type AS "mediaType"`;
    });
  }

  failExhausted(mediaIds: readonly string[], now: Date, maxAttempts: number): Promise<number> {
    return observeDb('document.fail-exhausted', async () => {
      const result = await this.db.aiDocument.updateMany({
        where: {
          mediaId: { in: [...mediaIds] },
          status: 'PROCESSING',
          leaseExpiresAt: { lt: now },
          attemptCount: { gte: maxAttempts },
        },
        data: {
          status: 'FAILED',
          errorCode: DOCUMENT_ERROR_CODES.interrupted,
          errorMessage: 'Trích xuất bị gián đoạn nhiều lần',
          leaseExpiresAt: null,
          updatedAt: now,
        },
      });
      return result.count;
    });
  }

  requeueStale(
    mediaIds: readonly string[],
    now: Date,
    maxAttempts: number,
  ): Promise<DocumentToExtract[]> {
    return observeDb('document.requeue-stale', async () => {
      if (mediaIds.length === 0) return [];
      return this.db.$queryRaw<ToExtractRow[]>`
        UPDATE ai_documents
        SET status = 'PENDING', lease_expires_at = NULL, updated_at = ${now}::timestamptz
        WHERE media_id = ANY(${[...mediaIds]}::uuid[]) AND status = 'PROCESSING'
          AND lease_expires_at < ${now}::timestamptz AND attempt_count < ${maxAttempts}
        RETURNING media_id AS "mediaId", file_name AS "fileName", content_type AS "contentType",
                  media_type AS "mediaType"`;
    });
  }

  claim(
    mediaId: string,
    now: Date,
    leaseUntil: Date,
    maxAttempts: number,
  ): Promise<ClaimedDocument | null> {
    return observeDb('document.claim', async () => {
      const rows = await this.db.$queryRaw<ClaimedDocument[]>`
        UPDATE ai_documents
        SET status = 'PROCESSING', attempt_count = attempt_count + 1,
            lease_expires_at = ${leaseUntil}::timestamptz, updated_at = ${now}::timestamptz
        WHERE id = (
          SELECT id FROM ai_documents
          WHERE media_id = ${mediaId}::uuid
            AND (status = 'PENDING' OR (status = 'PROCESSING' AND lease_expires_at < ${now}::timestamptz))
            AND attempt_count < ${maxAttempts}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id, media_id AS "mediaId", file_name AS "fileName", content_type AS "contentType",
                  media_type AS "mediaType", attempt_count AS "attemptCount"`;
      return rows[0] ?? null;
    });
  }

  complete(id: string, text: string, now: Date): Promise<void> {
    return observeDb('document.complete', async () => {
      await this.db.aiDocument.update({
        where: { id },
        data: {
          status: 'EXTRACTED',
          extractedText: text,
          errorCode: null,
          errorMessage: null,
          leaseExpiresAt: null,
          updatedAt: now,
        },
      });
    });
  }

  fail(id: string, errorCode: string, errorMessage: string, now: Date): Promise<void> {
    return observeDb('document.fail', async () => {
      await this.db.aiDocument.update({
        where: { id },
        data: { status: 'FAILED', errorCode, errorMessage, leaseExpiresAt: null, updatedAt: now },
      });
    });
  }

  failActiveByMedia(
    mediaId: string,
    errorCode: string,
    errorMessage: string,
    now: Date,
  ): Promise<void> {
    return observeDb('document.fail-active', async () => {
      await this.db.aiDocument.updateMany({
        where: { mediaId, status: { in: ['PENDING', 'PROCESSING'] } },
        data: { status: 'FAILED', errorCode, errorMessage, leaseExpiresAt: null, updatedAt: now },
      });
    });
  }
}

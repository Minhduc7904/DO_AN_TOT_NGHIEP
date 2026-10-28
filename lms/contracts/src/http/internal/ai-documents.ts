import { z } from 'zod';

import { idSchema, roleSchema } from '../common/index.js';
import {
  LESSON_AI_MAX_DOCUMENTS,
  LESSON_AI_MAX_QUESTION_COUNT,
  lessonAiJobTypeSchema,
} from '../public/lesson-ai.js';
import { mediaTypeSchema } from '../public/media.js';

/**
 * Bề mặt nội bộ `course → ai` cho tài liệu và job AI của bài học. `ai` không biết khóa học hay quyền:
 * `course` đã kiểm tra bài học thuộc khóa và quyền sở hữu, rồi truyền tường minh người yêu cầu.
 */

export const AI_DOCUMENT_SYNC_MAX = 100;

export const aiDocumentStatusSchema = z.enum([
  'PENDING',
  'PROCESSING',
  'EXTRACTED',
  'FAILED',
  'UNSUPPORTED',
]);
export type AiDocumentStatus = z.infer<typeof aiDocumentStatusSchema>;

/** Người yêu cầu job; `ai` lưu lại để `ai-worker` ghi nội dung bài học dưới đúng danh nghĩa này. */
export const aiRequestedBySchema = z.object({ id: idSchema, role: roleSchema });
export type AiRequestedBy = z.infer<typeof aiRequestedBySchema>;

const dateTime = z.iso.datetime();

// ---- Request ---------------------------------------------------------------------------------

export const aiDocumentInputSchema = z.object({
  media_id: idSchema,
  file_name: z.string().min(1).max(255),
  content_type: z.string().min(1).max(255),
  media_type: mediaTypeSchema,
});
export type AiDocumentInput = z.infer<typeof aiDocumentInputSchema>;

/**
 * Đưa các tài liệu chưa có vào hàng chờ trích xuất (`PENDING`, hoặc `UNSUPPORTED` nếu định dạng không
 * hỗ trợ); `retry_failed` đặt lại tài liệu `FAILED`. Idempotent theo `media_id`.
 */
export const syncAiDocumentsRequestSchema = z.object({
  documents: z.array(aiDocumentInputSchema).min(1).max(AI_DOCUMENT_SYNC_MAX),
  retry_failed: z.boolean().default(false),
});
export type SyncAiDocumentsRequest = z.infer<typeof syncAiDocumentsRequestSchema>;

/** Cùng metadata như `sync` nhưng không ghi: `ai` tự phân loại tệp chưa có bản ghi (`NOT_QUEUED`/`UNSUPPORTED`). */
export const queryAiDocumentsRequestSchema = z.object({
  documents: z.array(aiDocumentInputSchema).min(1).max(AI_DOCUMENT_SYNC_MAX),
});
export type QueryAiDocumentsRequest = z.infer<typeof queryAiDocumentsRequestSchema>;

export const createAiJobRequestSchema = z.object({
  job_type: lessonAiJobTypeSchema,
  course_id: idSchema,
  lesson_id: idSchema,
  /** 1–20 tài liệu, mỗi tài liệu phải `EXTRACTED`; id trùng được gộp. */
  media_ids: z.array(idSchema).min(1).max(LESSON_AI_MAX_DOCUMENTS),
  question_count: z.number().int().min(1).max(LESSON_AI_MAX_QUESTION_COUNT).optional(),
  overwrite_content: z.boolean().default(false),
  requested_by: aiRequestedBySchema,
});
export type CreateAiJobRequest = z.infer<typeof createAiJobRequestSchema>;

export const listAiJobsQuerySchema = z.object({
  lesson_id: idSchema,
  limit: z.coerce.number().int().min(1).max(10).default(10),
});
export type ListAiJobsQuery = z.infer<typeof listAiJobsQuerySchema>;

export const getAiJobQuerySchema = z.object({ lesson_id: idSchema });
export type GetAiJobQuery = z.infer<typeof getAiJobQuerySchema>;

// ---- Response --------------------------------------------------------------------------------

/**
 * Mỗi tệp được hỏi có đúng một phần tử, theo thứ tự yêu cầu. Không bao giờ trả văn bản trích xuất, chỉ độ dài.
 * `NOT_QUEUED` (chưa có bản ghi, định dạng hỗ trợ) chỉ xuất hiện ở `query`; khi đó `updated_at` là `null`.
 */
export const aiDocumentDtoSchema = z.object({
  media_id: idSchema,
  status: z.union([aiDocumentStatusSchema, z.literal('NOT_QUEUED')]),
  error_code: z.string().nullable(),
  error_message: z.string().nullable(),
  text_length: z.number().int(),
  updated_at: dateTime.nullable(),
});
export type AiDocumentDto = z.infer<typeof aiDocumentDtoSchema>;

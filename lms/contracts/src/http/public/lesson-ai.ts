import { z } from 'zod';

import { idSchema } from '../common/index.js';
import { mediaTypeSchema } from './media.js';

/** Trạng thái trích xuất văn bản của một tài liệu đính kèm; `NOT_QUEUED` là trạng thái giả (chưa có bản ghi). */
export const lessonAiDocumentStatusSchema = z.enum([
  'NOT_QUEUED',
  'PENDING',
  'EXTRACTING',
  'EXTRACTED',
  'FAILED',
  'UNSUPPORTED',
]);
export type LessonAiDocumentStatus = z.infer<typeof lessonAiDocumentStatusSchema>;

export const lessonAiJobTypeSchema = z.enum(['SYNTHESIZE_LESSON', 'GENERATE_QUIZ']);
export type LessonAiJobType = z.infer<typeof lessonAiJobTypeSchema>;

export const lessonAiJobStatusSchema = z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED']);
export type LessonAiJobStatus = z.infer<typeof lessonAiJobStatusSchema>;

export const LESSON_AI_MAX_DOCUMENTS = 20;
export const LESSON_AI_DEFAULT_QUESTION_COUNT = 10;
export const LESSON_AI_MAX_QUESTION_COUNT = 30;

const dateTime = z.iso.datetime();

// ---- Request ---------------------------------------------------------------------------------

/** `?retry_failed=true` đặt lại tài liệu `FAILED` về `PENDING`. */
export const syncLessonAiDocumentsQuerySchema = z.object({
  retry_failed: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((value) => value === true || value === 'true')
    .default(false),
});
export type SyncLessonAiDocumentsQuery = z.infer<typeof syncLessonAiDocumentsQuerySchema>;

export const createLessonAiJobRequestSchema = z.object({
  job_type: lessonAiJobTypeSchema,
  /** 1–20 tài liệu của bài học, mỗi tài liệu phải `EXTRACTED`; id trùng được gộp. */
  media_ids: z.array(idSchema).min(1).max(LESSON_AI_MAX_DOCUMENTS),
  /** Chỉ dùng cho `GENERATE_QUIZ` (1–30, mặc định 10); bị bỏ qua với `SYNTHESIZE_LESSON`. */
  question_count: z.number().int().min(1).max(LESSON_AI_MAX_QUESTION_COUNT).optional(),
  /** Bài học đã có nội dung thì `SYNTHESIZE_LESSON` cần `true` mới được ghi đè. */
  overwrite_content: z.boolean().default(false),
});
export type CreateLessonAiJobRequest = z.infer<typeof createLessonAiJobRequestSchema>;

// ---- Response --------------------------------------------------------------------------------

export const lessonAiDocumentDtoSchema = z.object({
  media_id: idSchema,
  file_name: z.string(),
  content_type: z.string(),
  media_type: mediaTypeSchema,
  status: lessonAiDocumentStatusSchema,
  error_code: z.string().nullable(),
  error_message: z.string().nullable(),
  /** Số ký tự văn bản đã trích xuất; nội dung văn bản không bao giờ được trả về. */
  text_length: z.number().int(),
  updated_at: dateTime.nullable(),
});
export type LessonAiDocumentDto = z.infer<typeof lessonAiDocumentDtoSchema>;

export const lessonAiJobDtoSchema = z.object({
  id: idSchema,
  lesson_id: idSchema,
  course_id: idSchema,
  job_type: lessonAiJobTypeSchema,
  status: lessonAiJobStatusSchema,
  media_ids: z.array(idSchema),
  question_count: z.number().int().nullable(),
  overwrite_content: z.boolean(),
  /** `true` khi job đã ghi đè nội dung bài học và lưu bản cũ (đọc qua chi tiết job). */
  has_previous_content: z.boolean(),
  result_quiz_id: idSchema.nullable(),
  step_count: z.number().int(),
  error_code: z.string().nullable(),
  error_message: z.string().nullable(),
  created_at: dateTime,
  updated_at: dateTime,
  started_at: dateTime.nullable(),
  finished_at: dateTime.nullable(),
});
export type LessonAiJobDto = z.infer<typeof lessonAiJobDtoSchema>;

export const lessonAiJobDetailDtoSchema = z.object({
  job: lessonAiJobDtoSchema,
  previous_content_markdown: z.string().nullable(),
});
export type LessonAiJobDetailDto = z.infer<typeof lessonAiJobDetailDtoSchema>;

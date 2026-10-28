import { z } from 'zod';

import { idSchema } from '../common/index.js';
import { createQuizRequestSchema } from '../public/course.js';
import { aiRequestedBySchema } from './ai-documents.js';

/**
 * Bề mặt nội bộ `ai-worker → course` để job AI đọc bối cảnh và ghi kết quả vào bài học. Mọi thao tác
 * chạy dưới danh nghĩa `requested_by` (người tạo job) nên quyền sở hữu khóa học vẫn được kiểm tra như
 * khi người đó tự thao tác; `ai-worker` không tự có quyền ghi vào course.
 */

export const LESSON_AI_CONTENT_MAX_CHARS = 20_000;

export const lessonAiContextDtoSchema = z.object({
  course_id: idSchema,
  lesson_id: idSchema,
  title: z.string(),
  content_markdown: z.string().nullable(),
});
export type LessonAiContextDto = z.infer<typeof lessonAiContextDtoSchema>;

export const applyLessonAiContentRequestSchema = z.object({
  requested_by: aiRequestedBySchema,
  content_markdown: z.string().min(1).max(LESSON_AI_CONTENT_MAX_CHARS),
  /** `false` mà bài học đã có nội dung thì `409 LESSON_CONTENT_EXISTS`. */
  overwrite_content: z.boolean(),
});
export type ApplyLessonAiContentRequest = z.infer<typeof applyLessonAiContentRequestSchema>;

export const appliedLessonAiContentDtoSchema = z.object({
  /** Nội dung bài học trước khi ghi đè (để khôi phục); `null` nếu trước đó trống. */
  previous_content_markdown: z.string().nullable(),
});
export type AppliedLessonAiContentDto = z.infer<typeof appliedLessonAiContentDtoSchema>;

/** Tạo quiz `DRAFT` cho bài học; dữ liệu quiz được `course` kiểm tra như request tạo quiz của giảng viên. */
export const createLessonAiQuizRequestSchema = createQuizRequestSchema.extend({
  requested_by: aiRequestedBySchema,
});
export type CreateLessonAiQuizRequest = z.infer<typeof createLessonAiQuizRequestSchema>;

export const createdLessonAiQuizDtoSchema = z.object({ quiz_id: idSchema });
export type CreatedLessonAiQuizDto = z.infer<typeof createdLessonAiQuizDtoSchema>;

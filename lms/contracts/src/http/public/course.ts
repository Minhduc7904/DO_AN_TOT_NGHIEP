import { z } from 'zod';

import { idSchema, paginationQuerySchema } from '../common/index.js';

export const courseStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
export const quizStatusSchema = z.enum(['DRAFT', 'PUBLISHED']);
export const questionTypeSchema = z.enum(['SINGLE_CHOICE', 'MULTIPLE_CHOICE']);
export const attemptStatusSchema = z.enum(['IN_PROGRESS', 'SUBMITTED']);

const markdown = z.string().max(20000);
const dateTime = z.iso.datetime();

// ---- Request: course ---------------------------------------------------------------------------

export const createCourseRequestSchema = z.object({
  name: z.string().trim().min(3).max(200),
  description_markdown: markdown.nullish(),
});
export type CreateCourseRequest = z.infer<typeof createCourseRequestSchema>;

export const updateCourseRequestSchema = z.object({
  name: z.string().trim().min(3).max(200).optional(),
  description_markdown: markdown.nullish(),
  status: courseStatusSchema.optional(),
});
export type UpdateCourseRequest = z.infer<typeof updateCourseRequestSchema>;

export const listCoursesQuerySchema = paginationQuerySchema.extend({
  status: courseStatusSchema.optional(),
  search: z.string().trim().min(1).max(200).optional(),
});
export type ListCoursesQuery = z.infer<typeof listCoursesQuerySchema>;

export const exportCoursesQuerySchema = z.object({
  status: courseStatusSchema.optional(),
});
export type ExportCoursesQuery = z.infer<typeof exportCoursesQuerySchema>;

// ---- Request: lesson ---------------------------------------------------------------------------

export const createLessonRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content_markdown: markdown.nullish(),
  /** Bỏ trống để thêm vào cuối; trùng thứ tự đã có thì `LESSON_ORDER_CONFLICT`. */
  display_order: z.number().int().min(1).optional(),
});
export type CreateLessonRequest = z.infer<typeof createLessonRequestSchema>;

export const updateLessonRequestSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content_markdown: markdown.nullish(),
});
export type UpdateLessonRequest = z.infer<typeof updateLessonRequestSchema>;

/** Danh sách đầy đủ id bài học theo thứ tự mới. */
export const reorderLessonsRequestSchema = z.object({
  lesson_ids: z.array(idSchema).min(1).max(500),
});
export type ReorderLessonsRequest = z.infer<typeof reorderLessonsRequestSchema>;

// ---- Request: quiz -----------------------------------------------------------------------------

const quizOptionInputSchema = z.object({
  option_markdown: z.string().max(2000),
  is_correct: z.boolean(),
});

const quizQuestionInputSchema = z.object({
  question_markdown: markdown,
  question_type: questionTypeSchema,
  points: z.number(),
  options: z.array(quizOptionInputSchema),
});

export const createQuizRequestSchema = z.object({
  title: z.string(),
  description_markdown: markdown.nullish(),
  questions: z.array(quizQuestionInputSchema).default([]),
});
export type CreateQuizRequest = z.infer<typeof createQuizRequestSchema>;

/** Có `questions` thì thay toàn bộ cây câu hỏi (bị chặn khi quiz đã có lượt làm bài). */
export const updateQuizRequestSchema = z.object({
  title: z.string().optional(),
  description_markdown: markdown.nullish(),
  status: quizStatusSchema.optional(),
  questions: z.array(quizQuestionInputSchema).optional(),
});
export type UpdateQuizRequest = z.infer<typeof updateQuizRequestSchema>;

// ---- Request: học viên -------------------------------------------------------------------------

export const lessonProgressRequestSchema = z.object({
  progress_percent: z.number().min(0).max(100),
});
export type LessonProgressRequest = z.infer<typeof lessonProgressRequestSchema>;

export const saveAttemptAnswersRequestSchema = z.object({
  answers: z
    .array(z.object({ question_id: idSchema, option_ids: z.array(idSchema).max(10) }))
    .max(100),
});
export type SaveAttemptAnswersRequest = z.infer<typeof saveAttemptAnswersRequestSchema>;

// ---- Response `data` ---------------------------------------------------------------------------

export const courseDtoSchema = z.object({
  id: idSchema,
  name: z.string(),
  description_markdown: z.string().nullable(),
  status: courseStatusSchema,
  instructor_id: idSchema,
  created_at: dateTime,
  updated_at: dateTime,
});
export type CourseDto = z.infer<typeof courseDtoSchema>;

export const lessonOutlineDtoSchema = z.object({
  id: idSchema,
  title: z.string(),
  display_order: z.number().int(),
});
export type LessonOutlineDto = z.infer<typeof lessonOutlineDtoSchema>;

export const lessonDtoSchema = lessonOutlineDtoSchema.extend({
  course_id: idSchema,
  content_markdown: z.string().nullable(),
  created_at: dateTime,
  updated_at: dateTime,
});
export type LessonDto = z.infer<typeof lessonDtoSchema>;

export const enrollmentStatusSchema = z.enum(['ENROLLED', 'NOT_ENROLLED']);
export type EnrollmentStatus = z.infer<typeof enrollmentStatusSchema>;

/** Trạng thái ghi danh của chính người gọi với một khóa học. */
export const courseEnrollmentDtoSchema = z.object({
  status: enrollmentStatusSchema,
  /** `null` khi chưa ghi danh. */
  enrolled_at: dateTime.nullable(),
});
export type CourseEnrollmentDto = z.infer<typeof courseEnrollmentDtoSchema>;

/**
 * Chi tiết khóa học: chỉ thông tin khóa, không kèm bài học (lấy qua `GET /courses/{id}/lessons`).
 * `enrollment` là trạng thái ghi danh của học viên đang gọi; `null` với admin và giảng viên.
 */
export const courseDetailDtoSchema = courseDtoSchema.extend({
  enrollment: courseEnrollmentDtoSchema.nullable(),
});
export type CourseDetailDto = z.infer<typeof courseDetailDtoSchema>;

export const courseSummaryDtoSchema = z.object({
  total: z.number().int(),
  draft: z.number().int(),
  published: z.number().int(),
  archived: z.number().int(),
});
export type CourseSummaryDto = z.infer<typeof courseSummaryDtoSchema>;

export const quizOptionDtoSchema = z.object({
  id: idSchema,
  option_markdown: z.string(),
  display_order: z.number().int(),
  /** Vắng ở view học viên khi chưa nộp bài. */
  is_correct: z.boolean().optional(),
});
export type QuizOptionDto = z.infer<typeof quizOptionDtoSchema>;

export const quizQuestionDtoSchema = z.object({
  id: idSchema,
  question_markdown: z.string(),
  question_type: questionTypeSchema,
  points: z.number(),
  display_order: z.number().int(),
  options: z.array(quizOptionDtoSchema),
});
export type QuizQuestionDto = z.infer<typeof quizQuestionDtoSchema>;

export const quizSummaryDtoSchema = z.object({
  id: idSchema,
  lesson_id: idSchema,
  title: z.string(),
  description_markdown: z.string().nullable(),
  display_order: z.number().int(),
  status: quizStatusSchema,
  question_count: z.number().int(),
  created_at: dateTime,
  updated_at: dateTime,
});
export type QuizSummaryDto = z.infer<typeof quizSummaryDtoSchema>;

export const quizDtoSchema = quizSummaryDtoSchema.extend({
  questions: z.array(quizQuestionDtoSchema),
});
export type QuizDto = z.infer<typeof quizDtoSchema>;

export const enrollmentDtoSchema = z.object({
  id: idSchema,
  course_id: idSchema,
  student_id: idSchema,
  enrolled_at: dateTime,
});
export type EnrollmentDto = z.infer<typeof enrollmentDtoSchema>;

export const lessonProgressDtoSchema = z.object({
  lesson_id: idSchema,
  progress_percent: z.number(),
  completed_at: dateTime.nullable(),
  updated_at: dateTime,
});
export type LessonProgressDto = z.infer<typeof lessonProgressDtoSchema>;

export const courseProgressDtoSchema = z.object({
  course_id: idSchema,
  total_lessons: z.number().int(),
  completed_lessons: z.number().int(),
  percent: z.number(),
  lessons: z.array(lessonProgressDtoSchema),
});
export type CourseProgressDto = z.infer<typeof courseProgressDtoSchema>;

export const attemptAnswerDtoSchema = z.object({
  question_id: idSchema,
  option_ids: z.array(idSchema),
});

export const attemptDtoSchema = z.object({
  id: idSchema,
  quiz_id: idSchema,
  status: attemptStatusSchema,
  started_at: dateTime,
  submitted_at: dateTime.nullable(),
  score: z.number().nullable(),
  max_score: z.number().nullable(),
  answers: z.array(attemptAnswerDtoSchema),
});
export type AttemptDto = z.infer<typeof attemptDtoSchema>;

/** Chi tiết lượt làm bài đã nộp kèm quiz có đáp án đúng; lượt đang làm thì `quiz` không lộ đáp án. */
export const attemptDetailDtoSchema = attemptDtoSchema.extend({ quiz: quizDtoSchema });
export type AttemptDetailDto = z.infer<typeof attemptDetailDtoSchema>;

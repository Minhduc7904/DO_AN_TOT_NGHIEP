export const LESSON_COURSE_CLIENT = Symbol('LESSON_COURSE_CLIENT');
export const MEDIA_CONTENT_SOURCE = Symbol('MEDIA_CONTENT_SOURCE');

/** Người yêu cầu job; mọi thao tác ghi vào course chạy dưới danh nghĩa này. */
export interface Requester {
  id: string;
  role: string;
}

export interface LessonContext {
  title: string;
  contentMarkdown: string | null;
}

export interface QuizDraftInput {
  title: string;
  descriptionMarkdown: string | null;
  questions: readonly unknown[];
}

export type CreateQuizOutcome =
  | { kind: 'created'; quizId: string }
  /** Dữ liệu quiz không hợp lệ: trả lại cho model để sửa (không làm hỏng job). */
  | { kind: 'invalid'; message: string; details: unknown };

/**
 * Cạnh `ai-worker → course` (internal): đọc bối cảnh bài học và ghi kết quả. Lỗi của course
 * (404, 403, 409 `LESSON_CONTENT_EXISTS`, …) được ném lại thành `AppError` mang mã gốc.
 */
export interface LessonCourseClient {
  getContext(courseId: string, lessonId: string): Promise<LessonContext>;
  applyContent(input: {
    courseId: string;
    lessonId: string;
    requestedBy: Requester;
    contentMarkdown: string;
    overwriteContent: boolean;
  }): Promise<{ previousContentMarkdown: string | null }>;
  createQuiz(input: {
    courseId: string;
    lessonId: string;
    requestedBy: Requester;
    quiz: QuizDraftInput;
  }): Promise<CreateQuizOutcome>;
}

/** Cạnh `ai-worker → media` (internal): tải byte nội dung một tệp READY. */
export interface MediaContentSource {
  /** Lỗi của media (không tồn tại, chưa READY, …) được ném lại thành `AppError` mang mã gốc. */
  downloadContent(mediaId: string): Promise<Uint8Array>;
}

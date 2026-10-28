import { AppError } from '@aiops-lms/common/errors';

/** Mã lỗi nghiệp vụ của `course` (khai báo trong http-and-event-contracts-v2 §4.3). */
export const COURSE_ERROR_CODES = {
  lessonOrderConflict: 'LESSON_ORDER_CONFLICT',
  quizHasAttempts: 'QUIZ_HAS_ATTEMPTS',
  courseNotEnrollable: 'COURSE_NOT_ENROLLABLE',
  enrollmentAlreadyExists: 'ENROLLMENT_ALREADY_EXISTS',
  studentNotEnrolled: 'STUDENT_NOT_ENROLLED',
  quizAttemptAlreadySubmitted: 'QUIZ_ATTEMPT_ALREADY_SUBMITTED',
  aiDocumentsNotExtracted: 'AI_DOCUMENTS_NOT_EXTRACTED',
  lessonContentExists: 'LESSON_CONTENT_EXISTS',
} as const;

export const courseErrors = {
  lessonOrderConflict: (): AppError =>
    new AppError(
      COURSE_ERROR_CODES.lessonOrderConflict,
      409,
      'Thứ tự bài học bị trùng hoặc không khớp danh sách bài học hiện có',
    ),
  quizHasAttempts: (): AppError =>
    new AppError(
      COURSE_ERROR_CODES.quizHasAttempts,
      409,
      'Quiz đã có lượt làm bài nên không thể sửa câu hỏi hoặc xóa',
    ),
  courseNotEnrollable: (): AppError =>
    new AppError(
      COURSE_ERROR_CODES.courseNotEnrollable,
      403,
      'Chỉ ghi danh được khóa học đã xuất bản',
    ),
  enrollmentAlreadyExists: (): AppError =>
    new AppError(COURSE_ERROR_CODES.enrollmentAlreadyExists, 409, 'Đã ghi danh khóa học này'),
  studentNotEnrolled: (): AppError =>
    new AppError(COURSE_ERROR_CODES.studentNotEnrolled, 403, 'Học viên chưa ghi danh khóa học'),
  quizAttemptAlreadySubmitted: (): AppError =>
    new AppError(COURSE_ERROR_CODES.quizAttemptAlreadySubmitted, 409, 'Lượt làm bài đã được nộp'),
  aiDocumentsNotExtracted: (mediaIds: readonly string[]): AppError =>
    new AppError(
      COURSE_ERROR_CODES.aiDocumentsNotExtracted,
      422,
      'Có tài liệu chưa được trích xuất văn bản',
      { media_ids: mediaIds },
    ),
  lessonContentExists: (): AppError =>
    new AppError(
      COURSE_ERROR_CODES.lessonContentExists,
      409,
      'Bài học đã có nội dung; cần overwrite_content=true để ghi đè',
    ),
};

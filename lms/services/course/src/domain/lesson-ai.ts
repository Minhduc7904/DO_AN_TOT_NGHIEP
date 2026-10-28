/** Trạng thái hiển thị của tài liệu trong panel AI; `ai` quyết định (course chỉ chuyển tiếp). */
export type LessonAiDocumentStatus =
  'NOT_QUEUED' | 'PENDING' | 'EXTRACTING' | 'EXTRACTED' | 'FAILED' | 'UNSUPPORTED';
export type LessonAiJobType = 'SYNTHESIZE_LESSON' | 'GENERATE_QUIZ';
export type LessonAiJobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

/** Tệp đính kèm của bài học do `media` trả về (usage `LESSON_ATTACHMENT`). */
export interface LessonAttachment {
  mediaId: string;
  position: number;
  fileName: string;
  contentType: string;
  mediaType: string;
  sizeBytes: number;
}

/** Trạng thái trích xuất của một tệp đính kèm (văn bản trích xuất không bao giờ rời `ai`). */
export interface LessonAiDocumentView {
  mediaId: string;
  fileName: string;
  contentType: string;
  mediaType: string;
  status: LessonAiDocumentStatus;
  errorCode: string | null;
  errorMessage: string | null;
  textLength: number;
  updatedAt: Date | null;
}

/** Job AI do `ai` sở hữu; course chỉ chuyển tiếp và trình bày. */
export interface LessonAiJob {
  id: string;
  lessonId: string;
  courseId: string;
  jobType: LessonAiJobType;
  status: LessonAiJobStatus;
  mediaIds: string[];
  questionCount: number | null;
  overwriteContent: boolean;
  hasPreviousContent: boolean;
  resultQuizId: string | null;
  stepCount: number;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}

export interface LessonAiJobDetail {
  job: LessonAiJob;
  previousContentMarkdown: string | null;
}

/** Tối đa số job gần nhất trả về cho `GET …/ai-jobs`. */
export const LESSON_AI_RECENT_JOBS = 10;

import type {
  LessonAiJob,
  LessonAiJobDetail,
  LessonAiJobType,
  LessonAttachment,
} from '../../domain/lesson-ai.js';

export const LESSON_AI_SERVICE = Symbol('LESSON_AI_SERVICE');

/** Trạng thái do `ai` báo; `PROCESSING` của `ai` được course trình bày là `EXTRACTING`. */
export interface AiDocumentState {
  mediaId: string;
  status: 'NOT_QUEUED' | 'PENDING' | 'PROCESSING' | 'EXTRACTED' | 'FAILED' | 'UNSUPPORTED';
  errorCode: string | null;
  errorMessage: string | null;
  textLength: number;
  updatedAt: Date | null;
}

export interface CreateAiJobCommand {
  jobType: LessonAiJobType;
  courseId: string;
  lessonId: string;
  mediaIds: readonly string[];
  questionCount: number | undefined;
  overwriteContent: boolean;
  requestedBy: { id: string; role: string };
}

/**
 * Cạnh `course → ai` (internal): tài liệu và job AI của bài học do `ai` sở hữu. Lỗi của `ai`
 * (`AI_JOB_ALREADY_ACTIVE`, `AI_DOCUMENTS_NOT_EXTRACTED`, 404, …) được ném lại thành `AppError` mang mã gốc.
 */
export interface LessonAiService {
  /** Đưa tệp vào hàng chờ trích xuất (idempotent), tùy chọn thử lại tệp `FAILED`; trả trạng thái từng tệp. */
  syncDocuments(
    attachments: readonly LessonAttachment[],
    retryFailed: boolean,
  ): Promise<AiDocumentState[]>;
  /** Trạng thái từng tệp (không ghi dữ liệu). */
  queryDocuments(attachments: readonly LessonAttachment[]): Promise<AiDocumentState[]>;
  createJob(command: CreateAiJobCommand): Promise<LessonAiJob>;
  listJobs(lessonId: string): Promise<LessonAiJob[]>;
  getJob(lessonId: string, jobId: string): Promise<LessonAiJobDetail>;
}

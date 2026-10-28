import type { AiDocument, AiDocumentStatus, AiJob, AiJobType } from '../../domain/lesson-ai.js';

export const DOCUMENT_REPOSITORY = Symbol('DOCUMENT_REPOSITORY');
export const JOB_REPOSITORY = Symbol('JOB_REPOSITORY');

export interface NewDocument {
  id: string;
  mediaId: string;
  fileName: string;
  contentType: string;
  mediaType: string;
  /** `PENDING` nếu định dạng hỗ trợ, ngược lại `UNSUPPORTED`. */
  status: Extract<AiDocumentStatus, 'PENDING' | 'UNSUPPORTED'>;
}

/** Tài liệu worker vừa nhận (đã chuyển `PROCESSING`). */
export interface ClaimedDocument {
  id: string;
  mediaId: string;
  fileName: string;
  contentType: string;
  mediaType: string;
  attemptCount: number;
}

export interface DocumentText {
  mediaId: string;
  fileName: string;
  status: AiDocumentStatus;
  text: string | null;
}

/** Tài liệu cần gửi command trích xuất (vừa chèn, vừa đặt lại hoặc nhận lại sau khi gián đoạn). */
export interface DocumentToExtract {
  mediaId: string;
  fileName: string;
  contentType: string;
  mediaType: string;
}

/** Tài liệu trích xuất của `ai`: duy nhất theo `media_id`, nhận việc bằng lease. */
export interface DocumentRepository {
  /** Bản ghi (không kèm văn bản) theo `mediaIds`; media chưa có bản ghi bị bỏ qua. */
  list(mediaIds: readonly string[]): Promise<AiDocument[]>;
  /** Văn bản theo `mediaIds` (thứ tự theo `mediaIds`); media chưa có bản ghi bị bỏ qua. */
  getTexts(mediaIds: readonly string[]): Promise<DocumentText[]>;
  /**
   * Chèn tài liệu chưa có (idempotent theo `media_id`, không lỗi khi trùng). Trả danh sách `PENDING`
   * vừa được chèn mới (cần gửi command); `UNSUPPORTED` và tài liệu đã tồn tại không nằm trong đó.
   */
  insertMissing(documents: readonly NewDocument[]): Promise<DocumentToExtract[]>;
  /** Đặt các tài liệu `FAILED` về `PENDING` (xóa lỗi, reset số lần thử); trả các tài liệu đã đặt lại. */
  resetFailed(mediaIds: readonly string[]): Promise<DocumentToExtract[]>;
  /** Chuyển `PROCESSING` quá hạn lease và đã hết lượt thử sang `FAILED` (`EXTRACTION_INTERRUPTED`). */
  failExhausted(mediaIds: readonly string[], now: Date, maxAttempts: number): Promise<number>;
  /** Đặt `PROCESSING` quá hạn lease (còn lượt thử) về `PENDING`; trả các tài liệu cần gửi lại command. */
  requeueStale(
    mediaIds: readonly string[],
    now: Date,
    maxAttempts: number,
  ): Promise<DocumentToExtract[]>;
  /**
   * Nhận tài liệu `PENDING` hoặc `PROCESSING` quá hạn lease còn lượt thử (atomic: hai worker không
   * nhận trùng). `null` nếu tài liệu không tồn tại, đã xong, hoặc đang được worker khác xử lý.
   */
  claim(
    mediaId: string,
    now: Date,
    leaseUntil: Date,
    maxAttempts: number,
  ): Promise<ClaimedDocument | null>;
  complete(id: string, text: string, now: Date): Promise<void>;
  fail(id: string, errorCode: string, errorMessage: string, now: Date): Promise<void>;
  /** Đánh `FAILED` tài liệu còn `PENDING|PROCESSING` (dùng khi command rơi vào hàng đợi lỗi). */
  failActiveByMedia(
    mediaId: string,
    errorCode: string,
    errorMessage: string,
    now: Date,
  ): Promise<void>;
}

export interface NewJob {
  id: string;
  lessonId: string;
  courseId: string;
  jobType: AiJobType;
  mediaIds: readonly string[];
  questionCount: number | null;
  overwriteContent: boolean;
  requestedById: string;
  requestedByRole: string;
}

export interface JobDetail {
  job: AiJob;
  previousContentMarkdown: string | null;
}

/** Job AI của `ai`: mỗi (lesson, loại) tối đa một job `PENDING|RUNNING`. */
export interface JobRepository {
  /** Trả `null` khi đã có job `PENDING|RUNNING` cùng bài học và loại. */
  create(job: NewJob): Promise<AiJob | null>;
  listRecent(lessonId: string, limit: number): Promise<AiJob[]>;
  find(lessonId: string, jobId: string): Promise<JobDetail | null>;

  /** Nhận job `PENDING` (atomic); `null` nếu không còn `PENDING` (đã chạy, đang chạy hoặc không tồn tại). */
  claim(jobId: string, now: Date, leaseUntil: Date): Promise<AiJob | null>;
  /** Job `RUNNING` quá hạn lease chuyển `FAILED` `WORKER_INTERRUPTED` (không chạy lại để khỏi ghi trùng). */
  failIfInterrupted(jobId: string, now: Date): Promise<boolean>;
  /** Gia hạn lease và tăng `step_count` trước mỗi lượt gọi model. */
  beginStep(jobId: string, now: Date, leaseUntil: Date): Promise<void>;
  recordPreviousContent(jobId: string, content: string, now: Date): Promise<void>;
  clearPreviousContent(jobId: string, now: Date): Promise<void>;
  complete(jobId: string, resultQuizId: string | null, now: Date): Promise<void>;
  fail(jobId: string, errorCode: string, errorMessage: string, now: Date): Promise<void>;
  /** Đánh `FAILED` job còn `PENDING|RUNNING` (dùng khi command rơi vào hàng đợi lỗi). */
  failIfActive(jobId: string, errorCode: string, errorMessage: string, now: Date): Promise<void>;
}

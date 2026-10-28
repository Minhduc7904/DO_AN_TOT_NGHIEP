export type AiDocumentStatus = 'PENDING' | 'PROCESSING' | 'EXTRACTED' | 'FAILED' | 'UNSUPPORTED';
export type AiJobType = 'SYNTHESIZE_LESSON' | 'GENERATE_QUIZ';
export type AiJobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

/** Tài liệu đã đưa vào hàng chờ trích xuất; `extractedText` chỉ đọc khi worker cần, không bao giờ ra API. */
export interface AiDocument {
  id: string;
  mediaId: string;
  fileName: string;
  contentType: string;
  mediaType: string;
  status: AiDocumentStatus;
  attemptCount: number;
  errorCode: string | null;
  errorMessage: string | null;
  /** Số ký tự văn bản đã trích xuất. */
  textLength: number;
  updatedAt: Date;
}

export interface AiJob {
  id: string;
  lessonId: string;
  courseId: string;
  jobType: AiJobType;
  status: AiJobStatus;
  mediaIds: string[];
  questionCount: number | null;
  overwriteContent: boolean;
  hasPreviousContent: boolean;
  resultQuizId: string | null;
  stepCount: number;
  errorCode: string | null;
  errorMessage: string | null;
  requestedById: string;
  requestedByRole: string;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}

export const AI_LIMITS = {
  /** Tối đa số job gần nhất trả về cho `GET …/ai-jobs`. */
  recentJobs: 10,
  maxDocumentBytes: 15 * 1024 * 1024,
  maxExtractedChars: 300_000,
  /** Tổng ký tự văn bản các tài liệu đưa vào một job. */
  maxPromptChars: 150_000,
  maxSteps: 6,
  maxExtractionAttempts: 3,
  maxLessonMarkdownChars: 20_000,
  /** Tối đa số tùy chọn mỗi câu hỏi mà tool tạo quiz chấp nhận (khớp `QUIZ_LIMITS.optionsMax` của course). */
  maxQuizOptions: 10,
  maxErrorMessageChars: 500,
} as const;

export const EXTRACTION_TRUNCATED_NOTE = '\n\n[Văn bản đã bị cắt vì vượt giới hạn độ dài cho phép]';
export const OUTPUT_TRUNCATED_NOTE =
  '\n\n[Văn bản có thể chưa đầy đủ vì model dừng do hết giới hạn đầu ra]';

/** Cách đọc một tài liệu: đọc thẳng, parser DOCX hoặc nhờ LLM (PDF, ảnh). */
export type DocumentKind = 'TEXT' | 'DOCX' | 'PDF' | 'IMAGE';

const EXTENSION_KINDS: Record<string, DocumentKind> = {
  txt: 'TEXT',
  md: 'TEXT',
  markdown: 'TEXT',
  docx: 'DOCX',
  pdf: 'PDF',
  png: 'IMAGE',
  jpg: 'IMAGE',
  jpeg: 'IMAGE',
  webp: 'IMAGE',
  gif: 'IMAGE',
};

const MIME_KINDS: Record<string, DocumentKind> = {
  'text/plain': 'TEXT',
  'text/markdown': 'TEXT',
  'text/x-markdown': 'TEXT',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/pdf': 'PDF',
  'image/png': 'IMAGE',
  'image/jpeg': 'IMAGE',
  'image/webp': 'IMAGE',
  'image/gif': 'IMAGE',
};

/** Phân loại theo MIME trước, đuôi tệp sau; `null` nếu định dạng không được hỗ trợ. */
export function classifyDocument(fileName: string, contentType: string): DocumentKind | null {
  const mime = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  const byMime = MIME_KINDS[mime];
  if (byMime) return byMime;
  const extension = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : undefined;
  return extension ? (EXTENSION_KINDS[extension] ?? null) : null;
}

/** Cắt văn bản trích xuất quá dài và ghi chú lại. */
export function limitExtractedText(text: string): string {
  if (text.length <= AI_LIMITS.maxExtractedChars) return text;
  return text.slice(0, AI_LIMITS.maxExtractedChars) + EXTRACTION_TRUNCATED_NOTE;
}

export function truncateErrorMessage(message: string): string {
  return message.length <= AI_LIMITS.maxErrorMessageChars
    ? message
    : `${message.slice(0, AI_LIMITS.maxErrorMessageChars - 1)}…`;
}

export const AI_JOB_ERROR_CODES = {
  documentNotReady: 'DOCUMENT_NOT_READY',
  documentsTooLarge: 'DOCUMENTS_TOO_LARGE',
  tooManySteps: 'AI_TOO_MANY_STEPS',
  noResult: 'AI_NO_RESULT',
  workerInterrupted: 'WORKER_INTERRUPTED',
  lessonContentExists: 'LESSON_CONTENT_EXISTS',
  unexpected: 'UNEXPECTED_ERROR',
} as const;

export const DOCUMENT_ERROR_CODES = {
  unsupported: 'UNSUPPORTED_FORMAT',
  tooLarge: 'DOCUMENT_TOO_LARGE',
  empty: 'EXTRACTION_EMPTY',
  failed: 'EXTRACTION_FAILED',
  interrupted: 'EXTRACTION_INTERRUPTED',
} as const;

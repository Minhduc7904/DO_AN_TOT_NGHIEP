import { AppError } from '@aiops-lms/common/errors';

import type { DocxTextExtractor } from '../../src/application/ports/docx-text-extractor.js';
import type {
  ClaimedDocument,
  DocumentRepository,
  DocumentText,
  DocumentToExtract,
  JobDetail,
  JobRepository,
  NewDocument,
  NewJob,
} from '../../src/application/ports/lesson-ai-repositories.js';
import type {
  CreateQuizOutcome,
  LessonContext,
  LessonCourseClient,
  MediaContentSource,
  QuizDraftInput,
  Requester,
} from '../../src/application/ports/lesson-course-client.js';
import type { ChatResult } from '../../src/application/ports/provider-client.js';
import type {
  AiCommands,
  AiStores,
  AiUnitOfWork,
} from '../../src/application/ports/unit-of-work.js';
import type {
  Completion,
  CompletionInput,
} from '../../src/application/use-cases/completions/create-completion.use-case.js';
import {
  AI_JOB_ERROR_CODES,
  type AiDocument,
  type AiJob,
  DOCUMENT_ERROR_CODES,
} from '../../src/domain/lesson-ai.js';
import { FakeClock } from './fakes.js';

export const NOW = new Date('2026-10-28T08:00:00.000Z');

interface StoredDocument extends AiDocument {
  text: string | null;
  leaseExpiresAt: Date | null;
  createdSeq: number;
}

interface StoredJob extends AiJob {
  previousContentMarkdown: string | null;
  leaseExpiresAt: Date | null;
}

const ACTIVE = new Set(['PENDING', 'RUNNING']);

export class InMemoryDocuments implements DocumentRepository {
  readonly rows = new Map<string, StoredDocument>();
  private sequence = 0;

  byMedia(mediaId: string): StoredDocument | undefined {
    return [...this.rows.values()].find((document) => document.mediaId === mediaId);
  }

  list(mediaIds: readonly string[]): Promise<AiDocument[]> {
    return Promise.resolve(
      mediaIds.flatMap((mediaId) => {
        const document = this.byMedia(mediaId);
        if (!document) return [];
        return [
          {
            id: document.id,
            mediaId: document.mediaId,
            fileName: document.fileName,
            contentType: document.contentType,
            mediaType: document.mediaType,
            status: document.status,
            attemptCount: document.attemptCount,
            errorCode: document.errorCode,
            errorMessage: document.errorMessage,
            textLength: document.textLength,
            updatedAt: document.updatedAt,
          },
        ];
      }),
    );
  }

  getTexts(mediaIds: readonly string[]): Promise<DocumentText[]> {
    return Promise.resolve(
      mediaIds.flatMap((mediaId) => {
        const document = this.byMedia(mediaId);
        return document
          ? [{ mediaId, fileName: document.fileName, status: document.status, text: document.text }]
          : [];
      }),
    );
  }

  insertMissing(documents: readonly NewDocument[]): Promise<DocumentToExtract[]> {
    const inserted: DocumentToExtract[] = [];
    for (const document of documents) {
      if (this.byMedia(document.mediaId)) continue;
      this.rows.set(document.id, {
        ...document,
        attemptCount: 0,
        errorCode: null,
        errorMessage: null,
        textLength: 0,
        updatedAt: NOW,
        text: null,
        leaseExpiresAt: null,
        createdSeq: (this.sequence += 1),
      });
      if (document.status === 'PENDING') inserted.push(toExtract(document));
    }
    return Promise.resolve(inserted);
  }

  resetFailed(mediaIds: readonly string[]): Promise<DocumentToExtract[]> {
    const reset: DocumentToExtract[] = [];
    for (const mediaId of mediaIds) {
      const document = this.byMedia(mediaId);
      if (document?.status !== 'FAILED') continue;
      Object.assign(document, {
        status: 'PENDING',
        attemptCount: 0,
        errorCode: null,
        errorMessage: null,
        leaseExpiresAt: null,
      });
      reset.push(toExtract(document));
    }
    return Promise.resolve(reset);
  }

  failExhausted(mediaIds: readonly string[], now: Date, maxAttempts: number): Promise<number> {
    let count = 0;
    for (const mediaId of mediaIds) {
      const document = this.byMedia(mediaId);
      if (
        document?.status === 'PROCESSING' &&
        document.leaseExpiresAt !== null &&
        document.leaseExpiresAt < now &&
        document.attemptCount >= maxAttempts
      ) {
        Object.assign(document, {
          status: 'FAILED',
          errorCode: DOCUMENT_ERROR_CODES.interrupted,
          errorMessage: 'Trích xuất bị gián đoạn nhiều lần',
          leaseExpiresAt: null,
        });
        count += 1;
      }
    }
    return Promise.resolve(count);
  }

  requeueStale(
    mediaIds: readonly string[],
    now: Date,
    maxAttempts: number,
  ): Promise<DocumentToExtract[]> {
    const requeued: DocumentToExtract[] = [];
    for (const mediaId of mediaIds) {
      const document = this.byMedia(mediaId);
      if (
        document?.status === 'PROCESSING' &&
        document.leaseExpiresAt !== null &&
        document.leaseExpiresAt < now &&
        document.attemptCount < maxAttempts
      ) {
        Object.assign(document, { status: 'PENDING', leaseExpiresAt: null });
        requeued.push(toExtract(document));
      }
    }
    return Promise.resolve(requeued);
  }

  claim(
    mediaId: string,
    now: Date,
    leaseUntil: Date,
    maxAttempts: number,
  ): Promise<ClaimedDocument | null> {
    const document = this.byMedia(mediaId);
    const claimable =
      document !== undefined &&
      (document.status === 'PENDING' ||
        (document.status === 'PROCESSING' &&
          document.leaseExpiresAt !== null &&
          document.leaseExpiresAt < now)) &&
      document.attemptCount < maxAttempts;
    if (!document || !claimable) return Promise.resolve(null);
    Object.assign(document, {
      status: 'PROCESSING',
      attemptCount: document.attemptCount + 1,
      leaseExpiresAt: leaseUntil,
    });
    return Promise.resolve({
      id: document.id,
      mediaId: document.mediaId,
      fileName: document.fileName,
      contentType: document.contentType,
      mediaType: document.mediaType,
      attemptCount: document.attemptCount,
    });
  }

  complete(id: string, text: string, now: Date): Promise<void> {
    Object.assign(required(this.rows, id), {
      status: 'EXTRACTED',
      text,
      textLength: text.length,
      errorCode: null,
      errorMessage: null,
      leaseExpiresAt: null,
      updatedAt: now,
    });
    return Promise.resolve();
  }

  fail(id: string, errorCode: string, errorMessage: string, now: Date): Promise<void> {
    Object.assign(required(this.rows, id), {
      status: 'FAILED',
      errorCode,
      errorMessage,
      leaseExpiresAt: null,
      updatedAt: now,
    });
    return Promise.resolve();
  }

  failActiveByMedia(
    mediaId: string,
    errorCode: string,
    errorMessage: string,
    now: Date,
  ): Promise<void> {
    const document = this.byMedia(mediaId);
    if (document && (document.status === 'PENDING' || document.status === 'PROCESSING')) {
      Object.assign(document, { status: 'FAILED', errorCode, errorMessage, updatedAt: now });
    }
    return Promise.resolve();
  }
}

export class InMemoryJobs implements JobRepository {
  readonly rows = new Map<string, StoredJob>();
  private sequence = 0;

  create(job: NewJob): Promise<AiJob | null> {
    const active = [...this.rows.values()].some(
      (entry) =>
        entry.lessonId === job.lessonId &&
        entry.jobType === job.jobType &&
        ACTIVE.has(entry.status),
    );
    if (active) return Promise.resolve(null);
    const stored: StoredJob = {
      ...job,
      mediaIds: [...job.mediaIds],
      status: 'PENDING',
      hasPreviousContent: false,
      resultQuizId: null,
      stepCount: 0,
      errorCode: null,
      errorMessage: null,
      createdAt: new Date(NOW.getTime() + (this.sequence += 1)),
      updatedAt: NOW,
      startedAt: null,
      finishedAt: null,
      previousContentMarkdown: null,
      leaseExpiresAt: null,
    };
    this.rows.set(job.id, stored);
    return Promise.resolve(view(stored));
  }

  listRecent(lessonId: string, limit: number): Promise<AiJob[]> {
    return Promise.resolve(
      [...this.rows.values()]
        .filter((job) => job.lessonId === lessonId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit)
        .map(view),
    );
  }

  find(lessonId: string, jobId: string): Promise<JobDetail | null> {
    const job = this.rows.get(jobId);
    return Promise.resolve(
      job && job.lessonId === lessonId
        ? { job: view(job), previousContentMarkdown: job.previousContentMarkdown }
        : null,
    );
  }

  claim(jobId: string, now: Date, leaseUntil: Date): Promise<AiJob | null> {
    const job = this.rows.get(jobId);
    if (job?.status !== 'PENDING') return Promise.resolve(null);
    Object.assign(job, {
      status: 'RUNNING',
      startedAt: job.startedAt ?? now,
      leaseExpiresAt: leaseUntil,
    });
    return Promise.resolve(view(job));
  }

  failIfInterrupted(jobId: string, now: Date): Promise<boolean> {
    const job = this.rows.get(jobId);
    if (job?.status === 'RUNNING' && job.leaseExpiresAt !== null && job.leaseExpiresAt < now) {
      Object.assign(job, {
        status: 'FAILED',
        errorCode: AI_JOB_ERROR_CODES.workerInterrupted,
        errorMessage: 'Worker bị gián đoạn',
        finishedAt: now,
      });
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  }

  beginStep(jobId: string, _now: Date, leaseUntil: Date): Promise<void> {
    const job = required(this.rows, jobId);
    job.stepCount += 1;
    job.leaseExpiresAt = leaseUntil;
    return Promise.resolve();
  }

  recordPreviousContent(jobId: string, content: string, now: Date): Promise<void> {
    Object.assign(required(this.rows, jobId), {
      updatedAt: now,
      hasPreviousContent: true,
      previousContentMarkdown: content,
    });
    return Promise.resolve();
  }

  clearPreviousContent(jobId: string, now: Date): Promise<void> {
    Object.assign(required(this.rows, jobId), {
      updatedAt: now,
      hasPreviousContent: false,
      previousContentMarkdown: null,
    });
    return Promise.resolve();
  }

  complete(jobId: string, resultQuizId: string | null, now: Date): Promise<void> {
    Object.assign(required(this.rows, jobId), {
      status: 'COMPLETED',
      resultQuizId,
      finishedAt: now,
      leaseExpiresAt: null,
    });
    return Promise.resolve();
  }

  fail(jobId: string, errorCode: string, errorMessage: string, now: Date): Promise<void> {
    Object.assign(required(this.rows, jobId), {
      status: 'FAILED',
      errorCode,
      errorMessage,
      finishedAt: now,
      leaseExpiresAt: null,
    });
    return Promise.resolve();
  }

  failIfActive(jobId: string, errorCode: string, errorMessage: string, now: Date): Promise<void> {
    const job = this.rows.get(jobId);
    if (job && ACTIVE.has(job.status)) {
      Object.assign(job, { status: 'FAILED', errorCode, errorMessage, finishedAt: now });
    }
    return Promise.resolve();
  }
}

function toExtract(document: {
  mediaId: string;
  fileName: string;
  contentType: string;
  mediaType: string;
}): DocumentToExtract {
  return {
    mediaId: document.mediaId,
    fileName: document.fileName,
    contentType: document.contentType,
    mediaType: document.mediaType,
  };
}

function view(job: StoredJob): AiJob {
  return {
    id: job.id,
    lessonId: job.lessonId,
    courseId: job.courseId,
    jobType: job.jobType,
    status: job.status,
    mediaIds: [...job.mediaIds],
    questionCount: job.questionCount,
    overwriteContent: job.overwriteContent,
    hasPreviousContent: job.hasPreviousContent,
    resultQuizId: job.resultQuizId,
    stepCount: job.stepCount,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    requestedById: job.requestedById,
    requestedByRole: job.requestedByRole,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
  };
}

function required<T>(map: Map<string, T>, id: string): T {
  const value = map.get(id);
  if (!value) throw new Error(`Không có bản ghi ${id}`);
  return value;
}

/** Command đã "ghi vào outbox" (chỉ giữ lại để test kiểm tra). */
export interface SentCommand {
  name: 'ai.document.extract' | 'ai.job.run';
  payload: unknown;
}

/** UoW trong bộ nhớ: `run` không có rollback thật, nhưng hoàn tác command đã ghi nếu `work` ném lỗi. */
export class InMemoryAiUnitOfWork implements AiUnitOfWork {
  readonly documents = new InMemoryDocuments();
  readonly jobs = new InMemoryJobs();
  readonly sent: SentCommand[] = [];
  readonly processed = new Set<string>();
  readonly stores: AiStores;

  constructor() {
    const commands: AiCommands = {
      requestDocumentExtraction: (document) => {
        this.sent.push({ name: 'ai.document.extract', payload: document });
        return Promise.resolve();
      },
      requestJobRun: (jobId) => {
        this.sent.push({ name: 'ai.job.run', payload: { job_id: jobId } });
        return Promise.resolve();
      },
    };
    this.stores = { documents: this.documents, jobs: this.jobs, commands };
  }

  async run<T>(work: (stores: AiStores) => Promise<T>): Promise<T> {
    const before = this.sent.length;
    try {
      return await work(this.stores);
    } catch (error) {
      this.sent.length = before;
      throw error;
    }
  }

  async runOnce(
    messageId: string,
    consumer: string,
    work: (stores: AiStores) => Promise<void>,
  ): Promise<'processed' | 'deduplicated'> {
    const key = `${messageId}:${consumer}`;
    if (this.processed.has(key)) return 'deduplicated';
    await work(this.stores);
    this.processed.add(key);
    return 'processed';
  }
}

export class FakeMedia implements MediaContentSource {
  readonly files = new Map<string, Uint8Array>();
  downloads: string[] = [];

  add(mediaId: string, content: Uint8Array | string): void {
    this.files.set(
      mediaId,
      typeof content === 'string' ? new TextEncoder().encode(content) : content,
    );
  }

  downloadContent(mediaId: string): Promise<Uint8Array> {
    this.downloads.push(mediaId);
    const bytes = this.files.get(mediaId);
    return bytes
      ? Promise.resolve(bytes)
      : Promise.reject(AppError.notFound('Không tìm thấy media'));
  }
}

export class FakeDocx implements DocxTextExtractor {
  toMarkdown(bytes: Uint8Array): string {
    const text = new TextDecoder().decode(bytes);
    if (text === 'hỏng') throw new Error('docx hỏng');
    return `# DOCX\n\n${text}`;
  }
}

/** Kịch bản trả lời của provider: mỗi phần tử là completion hoặc lỗi; ghi lại mọi request. */
export class ScriptedCompletions {
  readonly requests: CompletionInput[] = [];

  constructor(private readonly script: (Completion | AppError)[]) {}

  execute(input: CompletionInput): Promise<Completion> {
    // Sao chép danh sách message: use case tiếp tục append vào mảng của nó sau lệnh gọi.
    this.requests.push({ ...input, messages: [...input.messages] });
    const next = this.script.shift();
    if (!next) throw new Error('Kịch bản AI đã hết');
    return next instanceof AppError ? Promise.reject(next) : Promise.resolve(next);
  }
}

const completion = (
  partial: Pick<ChatResult, 'text' | 'toolCalls' | 'finishReason'>,
): Completion => ({
  ...partial,
  promptTokens: 0,
  completionTokens: 0,
  task: 'lesson-synthesis',
  providerType: 'OPENAI',
  modelName: 'm',
  latencyMs: 1,
});

export const toolCall = (name: string, args: unknown, id = `call-${name}`): Completion =>
  completion({
    text: null,
    toolCalls: [
      { id, name, argumentsJson: typeof args === 'string' ? args : JSON.stringify(args) },
    ],
    finishReason: 'tool_calls',
  });

export const toolCalls = (
  calls: { id: string; name: string; argumentsJson: string }[],
): Completion => completion({ text: null, toolCalls: calls, finishReason: 'tool_calls' });

export const textReply = (text: string, finishReason = 'stop'): Completion =>
  completion({ text, toolCalls: [], finishReason });

/** Course giả: một bài học với nội dung; quiz hợp lệ khi SINGLE_CHOICE có đúng một đáp án đúng. */
export class FakeCourse implements LessonCourseClient {
  content: string | null = 'Nội dung';
  title = 'Bài học thử';
  readonly quizzes: QuizDraftInput[] = [];
  readonly writes: { requestedBy: Requester; overwriteContent: boolean }[] = [];
  forbidden = false;

  getContext(): Promise<LessonContext> {
    return Promise.resolve({ title: this.title, contentMarkdown: this.content });
  }

  applyContent(input: {
    requestedBy: Requester;
    contentMarkdown: string;
    overwriteContent: boolean;
  }): Promise<{ previousContentMarkdown: string | null }> {
    if (this.forbidden) {
      return Promise.reject(new AppError('FORBIDDEN', 403, 'Không có quyền với khóa học'));
    }
    const hasContent = (this.content?.trim().length ?? 0) > 0;
    if (hasContent && !input.overwriteContent) {
      return Promise.reject(new AppError('LESSON_CONTENT_EXISTS', 409, 'Bài học đã có nội dung'));
    }
    const previous = this.content;
    this.content = input.contentMarkdown;
    this.writes.push({ requestedBy: input.requestedBy, overwriteContent: input.overwriteContent });
    return Promise.resolve({ previousContentMarkdown: hasContent ? previous : null });
  }

  createQuiz(input: { quiz: QuizDraftInput }): Promise<CreateQuizOutcome> {
    if (this.forbidden) {
      return Promise.reject(new AppError('FORBIDDEN', 403, 'Không có quyền với khóa học'));
    }
    const wrong = (
      input.quiz.questions as { question_type: string; options: { is_correct: boolean }[] }[]
    )
      .map((question, index) => ({ question, index }))
      .find(
        ({ question }) =>
          question.question_type === 'SINGLE_CHOICE' &&
          question.options.filter((option) => option.is_correct).length !== 1,
      );
    if (wrong) {
      return Promise.resolve({
        kind: 'invalid',
        message: 'Câu hỏi không hợp lệ',
        details: [
          { path: `questions.${wrong.index}`, message: 'SINGLE_CHOICE cần đúng 1 đáp án đúng' },
        ],
      });
    }
    this.quizzes.push(input.quiz);
    return Promise.resolve({
      kind: 'created',
      quizId: `a0000000-0000-4000-8000-${String(this.quizzes.length).padStart(12, '0')}`,
    });
  }
}

export const clock = new FakeClock(NOW);

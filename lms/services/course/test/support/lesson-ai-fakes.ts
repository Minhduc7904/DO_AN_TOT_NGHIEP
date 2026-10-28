import { AppError } from '@aiops-lms/common/errors';

import type {
  AiDocumentState,
  CreateAiJobCommand,
  LessonAiService,
} from '../../src/application/ports/lesson-ai-service.js';
import type { LessonAttachmentSource } from '../../src/application/ports/lesson-attachment-source.js';
import type {
  LessonAiJob,
  LessonAiJobDetail,
  LessonAttachment,
} from '../../src/domain/lesson-ai.js';
import { NOW } from './in-memory.js';

export class FakeAttachments implements LessonAttachmentSource {
  readonly attachments: LessonAttachment[] = [];

  add(mediaId: string, fileName: string, contentType: string): void {
    this.attachments.push({
      mediaId,
      position: this.attachments.length,
      fileName,
      contentType,
      mediaType: contentType.startsWith('image/') ? 'IMAGE' : 'DOCUMENT',
      sizeBytes: 10,
    });
  }

  listLessonAttachments(): Promise<LessonAttachment[]> {
    return Promise.resolve([...this.attachments]);
  }
}

/** `ai` giả: ghi lại mọi lời gọi; trạng thái tài liệu và job do test đặt. */
export class FakeAiService implements LessonAiService {
  readonly states = new Map<string, AiDocumentState>();
  readonly calls: { method: string; args: unknown[] }[] = [];
  jobs: LessonAiJob[] = [];
  details = new Map<string, LessonAiJobDetail>();
  failWith: AppError | null = null;

  private record(method: string, ...args: unknown[]): void {
    this.calls.push({ method, args });
  }

  syncDocuments(
    attachments: readonly LessonAttachment[],
    retryFailed: boolean,
  ): Promise<AiDocumentState[]> {
    this.record(
      'syncDocuments',
      attachments.map((a) => a.mediaId),
      retryFailed,
    );
    if (this.failWith) return Promise.reject(this.failWith);
    for (const attachment of attachments) {
      const existing = this.states.get(attachment.mediaId);
      if (!existing) {
        this.states.set(attachment.mediaId, {
          mediaId: attachment.mediaId,
          status: attachment.contentType.startsWith('video/') ? 'UNSUPPORTED' : 'PENDING',
          errorCode: null,
          errorMessage: null,
          textLength: 0,
          updatedAt: NOW,
        });
      } else if (retryFailed && existing.status === 'FAILED') {
        this.states.set(attachment.mediaId, {
          ...existing,
          status: 'PENDING',
          errorCode: null,
          errorMessage: null,
        });
      }
    }
    return this.queryDocuments(attachments);
  }

  queryDocuments(attachments: readonly LessonAttachment[]): Promise<AiDocumentState[]> {
    if (this.failWith) return Promise.reject(this.failWith);
    return Promise.resolve(
      attachments.map(
        (attachment) =>
          this.states.get(attachment.mediaId) ?? {
            mediaId: attachment.mediaId,
            status: attachment.contentType.startsWith('video/') ? 'UNSUPPORTED' : 'NOT_QUEUED',
            errorCode: null,
            errorMessage: null,
            textLength: 0,
            updatedAt: null,
          },
      ),
    );
  }

  createJob(command: CreateAiJobCommand): Promise<LessonAiJob> {
    this.record('createJob', command);
    if (this.failWith) return Promise.reject(this.failWith);
    const job: LessonAiJob = {
      id: `a0000000-0000-4000-8000-${String(this.jobs.length + 1).padStart(12, '0')}`,
      lessonId: command.lessonId,
      courseId: command.courseId,
      jobType: command.jobType,
      status: 'PENDING',
      mediaIds: [...command.mediaIds],
      questionCount: command.questionCount ?? null,
      overwriteContent: command.overwriteContent,
      hasPreviousContent: false,
      resultQuizId: null,
      stepCount: 0,
      errorCode: null,
      errorMessage: null,
      createdAt: NOW,
      updatedAt: NOW,
      startedAt: null,
      finishedAt: null,
    };
    this.jobs.unshift(job);
    return Promise.resolve(job);
  }

  listJobs(lessonId: string): Promise<LessonAiJob[]> {
    this.record('listJobs', lessonId);
    if (this.failWith) return Promise.reject(this.failWith);
    return Promise.resolve(this.jobs.filter((job) => job.lessonId === lessonId));
  }

  getJob(lessonId: string, jobId: string): Promise<LessonAiJobDetail> {
    this.record('getJob', lessonId, jobId);
    if (this.failWith) return Promise.reject(this.failWith);
    const detail = this.details.get(jobId);
    return detail
      ? Promise.resolve(detail)
      : Promise.reject(AppError.notFound('Không tìm thấy job AI'));
  }
}

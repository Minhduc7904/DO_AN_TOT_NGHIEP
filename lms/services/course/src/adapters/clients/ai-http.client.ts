import { SERVICE_TOKEN_PROVIDER, type TokenProvider } from '@aiops-lms/common/auth';
import { HttpQueryClient } from '@aiops-lms/common/clients';
import { AppError } from '@aiops-lms/common/errors';
import {
  aiDocumentDtoSchema,
  type AiDocumentInput,
  apiErrorSchema,
  apiResponseSchema,
  INTERNAL_PREFIX,
  lessonAiJobDetailDtoSchema,
  lessonAiJobDtoSchema,
  type LessonAiJobDto,
} from '@aiops-lms/contracts/http';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

import type {
  AiDocumentState,
  CreateAiJobCommand,
  LessonAiService,
} from '../../application/ports/lesson-ai-service.js';
import type { LessonAiJob, LessonAiJobDetail, LessonAttachment } from '../../domain/lesson-ai.js';

const DEPENDENCY = 'course-ai';
/** Giới hạn số tệp mỗi lần gọi `ai` (khớp `AI_DOCUMENT_SYNC_MAX`). */
const DOCUMENTS_PER_CALL = 100;

const documentsSchema = apiResponseSchema(z.array(aiDocumentDtoSchema));
const jobSchema = apiResponseSchema(lessonAiJobDtoSchema);
const jobsSchema = apiResponseSchema(z.array(lessonAiJobDtoSchema));
const jobDetailSchema = apiResponseSchema(lessonAiJobDetailDtoSchema);

function toJob(dto: LessonAiJobDto): LessonAiJob {
  return {
    id: dto.id,
    lessonId: dto.lesson_id,
    courseId: dto.course_id,
    jobType: dto.job_type,
    status: dto.status,
    mediaIds: dto.media_ids,
    questionCount: dto.question_count,
    overwriteContent: dto.overwrite_content,
    hasPreviousContent: dto.has_previous_content,
    resultQuizId: dto.result_quiz_id,
    stepCount: dto.step_count,
    errorCode: dto.error_code,
    errorMessage: dto.error_message,
    createdAt: new Date(dto.created_at),
    updatedAt: new Date(dto.updated_at),
    startedAt: dto.started_at ? new Date(dto.started_at) : null,
    finishedAt: dto.finished_at ? new Date(dto.finished_at) : null,
  };
}

function toInput(attachment: LessonAttachment): AiDocumentInput {
  return {
    media_id: attachment.mediaId,
    file_name: attachment.fileName,
    content_type: attachment.contentType,
    media_type: attachment.mediaType as AiDocumentInput['media_type'],
  };
}

/**
 * Cạnh `course → ai` (HTTP nội bộ, service token audience `ai`, scope `ai:document:read|write` và
 * `ai:job:read|write`). Mã lỗi nghiệp vụ của `ai` (`AI_JOB_ALREADY_ACTIVE`, `AI_DOCUMENTS_NOT_EXTRACTED`, 404,
 * …) được giữ nguyên mã, mã HTTP và `details`; `ai` chết hoặc timeout thì `DEPENDENCY_*`.
 */
@Injectable()
export class AiHttpClient implements LessonAiService {
  private readonly client: HttpQueryClient;

  constructor(config: ConfigService, @Inject(SERVICE_TOKEN_PROVIDER) tokens: TokenProvider) {
    this.client = new HttpQueryClient({
      dependency: DEPENDENCY,
      baseUrl: config.getOrThrow<string>('COURSE_AI_BASE_URL'),
      auth: { audience: 'ai', tokens },
      timeoutMs: config.getOrThrow<number>('COURSE_AI_TIMEOUT_MS'),
      breaker: {
        failureThreshold: config.getOrThrow<number>('COURSE_AI_BREAKER_THRESHOLD'),
        cooldownMs: config.getOrThrow<number>('COURSE_AI_BREAKER_COOLDOWN_MS'),
      },
    });
  }

  syncDocuments(
    attachments: readonly LessonAttachment[],
    retryFailed: boolean,
  ): Promise<AiDocumentState[]> {
    return this.documents('sync', attachments, { retry_failed: retryFailed });
  }

  queryDocuments(attachments: readonly LessonAttachment[]): Promise<AiDocumentState[]> {
    return this.documents('query', attachments, {});
  }

  async createJob(command: CreateAiJobCommand): Promise<LessonAiJob> {
    const response = await this.client.request({
      method: 'POST',
      path: `/${INTERNAL_PREFIX}/ai/jobs`,
      body: {
        job_type: command.jobType,
        course_id: command.courseId,
        lesson_id: command.lessonId,
        media_ids: command.mediaIds,
        ...(command.questionCount === undefined ? {} : { question_count: command.questionCount }),
        overwrite_content: command.overwriteContent,
        requested_by: command.requestedBy,
      },
    });
    if (response.status !== 202 && response.status !== 200 && response.status !== 201) {
      throw upstreamError(response.status, response.body);
    }
    return toJob(this.parse(jobSchema, response.body));
  }

  async listJobs(lessonId: string): Promise<LessonAiJob[]> {
    const response = await this.client.request({
      path: `/${INTERNAL_PREFIX}/ai/jobs`,
      query: { lesson_id: lessonId },
    });
    if (response.status !== 200) throw upstreamError(response.status, response.body);
    return this.parse(jobsSchema, response.body).map(toJob);
  }

  async getJob(lessonId: string, jobId: string): Promise<LessonAiJobDetail> {
    const response = await this.client.request({
      path: `/${INTERNAL_PREFIX}/ai/jobs/${jobId}`,
      query: { lesson_id: lessonId },
    });
    if (response.status !== 200) throw upstreamError(response.status, response.body);
    const detail = this.parse(jobDetailSchema, response.body);
    return { job: toJob(detail.job), previousContentMarkdown: detail.previous_content_markdown };
  }

  private async documents(
    action: 'sync' | 'query',
    attachments: readonly LessonAttachment[],
    extra: Record<string, unknown>,
  ): Promise<AiDocumentState[]> {
    const states: AiDocumentState[] = [];
    for (let offset = 0; offset < attachments.length; offset += DOCUMENTS_PER_CALL) {
      const response = await this.client.request({
        method: 'POST',
        path: `/${INTERNAL_PREFIX}/ai/documents/${action}`,
        body: {
          documents: attachments.slice(offset, offset + DOCUMENTS_PER_CALL).map(toInput),
          ...extra,
        },
      });
      if (response.status !== 200) throw upstreamError(response.status, response.body);
      for (const dto of this.parse(documentsSchema, response.body)) {
        states.push({
          mediaId: dto.media_id,
          status: dto.status,
          errorCode: dto.error_code,
          errorMessage: dto.error_message,
          textLength: dto.text_length,
          updatedAt: dto.updated_at ? new Date(dto.updated_at) : null,
        });
      }
    }
    return states;
  }

  private parse<S extends z.ZodType<{ success: boolean; data: unknown }>>(
    schema: S,
    body: unknown,
  ): NonNullable<z.infer<S>['data']> {
    const parsed = schema.safeParse(body);
    if (!parsed.success || !parsed.data.data) throw AppError.dependencyUnavailable(DEPENDENCY);
    return parsed.data.data as NonNullable<z.infer<S>['data']>;
  }
}

function upstreamError(status: number, body: unknown): AppError {
  const error = apiErrorSchema.safeParse(body);
  if (error.success) {
    return new AppError(
      error.data.error.code,
      status,
      error.data.error.message,
      error.data.error.details ?? null,
    );
  }
  return AppError.dependencyUnavailable(DEPENDENCY);
}

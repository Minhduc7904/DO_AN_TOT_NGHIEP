import { SERVICE_TOKEN_PROVIDER, type TokenProvider } from '@aiops-lms/common/auth';
import { HttpQueryClient } from '@aiops-lms/common/clients';
import { AppError } from '@aiops-lms/common/errors';
import {
  apiErrorSchema,
  apiResponseSchema,
  appliedLessonAiContentDtoSchema,
  createdLessonAiQuizDtoSchema,
  INTERNAL_PREFIX,
  lessonAiContextDtoSchema,
} from '@aiops-lms/contracts/http';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type {
  CreateQuizOutcome,
  LessonContext,
  LessonCourseClient,
  QuizDraftInput,
  Requester,
} from '../../application/ports/lesson-course-client.js';
import { upstreamError } from './upstream-error.js';

const DEPENDENCY = 'ai-worker-course';
const contextSchema = apiResponseSchema(lessonAiContextDtoSchema);
const appliedSchema = apiResponseSchema(appliedLessonAiContentDtoSchema);
const quizSchema = apiResponseSchema(createdLessonAiQuizDtoSchema);

/**
 * Cạnh `ai-worker → course` (HTTP nội bộ, scope `course:lesson-ai:read|write`). Cạnh này tạo vòng phụ
 * thuộc `course → ai → course`; vòng được chấp nhận vì hai chiều bất đồng bộ qua job (course chỉ tạo job,
 * không chờ ai-worker) và đã ghi trong topology với `dependency_identity=ai-worker-course`.
 */
@Injectable()
export class CourseHttpClient implements LessonCourseClient {
  private readonly client: HttpQueryClient;

  constructor(config: ConfigService, @Inject(SERVICE_TOKEN_PROVIDER) tokens: TokenProvider) {
    this.client = new HttpQueryClient({
      dependency: DEPENDENCY,
      baseUrl: config.getOrThrow<string>('AI_COURSE_BASE_URL'),
      auth: { audience: 'course', tokens },
      timeoutMs: config.getOrThrow<number>('AI_COURSE_TIMEOUT_MS'),
      breaker: {
        failureThreshold: config.getOrThrow<number>('AI_COURSE_BREAKER_THRESHOLD'),
        cooldownMs: config.getOrThrow<number>('AI_COURSE_BREAKER_COOLDOWN_MS'),
      },
    });
  }

  private path(courseId: string, lessonId: string, suffix: string): string {
    return `/${INTERNAL_PREFIX}/courses/${courseId}/lessons/${lessonId}/${suffix}`;
  }

  async getContext(courseId: string, lessonId: string): Promise<LessonContext> {
    const response = await this.client.request({
      path: this.path(courseId, lessonId, 'ai-context'),
    });
    if (response.status !== 200) throw upstreamError(DEPENDENCY, response.status, response.body);
    const parsed = contextSchema.safeParse(response.body);
    if (!parsed.success || !parsed.data.data) throw AppError.dependencyUnavailable(DEPENDENCY);
    return { title: parsed.data.data.title, contentMarkdown: parsed.data.data.content_markdown };
  }

  async applyContent(input: {
    courseId: string;
    lessonId: string;
    requestedBy: Requester;
    contentMarkdown: string;
    overwriteContent: boolean;
  }): Promise<{ previousContentMarkdown: string | null }> {
    const response = await this.client.request({
      method: 'PUT',
      path: this.path(input.courseId, input.lessonId, 'ai-content'),
      body: {
        requested_by: input.requestedBy,
        content_markdown: input.contentMarkdown,
        overwrite_content: input.overwriteContent,
      },
    });
    if (response.status !== 200) throw upstreamError(DEPENDENCY, response.status, response.body);
    const parsed = appliedSchema.safeParse(response.body);
    if (!parsed.success || !parsed.data.data) throw AppError.dependencyUnavailable(DEPENDENCY);
    return { previousContentMarkdown: parsed.data.data.previous_content_markdown };
  }

  async createQuiz(input: {
    courseId: string;
    lessonId: string;
    requestedBy: Requester;
    quiz: QuizDraftInput;
  }): Promise<CreateQuizOutcome> {
    const response = await this.client.request({
      method: 'POST',
      path: this.path(input.courseId, input.lessonId, 'ai-quizzes'),
      body: {
        requested_by: input.requestedBy,
        title: input.quiz.title,
        description_markdown: input.quiz.descriptionMarkdown,
        questions: input.quiz.questions,
      },
    });
    if (response.status === 201) {
      const parsed = quizSchema.safeParse(response.body);
      if (!parsed.success || !parsed.data.data) throw AppError.dependencyUnavailable(DEPENDENCY);
      return { kind: 'created', quizId: parsed.data.data.quiz_id };
    }
    // 400: course từ chối dữ liệu quiz; trả lý do cho model sửa thay vì làm hỏng job.
    if (response.status === 400) {
      const error = apiErrorSchema.safeParse(response.body);
      if (error.success) {
        return {
          kind: 'invalid',
          message: error.data.error.message,
          details: error.data.error.details ?? null,
        };
      }
    }
    throw upstreamError(DEPENDENCY, response.status, response.body);
  }
}

import { InternalApi, parseInput } from '@aiops-lms/common/http';
import {
  applyLessonAiContentRequestSchema,
  type AppliedLessonAiContentDto,
  createLessonAiQuizRequestSchema,
  type CreatedLessonAiQuizDto,
  idSchema,
  INTERNAL_PREFIX,
  type LessonAiContextDto,
} from '@aiops-lms/contracts';
import { Body, Controller, Get, HttpCode, Inject, Param, Post, Put } from '@nestjs/common';

import { ApplyLessonAiContentUseCase } from '../../../application/lesson-ai/apply-lesson-ai-content.use-case.js';
import { GetLessonAiContextUseCase } from '../../../application/lesson-ai/get-lesson-ai-context.use-case.js';
import { CreateQuizUseCase } from '../../../application/use-cases/quizzes/create-quiz.use-case.js';
import { toQuestionDrafts } from '../shared/quiz-drafts.js';

/**
 * Bề mặt nội bộ của `course` cho `ai-worker` (job AI đọc bối cảnh bài học và ghi kết quả); không qua Gateway.
 * Thao tác ghi chạy dưới danh nghĩa `requested_by` (người tạo job) nên quyền sở hữu vẫn được kiểm tra.
 */
@Controller(`${INTERNAL_PREFIX}/courses/:course_id/lessons/:lesson_id`)
export class LessonAiInternalController {
  constructor(
    @Inject(GetLessonAiContextUseCase) private readonly getContext: GetLessonAiContextUseCase,
    @Inject(ApplyLessonAiContentUseCase) private readonly applyContent: ApplyLessonAiContentUseCase,
    @Inject(CreateQuizUseCase) private readonly createQuiz: CreateQuizUseCase,
  ) {}

  @InternalApi({ scopes: ['course:lesson-ai:read'] })
  @Get('ai-context')
  async context(
    @Param('course_id') courseId: string,
    @Param('lesson_id') lessonId: string,
  ): Promise<LessonAiContextDto> {
    const context = await this.getContext.execute(
      parseInput(idSchema, courseId),
      parseInput(idSchema, lessonId),
    );
    return {
      course_id: context.courseId,
      lesson_id: context.lessonId,
      title: context.title,
      content_markdown: context.contentMarkdown,
    };
  }

  @InternalApi({ scopes: ['course:lesson-ai:write'] })
  @Put('ai-content')
  async content(
    @Param('course_id') courseId: string,
    @Param('lesson_id') lessonId: string,
    @Body() body: unknown,
  ): Promise<AppliedLessonAiContentDto> {
    const input = parseInput(applyLessonAiContentRequestSchema, body);
    const result = await this.applyContent.execute(
      input.requested_by,
      parseInput(idSchema, courseId),
      parseInput(idSchema, lessonId),
      { contentMarkdown: input.content_markdown, overwriteContent: input.overwrite_content },
    );
    return { previous_content_markdown: result.previousContentMarkdown };
  }

  /** Tạo quiz `DRAFT`; dữ liệu sai trả `400` kèm chi tiết để model sửa. */
  @InternalApi({ scopes: ['course:lesson-ai:write'] })
  @Post('ai-quizzes')
  @HttpCode(201)
  async quiz(
    @Param('course_id') courseId: string,
    @Param('lesson_id') lessonId: string,
    @Body() body: unknown,
  ): Promise<CreatedLessonAiQuizDto> {
    const input = parseInput(createLessonAiQuizRequestSchema, body);
    const quiz = await this.createQuiz.execute(
      input.requested_by,
      parseInput(idSchema, courseId),
      parseInput(idSchema, lessonId),
      {
        title: input.title,
        descriptionMarkdown: input.description_markdown ?? null,
        questions: toQuestionDrafts(input.questions),
      },
    );
    return { quiz_id: quiz.id };
  }
}

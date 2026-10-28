import { PUBLIC_PREFIX } from '@aiops-lms/contracts/http';
import {
  type CreateQuizRequest,
  createQuizRequestSchema,
  idSchema,
  type QuizDto,
  type QuizSummaryDto,
  type UpdateQuizRequest,
  updateQuizRequestSchema,
} from '@aiops-lms/contracts';
import { CurrentPrincipal, parseInput, Roles } from '@aiops-lms/common/http';
import type { Principal } from '@aiops-lms/common/ports';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { CreateQuizUseCase } from '../../../application/use-cases/quizzes/create-quiz.use-case.js';
import { DeleteQuizUseCase } from '../../../application/use-cases/quizzes/delete-quiz.use-case.js';
import { GetQuizUseCase } from '../../../application/use-cases/quizzes/get-quiz.use-case.js';
import { ListLessonQuizzesUseCase } from '../../../application/use-cases/quizzes/list-lesson-quizzes.use-case.js';
import { UpdateQuizUseCase } from '../../../application/use-cases/quizzes/update-quiz.use-case.js';
import type { QuestionDraft } from '../../../domain/quiz-content.js';
import { presentQuiz, presentQuizSummary } from '../shared/course.presenter.js';

function toDrafts(questions: CreateQuizRequest['questions']): QuestionDraft[] {
  return questions.map((question) => ({
    questionMarkdown: question.question_markdown,
    questionType: question.question_type,
    points: question.points,
    options: question.options.map((option) => ({
      optionMarkdown: option.option_markdown,
      isCorrect: option.is_correct,
    })),
  }));
}

function toDraftsIfPresent(questions: UpdateQuizRequest['questions']): QuestionDraft[] | undefined {
  return questions === undefined ? undefined : toDrafts(questions);
}

@Roles('admin', 'instructor')
@Controller(`${PUBLIC_PREFIX}/courses/:course_id/lessons/:lesson_id/quizzes`)
export class QuizController {
  constructor(
    @Inject(CreateQuizUseCase) private readonly createQuiz: CreateQuizUseCase,
    @Inject(UpdateQuizUseCase) private readonly updateQuiz: UpdateQuizUseCase,
    @Inject(DeleteQuizUseCase) private readonly deleteQuiz: DeleteQuizUseCase,
    @Inject(GetQuizUseCase) private readonly getQuiz: GetQuizUseCase,
    @Inject(ListLessonQuizzesUseCase) private readonly listQuizzes: ListLessonQuizzesUseCase,
  ) {}

  @Post()
  async create(
    @CurrentPrincipal() principal: Principal,
    @Param('course_id') courseId: string,
    @Param('lesson_id') lessonId: string,
    @Body() body: unknown,
  ): Promise<QuizDto> {
    const input = parseInput(createQuizRequestSchema, body);
    return presentQuiz(
      await this.createQuiz.execute(
        principal,
        parseInput(idSchema, courseId),
        parseInput(idSchema, lessonId),
        {
          title: input.title,
          descriptionMarkdown: input.description_markdown ?? null,
          questions: toDrafts(input.questions),
        },
      ),
    );
  }

  @Get()
  async list(
    @CurrentPrincipal() principal: Principal,
    @Param('course_id') courseId: string,
    @Param('lesson_id') lessonId: string,
  ): Promise<QuizSummaryDto[]> {
    const quizzes = await this.listQuizzes.execute(
      principal,
      parseInput(idSchema, courseId),
      parseInput(idSchema, lessonId),
    );
    return quizzes.map(presentQuizSummary);
  }

  @Get(':quiz_id')
  async get(
    @CurrentPrincipal() principal: Principal,
    @Param('course_id') courseId: string,
    @Param('lesson_id') lessonId: string,
    @Param('quiz_id') quizId: string,
  ): Promise<QuizDto> {
    return presentQuiz(
      await this.getQuiz.execute(principal, {
        courseId: parseInput(idSchema, courseId),
        lessonId: parseInput(idSchema, lessonId),
        quizId: parseInput(idSchema, quizId),
      }),
    );
  }

  @Patch(':quiz_id')
  async update(
    @CurrentPrincipal() principal: Principal,
    @Param('course_id') courseId: string,
    @Param('lesson_id') lessonId: string,
    @Param('quiz_id') quizId: string,
    @Body() body: unknown,
  ): Promise<QuizDto> {
    const input = parseInput(updateQuizRequestSchema, body);
    return presentQuiz(
      await this.updateQuiz.execute(
        principal,
        {
          courseId: parseInput(idSchema, courseId),
          lessonId: parseInput(idSchema, lessonId),
          quizId: parseInput(idSchema, quizId),
        },
        {
          title: input.title,
          descriptionMarkdown: input.description_markdown,
          status: input.status,
          questions: toDraftsIfPresent(input.questions),
        },
      ),
    );
  }

  @Delete(':quiz_id')
  @HttpCode(204)
  async remove(
    @CurrentPrincipal() principal: Principal,
    @Param('course_id') courseId: string,
    @Param('lesson_id') lessonId: string,
    @Param('quiz_id') quizId: string,
  ): Promise<void> {
    await this.deleteQuiz.execute(principal, {
      courseId: parseInput(idSchema, courseId),
      lessonId: parseInput(idSchema, lessonId),
      quizId: parseInput(idSchema, quizId),
    });
  }
}

import { PUBLIC_PREFIX } from '@aiops-lms/contracts/http';
import {
  type AttemptDetailDto,
  type AttemptDto,
  type CourseProgressDto,
  type EnrolledCourseDto,
  type EnrollmentDto,
  idSchema,
  lessonProgressRequestSchema,
  type LessonProgressDto,
  paginationQuerySchema,
  type QuizDto,
  type QuizSummaryDto,
  saveAttemptAnswersRequestSchema,
} from '@aiops-lms/contracts';
import { CurrentPrincipal, type Page, parseInput, Roles, toPage } from '@aiops-lms/common/http';
import type { Principal } from '@aiops-lms/common/ports';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';

import { EnrollCourseUseCase } from '../../../application/use-cases/learning/enroll-course.use-case.js';
import { GetEnrolledCourseUseCase } from '../../../application/use-cases/learning/get-enrolled-course.use-case.js';
import { GetMyCourseProgressUseCase } from '../../../application/use-cases/learning/get-my-course-progress.use-case.js';
import { ListMyEnrollmentsUseCase } from '../../../application/use-cases/learning/list-my-enrollments.use-case.js';
import { UpdateLessonProgressUseCase } from '../../../application/use-cases/learning/update-lesson-progress.use-case.js';
import { GetMyAttemptUseCase } from '../../../application/use-cases/student-quizzes/get-my-attempt.use-case.js';
import { GetStudentQuizUseCase } from '../../../application/use-cases/student-quizzes/get-student-quiz.use-case.js';
import { ListMyAttemptsUseCase } from '../../../application/use-cases/student-quizzes/list-my-attempts.use-case.js';
import { ListStudentLessonQuizzesUseCase } from '../../../application/use-cases/student-quizzes/list-student-lesson-quizzes.use-case.js';
import { SaveAttemptAnswersUseCase } from '../../../application/use-cases/student-quizzes/save-attempt-answers.use-case.js';
import { StartQuizAttemptUseCase } from '../../../application/use-cases/student-quizzes/start-quiz-attempt.use-case.js';
import { SubmitQuizAttemptUseCase } from '../../../application/use-cases/student-quizzes/submit-quiz-attempt.use-case.js';
import {
  presentAttempt,
  presentAttemptDetail,
  presentCourseProgress,
  presentEnrolledCourse,
  presentEnrollment,
  presentLessonProgress,
  presentQuiz,
  presentQuizSummary,
} from '../shared/course.presenter.js';

/** Phần của `Response` mà controller dùng để đổi status mà vẫn để Nest bọc envelope. */
interface StatusSetter {
  status(code: number): unknown;
}

@Roles('student')
@Controller(`${PUBLIC_PREFIX}/student`)
export class StudentLearningController {
  constructor(
    @Inject(EnrollCourseUseCase) private readonly enrollCourse: EnrollCourseUseCase,
    @Inject(ListMyEnrollmentsUseCase) private readonly listEnrollments: ListMyEnrollmentsUseCase,
    @Inject(GetEnrolledCourseUseCase) private readonly getEnrolledCourse: GetEnrolledCourseUseCase,
    @Inject(GetMyCourseProgressUseCase) private readonly getProgress: GetMyCourseProgressUseCase,
    @Inject(UpdateLessonProgressUseCase)
    private readonly updateProgress: UpdateLessonProgressUseCase,
    @Inject(ListStudentLessonQuizzesUseCase)
    private readonly listLessonQuizzes: ListStudentLessonQuizzesUseCase,
    @Inject(GetStudentQuizUseCase) private readonly getQuiz: GetStudentQuizUseCase,
    @Inject(StartQuizAttemptUseCase) private readonly startAttempt: StartQuizAttemptUseCase,
    @Inject(ListMyAttemptsUseCase) private readonly listAttempts: ListMyAttemptsUseCase,
    @Inject(SaveAttemptAnswersUseCase) private readonly saveAnswers: SaveAttemptAnswersUseCase,
    @Inject(SubmitQuizAttemptUseCase) private readonly submitAttempt: SubmitQuizAttemptUseCase,
    @Inject(GetMyAttemptUseCase) private readonly getAttempt: GetMyAttemptUseCase,
  ) {}

  @Get('enrollments')
  async enrollments(
    @CurrentPrincipal() principal: Principal,
    @Query() query: unknown,
  ): Promise<Page<EnrollmentDto>> {
    const pagination = parseInput(paginationQuerySchema, query);
    const result = await this.listEnrollments.execute(
      principal.id,
      pagination.page,
      pagination.page_size,
    );
    return toPage(result, pagination, presentEnrollment);
  }

  @Post('courses/:course_id/enrollments')
  async enroll(
    @CurrentPrincipal() principal: Principal,
    @Param('course_id') courseId: string,
  ): Promise<EnrollmentDto> {
    return presentEnrollment(
      await this.enrollCourse.execute(principal.id, parseInput(idSchema, courseId)),
    );
  }

  @Get('courses/:course_id')
  async course(
    @CurrentPrincipal() principal: Principal,
    @Param('course_id') courseId: string,
  ): Promise<EnrolledCourseDto> {
    return presentEnrolledCourse(
      await this.getEnrolledCourse.execute(principal.id, parseInput(idSchema, courseId)),
    );
  }

  @Get('courses/:course_id/progress')
  async courseProgress(
    @CurrentPrincipal() principal: Principal,
    @Param('course_id') courseId: string,
  ): Promise<CourseProgressDto> {
    return presentCourseProgress(
      await this.getProgress.execute(principal.id, parseInput(idSchema, courseId)),
    );
  }

  @Put('lessons/:lesson_id/progress')
  async lessonProgress(
    @CurrentPrincipal() principal: Principal,
    @Param('lesson_id') lessonId: string,
    @Body() body: unknown,
  ): Promise<LessonProgressDto> {
    const input = parseInput(lessonProgressRequestSchema, body);
    return presentLessonProgress(
      await this.updateProgress.execute(
        principal.id,
        parseInput(idSchema, lessonId),
        input.progress_percent,
      ),
    );
  }

  @Get('lessons/:lesson_id/quizzes')
  async lessonQuizzes(
    @CurrentPrincipal() principal: Principal,
    @Param('lesson_id') lessonId: string,
  ): Promise<QuizSummaryDto[]> {
    const quizzes = await this.listLessonQuizzes.execute(
      principal.id,
      parseInput(idSchema, lessonId),
    );
    return quizzes.map(presentQuizSummary);
  }

  /** Cây câu hỏi không kèm `is_correct`. */
  @Get('quizzes/:quiz_id')
  async quiz(
    @CurrentPrincipal() principal: Principal,
    @Param('quiz_id') quizId: string,
  ): Promise<QuizDto> {
    return presentQuiz(
      await this.getQuiz.execute(principal.id, parseInput(idSchema, quizId)),
      false,
    );
  }

  /** 201 khi mở lượt mới, 200 khi tiếp tục lượt đang làm. */
  @Post('quizzes/:quiz_id/attempts')
  async start(
    @CurrentPrincipal() principal: Principal,
    @Param('quiz_id') quizId: string,
    @Res({ passthrough: true }) response: StatusSetter,
  ): Promise<AttemptDto> {
    const { attempt, resumed } = await this.startAttempt.execute(
      principal.id,
      parseInput(idSchema, quizId),
    );
    if (resumed) response.status(200);
    return presentAttempt(attempt);
  }

  @Get('quizzes/:quiz_id/attempts')
  async attempts(
    @CurrentPrincipal() principal: Principal,
    @Param('quiz_id') quizId: string,
    @Query() query: unknown,
  ): Promise<Page<AttemptDto>> {
    const pagination = parseInput(paginationQuerySchema, query);
    const result = await this.listAttempts.execute(
      principal.id,
      parseInput(idSchema, quizId),
      pagination.page,
      pagination.page_size,
    );
    return toPage(result, pagination, presentAttempt);
  }

  @Put('attempts/:attempt_id/answers')
  async answers(
    @CurrentPrincipal() principal: Principal,
    @Param('attempt_id') attemptId: string,
    @Body() body: unknown,
  ): Promise<AttemptDto> {
    const input = parseInput(saveAttemptAnswersRequestSchema, body);
    return presentAttempt(
      await this.saveAnswers.execute(
        principal.id,
        parseInput(idSchema, attemptId),
        input.answers.map((answer) => ({
          questionId: answer.question_id,
          optionIds: answer.option_ids,
        })),
      ),
    );
  }

  @Post('attempts/:attempt_id/submit')
  @HttpCode(200)
  async submit(
    @CurrentPrincipal() principal: Principal,
    @Param('attempt_id') attemptId: string,
  ): Promise<AttemptDetailDto> {
    return presentAttemptDetail(
      await this.submitAttempt.execute(principal.id, parseInput(idSchema, attemptId)),
    );
  }

  @Get('attempts/:attempt_id')
  async attempt(
    @CurrentPrincipal() principal: Principal,
    @Param('attempt_id') attemptId: string,
  ): Promise<AttemptDetailDto> {
    return presentAttemptDetail(
      await this.getAttempt.execute(principal.id, parseInput(idSchema, attemptId)),
    );
  }
}

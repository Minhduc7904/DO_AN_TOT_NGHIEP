import { randomUUID } from 'node:crypto';

import {
  createHttpServiceAuth,
  HttpServiceTokenSource,
  SERVICE_AUTH,
  SERVICE_TOKEN_PROVIDER,
  ServiceTokenProvider,
  type TokenProvider,
} from '@aiops-lms/common/auth';
import { COMMON_HTTP_PROVIDERS, HealthController, READINESS_CHECKS } from '@aiops-lms/common/http';
import { type Clock, type IdGenerator, systemClock } from '@aiops-lms/common/ports';
import { Module, type Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { CourseController } from './adapters/http/public/course.controller.js';
import { LessonController } from './adapters/http/public/lesson.controller.js';
import { QuizController } from './adapters/http/public/quiz.controller.js';
import { StudentLearningController } from './adapters/http/public/student-learning.controller.js';
import { MediaHttpClient } from './adapters/clients/media-http.client.js';
import { OUTBOX_PRODUCER } from './adapters/messaging/media-effects.outbox.js';
import { OutboxRelayService } from './adapters/messaging/outbox-relay.service.js';
import { PrismaAttemptRepository } from './adapters/persistence/prisma-attempt.repository.js';
import { PrismaCourseRepository } from './adapters/persistence/prisma-course.repository.js';
import {
  PrismaEnrollmentRepository,
  PrismaProgressRepository,
} from './adapters/persistence/prisma-learning.repository.js';
import { PrismaLessonRepository } from './adapters/persistence/prisma-lesson.repository.js';
import { PrismaQuizRepository } from './adapters/persistence/prisma-quiz.repository.js';
import { PrismaService } from './adapters/persistence/prisma.service.js';
import {
  ATTEMPT_REPOSITORY,
  type AttemptRepository,
} from './application/ports/attempt-repository.js';
import { MediaUsageEffects } from './application/media-usage-effects.js';
import { MEDIA_USAGE_LOOKUP, type MediaUsageLookup } from './application/ports/media-effects.js';
import { COURSE_REPOSITORY, type CourseRepository } from './application/ports/course-repository.js';
import {
  ENROLLMENT_REPOSITORY,
  type EnrollmentRepository,
  PROGRESS_REPOSITORY,
  type ProgressRepository,
} from './application/ports/learning-repository.js';
import { LESSON_REPOSITORY, type LessonRepository } from './application/ports/lesson-repository.js';
import { QUIZ_REPOSITORY, type QuizRepository } from './application/ports/quiz-repository.js';
import { CLOCK, ID_GENERATOR } from './application/runtime.js';
import { CreateCourseUseCase } from './application/use-cases/courses/create-course.use-case.js';
import { DeleteCourseUseCase } from './application/use-cases/courses/delete-course.use-case.js';
import { ExportCoursesCsvUseCase } from './application/use-cases/courses/export-courses-csv.use-case.js';
import { GetCourseSummaryUseCase } from './application/use-cases/courses/get-course-summary.use-case.js';
import { GetCourseUseCase } from './application/use-cases/courses/get-course.use-case.js';
import { ListCoursesUseCase } from './application/use-cases/courses/list-courses.use-case.js';
import { UpdateCourseUseCase } from './application/use-cases/courses/update-course.use-case.js';
import { EnrollCourseUseCase } from './application/use-cases/learning/enroll-course.use-case.js';
import { GetEnrolledCourseUseCase } from './application/use-cases/learning/get-enrolled-course.use-case.js';
import { GetMyCourseProgressUseCase } from './application/use-cases/learning/get-my-course-progress.use-case.js';
import { ListMyEnrollmentsUseCase } from './application/use-cases/learning/list-my-enrollments.use-case.js';
import { UpdateLessonProgressUseCase } from './application/use-cases/learning/update-lesson-progress.use-case.js';
import { CreateLessonUseCase } from './application/use-cases/lessons/create-lesson.use-case.js';
import { DeleteLessonUseCase } from './application/use-cases/lessons/delete-lesson.use-case.js';
import { GetLessonUseCase } from './application/use-cases/lessons/get-lesson.use-case.js';
import { ReorderLessonsUseCase } from './application/use-cases/lessons/reorder-lessons.use-case.js';
import { UpdateLessonUseCase } from './application/use-cases/lessons/update-lesson.use-case.js';
import { CreateQuizUseCase } from './application/use-cases/quizzes/create-quiz.use-case.js';
import { DeleteQuizUseCase } from './application/use-cases/quizzes/delete-quiz.use-case.js';
import { GetQuizUseCase } from './application/use-cases/quizzes/get-quiz.use-case.js';
import { ListLessonQuizzesUseCase } from './application/use-cases/quizzes/list-lesson-quizzes.use-case.js';
import { UpdateQuizUseCase } from './application/use-cases/quizzes/update-quiz.use-case.js';
import { GetMyAttemptUseCase } from './application/use-cases/student-quizzes/get-my-attempt.use-case.js';
import { GetStudentQuizUseCase } from './application/use-cases/student-quizzes/get-student-quiz.use-case.js';
import { ListMyAttemptsUseCase } from './application/use-cases/student-quizzes/list-my-attempts.use-case.js';
import { ListStudentLessonQuizzesUseCase } from './application/use-cases/student-quizzes/list-student-lesson-quizzes.use-case.js';
import { SaveAttemptAnswersUseCase } from './application/use-cases/student-quizzes/save-attempt-answers.use-case.js';
import { StartQuizAttemptUseCase } from './application/use-cases/student-quizzes/start-quiz-attempt.use-case.js';
import { SubmitQuizAttemptUseCase } from './application/use-cases/student-quizzes/submit-quiz-attempt.use-case.js';
import { QuizGrader } from './domain/quiz-grader.js';
import { COURSE_SERVICE_NAME } from './config/app-config.js';
import { validateEnvironment } from './config/env.schema.js';

/**
 * Mỗi use case là một class trong `application/use-cases/<area>/<verb-noun>.use-case.ts`, được
 * đăng ký bằng provider factory (use case không import Nest) và gọi từ controller mỏng. DTO
 * request/response là zod schema trong `lms/contracts/src/http/`; controller trả DTO hoặc
 * `Page<Dto>`, envelope do `ResponseEnvelopeInterceptor` bọc.
 */
const uuidGenerator: IdGenerator = { next: () => randomUUID() };

/** Dựng tác động `media` cho use case: lookup usage đi qua HTTP nội bộ tới `media`. */
const MEDIA_EFFECTS = Symbol('MEDIA_EFFECTS');

const REPOSITORIES: Provider[] = [
  PrismaCourseRepository,
  PrismaLessonRepository,
  PrismaQuizRepository,
  PrismaEnrollmentRepository,
  PrismaProgressRepository,
  PrismaAttemptRepository,
  { provide: COURSE_REPOSITORY, useExisting: PrismaCourseRepository },
  { provide: LESSON_REPOSITORY, useExisting: PrismaLessonRepository },
  { provide: QUIZ_REPOSITORY, useExisting: PrismaQuizRepository },
  { provide: ENROLLMENT_REPOSITORY, useExisting: PrismaEnrollmentRepository },
  { provide: PROGRESS_REPOSITORY, useExisting: PrismaProgressRepository },
  { provide: ATTEMPT_REPOSITORY, useExisting: PrismaAttemptRepository },
  { provide: MEDIA_USAGE_LOOKUP, useExisting: MediaHttpClient },
  {
    provide: MEDIA_EFFECTS,
    useFactory: (lookup: MediaUsageLookup) => new MediaUsageEffects(lookup),
    inject: [MEDIA_USAGE_LOOKUP],
  },
  { provide: CLOCK, useValue: systemClock },
  { provide: ID_GENERATOR, useValue: uuidGenerator },
  { provide: QuizGrader, useValue: new QuizGrader() },
];

const USE_CASES: Provider[] = [
  // courses
  {
    provide: CreateCourseUseCase,
    useFactory: (courses: CourseRepository, ids: IdGenerator, media: MediaUsageEffects) =>
      new CreateCourseUseCase(courses, ids, media),
    inject: [COURSE_REPOSITORY, ID_GENERATOR, MEDIA_EFFECTS],
  },
  {
    provide: UpdateCourseUseCase,
    useFactory: (courses: CourseRepository, media: MediaUsageEffects) =>
      new UpdateCourseUseCase(courses, media),
    inject: [COURSE_REPOSITORY, MEDIA_EFFECTS],
  },
  {
    provide: DeleteCourseUseCase,
    useFactory: (
      courses: CourseRepository,
      lessons: LessonRepository,
      quizzes: QuizRepository,
      media: MediaUsageEffects,
    ) => new DeleteCourseUseCase(courses, lessons, quizzes, media),
    inject: [COURSE_REPOSITORY, LESSON_REPOSITORY, QUIZ_REPOSITORY, MEDIA_EFFECTS],
  },
  ...[ListCoursesUseCase, GetCourseSummaryUseCase, ExportCoursesCsvUseCase].map((useCase) => ({
    provide: useCase,
    useFactory: (courses: CourseRepository) => new useCase(courses),
    inject: [COURSE_REPOSITORY],
  })),
  {
    provide: GetCourseUseCase,
    useFactory: (courses: CourseRepository, lessons: LessonRepository) =>
      new GetCourseUseCase(courses, lessons),
    inject: [COURSE_REPOSITORY, LESSON_REPOSITORY],
  },
  // lessons
  {
    provide: CreateLessonUseCase,
    useFactory: (
      courses: CourseRepository,
      lessons: LessonRepository,
      ids: IdGenerator,
      media: MediaUsageEffects,
    ) => new CreateLessonUseCase(courses, lessons, ids, media),
    inject: [COURSE_REPOSITORY, LESSON_REPOSITORY, ID_GENERATOR, MEDIA_EFFECTS],
  },
  {
    provide: UpdateLessonUseCase,
    useFactory: (courses: CourseRepository, lessons: LessonRepository, media: MediaUsageEffects) =>
      new UpdateLessonUseCase(courses, lessons, media),
    inject: [COURSE_REPOSITORY, LESSON_REPOSITORY, MEDIA_EFFECTS],
  },
  {
    provide: DeleteLessonUseCase,
    useFactory: (
      courses: CourseRepository,
      lessons: LessonRepository,
      quizzes: QuizRepository,
      media: MediaUsageEffects,
    ) => new DeleteLessonUseCase(courses, lessons, quizzes, media),
    inject: [COURSE_REPOSITORY, LESSON_REPOSITORY, QUIZ_REPOSITORY, MEDIA_EFFECTS],
  },
  ...[GetLessonUseCase, ReorderLessonsUseCase].map((useCase) => ({
    provide: useCase,
    useFactory: (courses: CourseRepository, lessons: LessonRepository) =>
      new useCase(courses, lessons),
    inject: [COURSE_REPOSITORY, LESSON_REPOSITORY],
  })),
  // quizzes
  ...[CreateQuizUseCase, UpdateQuizUseCase].map((useCase) => ({
    provide: useCase,
    useFactory: (
      courses: CourseRepository,
      lessons: LessonRepository,
      quizzes: QuizRepository,
      ids: IdGenerator,
      media: MediaUsageEffects,
    ) => new useCase(courses, lessons, quizzes, ids, media),
    inject: [COURSE_REPOSITORY, LESSON_REPOSITORY, QUIZ_REPOSITORY, ID_GENERATOR, MEDIA_EFFECTS],
  })),
  {
    provide: DeleteQuizUseCase,
    useFactory: (
      courses: CourseRepository,
      lessons: LessonRepository,
      quizzes: QuizRepository,
      media: MediaUsageEffects,
    ) => new DeleteQuizUseCase(courses, lessons, quizzes, media),
    inject: [COURSE_REPOSITORY, LESSON_REPOSITORY, QUIZ_REPOSITORY, MEDIA_EFFECTS],
  },
  ...[GetQuizUseCase, ListLessonQuizzesUseCase].map((useCase) => ({
    provide: useCase,
    useFactory: (courses: CourseRepository, lessons: LessonRepository, quizzes: QuizRepository) =>
      new useCase(courses, lessons, quizzes),
    inject: [COURSE_REPOSITORY, LESSON_REPOSITORY, QUIZ_REPOSITORY],
  })),
  // learning
  {
    provide: EnrollCourseUseCase,
    useFactory: (courses: CourseRepository, enrollments: EnrollmentRepository, ids: IdGenerator) =>
      new EnrollCourseUseCase(courses, enrollments, ids),
    inject: [COURSE_REPOSITORY, ENROLLMENT_REPOSITORY, ID_GENERATOR],
  },
  {
    provide: ListMyEnrollmentsUseCase,
    useFactory: (enrollments: EnrollmentRepository) => new ListMyEnrollmentsUseCase(enrollments),
    inject: [ENROLLMENT_REPOSITORY],
  },
  {
    provide: GetEnrolledCourseUseCase,
    useFactory: (
      courses: CourseRepository,
      lessons: LessonRepository,
      enrollments: EnrollmentRepository,
    ) => new GetEnrolledCourseUseCase(courses, lessons, enrollments),
    inject: [COURSE_REPOSITORY, LESSON_REPOSITORY, ENROLLMENT_REPOSITORY],
  },
  {
    provide: UpdateLessonProgressUseCase,
    useFactory: (
      lessons: LessonRepository,
      enrollments: EnrollmentRepository,
      progress: ProgressRepository,
      ids: IdGenerator,
      clock: Clock,
    ) => new UpdateLessonProgressUseCase(lessons, enrollments, progress, ids, clock),
    inject: [LESSON_REPOSITORY, ENROLLMENT_REPOSITORY, PROGRESS_REPOSITORY, ID_GENERATOR, CLOCK],
  },
  {
    provide: GetMyCourseProgressUseCase,
    useFactory: (
      lessons: LessonRepository,
      enrollments: EnrollmentRepository,
      progress: ProgressRepository,
    ) => new GetMyCourseProgressUseCase(lessons, enrollments, progress),
    inject: [LESSON_REPOSITORY, ENROLLMENT_REPOSITORY, PROGRESS_REPOSITORY],
  },
  // student quizzes
  {
    provide: ListStudentLessonQuizzesUseCase,
    useFactory: (
      lessons: LessonRepository,
      enrollments: EnrollmentRepository,
      quizzes: QuizRepository,
    ) => new ListStudentLessonQuizzesUseCase(lessons, enrollments, quizzes),
    inject: [LESSON_REPOSITORY, ENROLLMENT_REPOSITORY, QUIZ_REPOSITORY],
  },
  {
    provide: GetStudentQuizUseCase,
    useFactory: (
      quizzes: QuizRepository,
      lessons: LessonRepository,
      enrollments: EnrollmentRepository,
    ) => new GetStudentQuizUseCase(quizzes, lessons, enrollments),
    inject: [QUIZ_REPOSITORY, LESSON_REPOSITORY, ENROLLMENT_REPOSITORY],
  },
  {
    provide: StartQuizAttemptUseCase,
    useFactory: (
      quizzes: QuizRepository,
      lessons: LessonRepository,
      enrollments: EnrollmentRepository,
      attempts: AttemptRepository,
      ids: IdGenerator,
      clock: Clock,
    ) => new StartQuizAttemptUseCase(quizzes, lessons, enrollments, attempts, ids, clock),
    inject: [
      QUIZ_REPOSITORY,
      LESSON_REPOSITORY,
      ENROLLMENT_REPOSITORY,
      ATTEMPT_REPOSITORY,
      ID_GENERATOR,
      CLOCK,
    ],
  },
  {
    provide: ListMyAttemptsUseCase,
    useFactory: (
      quizzes: QuizRepository,
      lessons: LessonRepository,
      enrollments: EnrollmentRepository,
      attempts: AttemptRepository,
    ) => new ListMyAttemptsUseCase(quizzes, lessons, enrollments, attempts),
    inject: [QUIZ_REPOSITORY, LESSON_REPOSITORY, ENROLLMENT_REPOSITORY, ATTEMPT_REPOSITORY],
  },
  ...[SaveAttemptAnswersUseCase, GetMyAttemptUseCase].map((useCase) => ({
    provide: useCase,
    useFactory: (attempts: AttemptRepository, quizzes: QuizRepository) =>
      new useCase(attempts, quizzes),
    inject: [ATTEMPT_REPOSITORY, QUIZ_REPOSITORY],
  })),
  {
    provide: SubmitQuizAttemptUseCase,
    useFactory: (
      attempts: AttemptRepository,
      quizzes: QuizRepository,
      grader: QuizGrader,
      clock: Clock,
    ) => new SubmitQuizAttemptUseCase(attempts, quizzes, grader, clock),
    inject: [ATTEMPT_REPOSITORY, QUIZ_REPOSITORY, QuizGrader, CLOCK],
  },
];

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment })],
  controllers: [
    HealthController,
    CourseController,
    LessonController,
    QuizController,
    StudentLearningController,
  ],
  providers: [
    PrismaService,
    MediaHttpClient,
    OutboxRelayService,
    ...COMMON_HTTP_PROVIDERS,
    {
      provide: OUTBOX_PRODUCER,
      useFactory: (config: ConfigService) => ({
        serviceName: COURSE_SERVICE_NAME,
        serviceVersion: config.getOrThrow<string>('OTEL_SERVICE_VERSION'),
      }),
      inject: [ConfigService],
    },
    {
      provide: SERVICE_TOKEN_PROVIDER,
      useFactory: (config: ConfigService): TokenProvider =>
        new ServiceTokenProvider(
          new HttpServiceTokenSource({
            dependency: 'course-auth-token',
            baseUrl: config.getOrThrow<string>('AUTH_BASE_URL'),
            clientId: config.getOrThrow<string>('SERVICE_CLIENT_ID'),
            clientSecret: config.getOrThrow<string>('SERVICE_CLIENT_SECRET'),
            timeoutMs: config.getOrThrow<number>('AUTH_TOKEN_TIMEOUT_MS'),
            breaker: {
              failureThreshold: config.getOrThrow<number>('AUTH_TOKEN_BREAKER_THRESHOLD'),
              cooldownMs: config.getOrThrow<number>('AUTH_TOKEN_BREAKER_COOLDOWN_MS'),
            },
          }),
        ),
      inject: [ConfigService],
    },
    {
      provide: SERVICE_AUTH,
      useFactory: (config: ConfigService) =>
        createHttpServiceAuth(COURSE_SERVICE_NAME, {
          baseUrl: config.getOrThrow<string>('AUTH_BASE_URL'),
          timeoutMs: config.getOrThrow<number>('AUTH_JWKS_TIMEOUT_MS'),
          cacheTtlMs: config.getOrThrow<number>('AUTH_JWKS_CACHE_TTL_MS'),
          minRefetchIntervalMs: config.getOrThrow<number>('AUTH_JWKS_MIN_REFETCH_MS'),
        }),
      inject: [ConfigService],
    },
    {
      provide: READINESS_CHECKS,
      useFactory: (prisma: PrismaService) => ({ postgres: () => prisma.ping() }),
      inject: [PrismaService],
    },
    ...REPOSITORIES,
    ...USE_CASES,
  ],
})
export class AppModule {}

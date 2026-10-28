import type { Clock, IdGenerator, Principal } from '@aiops-lms/common/ports';

import type {
  AttemptRepository,
  AttemptResult,
  NewAttempt,
} from '../../src/application/ports/attempt-repository.js';
import type {
  CourseCounts,
  CourseFilter,
  CoursePatch,
  CourseRepository,
  NewCourse,
} from '../../src/application/ports/course-repository.js';
import type {
  EnrollmentRepository,
  NewEnrollment,
  ProgressRepository,
  ProgressUpdate,
} from '../../src/application/ports/learning-repository.js';
import type {
  LessonPatch,
  LessonRepository,
  NewLesson,
} from '../../src/application/ports/lesson-repository.js';
import type {
  NewQuiz,
  QuizPatch,
  QuizRepository,
} from '../../src/application/ports/quiz-repository.js';
import type {
  AttemptAnswer,
  Course,
  Enrollment,
  Lesson,
  LessonProgress,
  Quiz,
  QuizAttempt,
  QuizSummary,
} from '../../src/domain/course.js';

export const NOW = new Date('2026-11-02T08:00:00.000Z');
export const clock: Clock = { now: () => NOW };

/** Id tuần tự dạng UUID để assertion đọc được. */
export function sequentialIds(): IdGenerator {
  let counter = 0;
  return {
    next: () => {
      counter += 1;
      return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
    },
  };
}

export const principals = {
  admin: { id: 'a0000000-0000-4000-8000-000000000001', role: 'admin' } satisfies Principal,
  owner: { id: 'b0000000-0000-4000-8000-000000000001', role: 'instructor' } satisfies Principal,
  otherInstructor: {
    id: 'b0000000-0000-4000-8000-000000000002',
    role: 'instructor',
  } satisfies Principal,
  student: { id: 'c0000000-0000-4000-8000-000000000001', role: 'student' } satisfies Principal,
  otherStudent: { id: 'c0000000-0000-4000-8000-000000000002', role: 'student' } satisfies Principal,
};

function page<T>(all: T[], pageNumber: number, pageSize: number): { items: T[]; total: number } {
  return {
    items: all.slice((pageNumber - 1) * pageSize, pageNumber * pageSize),
    total: all.length,
  };
}

export class InMemoryCourses implements CourseRepository {
  readonly rows = new Map<string, Course>();

  create(course: NewCourse): Promise<Course> {
    const row: Course = { ...course, status: 'DRAFT', createdAt: NOW, updatedAt: NOW };
    this.rows.set(row.id, row);
    return Promise.resolve(row);
  }

  findById(id: string): Promise<Course | null> {
    return Promise.resolve(this.rows.get(id) ?? null);
  }

  update(id: string, patch: CoursePatch): Promise<Course | null> {
    const current = this.rows.get(id);
    if (!current) return Promise.resolve(null);
    const next: Course = {
      ...current,
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.descriptionMarkdown !== undefined
        ? { descriptionMarkdown: patch.descriptionMarkdown }
        : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
    };
    this.rows.set(id, next);
    return Promise.resolve(next);
  }

  delete(id: string): Promise<boolean> {
    return Promise.resolve(this.rows.delete(id));
  }

  private matching(filter: CourseFilter): Course[] {
    return [...this.rows.values()]
      .filter((course) => !filter.status || course.status === filter.status)
      .filter((course) => !filter.instructorId || course.instructorId === filter.instructorId)
      .filter(
        (course) =>
          !filter.search || course.name.toLowerCase().includes(filter.search.toLowerCase()),
      );
  }

  list(
    filter: CourseFilter,
    pageNumber: number,
    pageSize: number,
  ): Promise<{ items: Course[]; total: number }> {
    return Promise.resolve(page(this.matching(filter), pageNumber, pageSize));
  }

  count(filter: CourseFilter): Promise<CourseCounts> {
    const all = this.matching(filter);
    const by = (status: string): number => all.filter((course) => course.status === status).length;
    return Promise.resolve({
      total: all.length,
      draft: by('DRAFT'),
      published: by('PUBLISHED'),
      archived: by('ARCHIVED'),
    });
  }

  listAfter(filter: CourseFilter, afterId: string | null, limit: number): Promise<Course[]> {
    return Promise.resolve(
      this.matching(filter)
        .sort((left, right) => left.id.localeCompare(right.id))
        .filter((course) => afterId === null || course.id > afterId)
        .slice(0, limit),
    );
  }
}

export class InMemoryLessons implements LessonRepository {
  readonly rows = new Map<string, Lesson>();

  create(lesson: NewLesson): Promise<Lesson | null> {
    const siblings = [...this.rows.values()].filter((row) => row.courseId === lesson.courseId);
    const displayOrder =
      lesson.displayOrder ?? Math.max(0, ...siblings.map((row) => row.displayOrder)) + 1;
    if (siblings.some((row) => row.displayOrder === displayOrder)) return Promise.resolve(null);
    const row: Lesson = {
      id: lesson.id,
      courseId: lesson.courseId,
      title: lesson.title,
      contentMarkdown: lesson.contentMarkdown,
      displayOrder,
      createdAt: NOW,
      updatedAt: NOW,
    };
    this.rows.set(row.id, row);
    return Promise.resolve(row);
  }

  findInCourse(courseId: string, lessonId: string): Promise<Lesson | null> {
    const row = this.rows.get(lessonId);
    return Promise.resolve(row && row.courseId === courseId ? row : null);
  }

  findById(lessonId: string): Promise<Lesson | null> {
    return Promise.resolve(this.rows.get(lessonId) ?? null);
  }

  listByCourse(courseId: string): Promise<Lesson[]> {
    return Promise.resolve(
      [...this.rows.values()]
        .filter((row) => row.courseId === courseId)
        .sort((left, right) => left.displayOrder - right.displayOrder),
    );
  }

  update(lessonId: string, patch: LessonPatch): Promise<Lesson | null> {
    const current = this.rows.get(lessonId);
    if (!current) return Promise.resolve(null);
    const next: Lesson = {
      ...current,
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.contentMarkdown !== undefined ? { contentMarkdown: patch.contentMarkdown } : {}),
    };
    this.rows.set(lessonId, next);
    return Promise.resolve(next);
  }

  delete(lessonId: string): Promise<boolean> {
    return Promise.resolve(this.rows.delete(lessonId));
  }

  async reorder(courseId: string, orderedIds: readonly string[]): Promise<Lesson[]> {
    orderedIds.forEach((id, index) => {
      const row = this.rows.get(id);
      if (row) this.rows.set(id, { ...row, displayOrder: index + 1 });
    });
    return this.listByCourse(courseId);
  }
}

export class InMemoryQuizzes implements QuizRepository {
  readonly rows = new Map<string, Quiz>();
  readonly attemptedQuizIds = new Set<string>();

  create(quiz: NewQuiz): Promise<Quiz | null> {
    const siblings = [...this.rows.values()].filter((row) => row.lessonId === quiz.lessonId);
    const row: Quiz = {
      id: quiz.id,
      lessonId: quiz.lessonId,
      title: quiz.title,
      descriptionMarkdown: quiz.descriptionMarkdown,
      displayOrder: Math.max(0, ...siblings.map((sibling) => sibling.displayOrder)) + 1,
      status: 'DRAFT',
      createdAt: NOW,
      updatedAt: NOW,
      questions: quiz.questions,
    };
    this.rows.set(row.id, row);
    return Promise.resolve(row);
  }

  findInLesson(lessonId: string, quizId: string): Promise<Quiz | null> {
    const row = this.rows.get(quizId);
    return Promise.resolve(row && row.lessonId === lessonId ? row : null);
  }

  findById(quizId: string): Promise<Quiz | null> {
    return Promise.resolve(this.rows.get(quizId) ?? null);
  }

  listByLesson(lessonId: string, publishedOnly: boolean): Promise<QuizSummary[]> {
    return Promise.resolve(
      [...this.rows.values()]
        .filter((row) => row.lessonId === lessonId)
        .filter((row) => !publishedOnly || row.status === 'PUBLISHED')
        .map(({ questions, ...summary }) => ({ ...summary, questionCount: questions.length })),
    );
  }

  update(quizId: string, patch: QuizPatch): Promise<Quiz | null> {
    const current = this.rows.get(quizId);
    if (!current) return Promise.resolve(null);
    const next: Quiz = {
      ...current,
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.descriptionMarkdown !== undefined
        ? { descriptionMarkdown: patch.descriptionMarkdown }
        : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.questions !== undefined ? { questions: patch.questions } : {}),
    };
    this.rows.set(quizId, next);
    return Promise.resolve(next);
  }

  delete(quizId: string): Promise<boolean> {
    return Promise.resolve(this.rows.delete(quizId));
  }

  hasAttempts(quizId: string): Promise<boolean> {
    return Promise.resolve(this.attemptedQuizIds.has(quizId));
  }
}

export class InMemoryEnrollments implements EnrollmentRepository {
  readonly rows: Enrollment[] = [];

  create(enrollment: NewEnrollment): Promise<Enrollment | null> {
    if (
      this.rows.some(
        (row) => row.courseId === enrollment.courseId && row.studentId === enrollment.studentId,
      )
    ) {
      return Promise.resolve(null);
    }
    const row: Enrollment = { ...enrollment, enrolledAt: NOW };
    this.rows.push(row);
    return Promise.resolve(row);
  }

  find(courseId: string, studentId: string): Promise<Enrollment | null> {
    return Promise.resolve(
      this.rows.find((row) => row.courseId === courseId && row.studentId === studentId) ?? null,
    );
  }

  listByStudent(
    studentId: string,
    pageNumber: number,
    pageSize: number,
  ): Promise<{ items: Enrollment[]; total: number }> {
    return Promise.resolve(
      page(
        this.rows.filter((row) => row.studentId === studentId),
        pageNumber,
        pageSize,
      ),
    );
  }
}

export class InMemoryProgress implements ProgressRepository {
  readonly rows: LessonProgress[] = [];

  constructor(private readonly lessons: InMemoryLessons) {}

  upsert(update: ProgressUpdate): Promise<LessonProgress> {
    const index = this.rows.findIndex(
      (row) => row.lessonId === update.lessonId && row.studentId === update.studentId,
    );
    const existing = this.rows[index];
    const progressPercent = Math.max(existing?.progressPercent ?? 0, update.progressPercent);
    const row: LessonProgress = {
      lessonId: update.lessonId,
      studentId: update.studentId,
      progressPercent,
      completedAt: existing?.completedAt ?? (progressPercent >= 100 ? update.now : null),
      updatedAt: update.now,
    };
    if (index >= 0) this.rows[index] = row;
    else this.rows.push(row);
    return Promise.resolve(row);
  }

  listByCourse(studentId: string, courseId: string): Promise<LessonProgress[]> {
    return Promise.resolve(
      this.rows.filter(
        (row) =>
          row.studentId === studentId && this.lessons.rows.get(row.lessonId)?.courseId === courseId,
      ),
    );
  }
}

export class InMemoryAttempts implements AttemptRepository {
  readonly rows = new Map<string, QuizAttempt>();

  constructor(private readonly quizzes: InMemoryQuizzes) {}

  findInProgress(quizId: string, studentId: string): Promise<QuizAttempt | null> {
    return Promise.resolve(
      [...this.rows.values()].find(
        (row) =>
          row.quizId === quizId && row.studentId === studentId && row.status === 'IN_PROGRESS',
      ) ?? null,
    );
  }

  async create(attempt: NewAttempt): Promise<QuizAttempt | null> {
    if (await this.findInProgress(attempt.quizId, attempt.studentId)) return null;
    const row: QuizAttempt = {
      ...attempt,
      status: 'IN_PROGRESS',
      submittedAt: null,
      score: null,
      maxScore: null,
      answers: [],
    };
    this.rows.set(row.id, row);
    this.quizzes.attemptedQuizIds.add(row.quizId);
    return row;
  }

  findById(attemptId: string): Promise<QuizAttempt | null> {
    return Promise.resolve(this.rows.get(attemptId) ?? null);
  }

  replaceAnswers(
    attemptId: string,
    answers: readonly AttemptAnswer[],
  ): Promise<QuizAttempt | null> {
    const current = this.rows.get(attemptId);
    if (!current || current.status !== 'IN_PROGRESS') return Promise.resolve(null);
    const next = { ...current, answers: [...answers] };
    this.rows.set(attemptId, next);
    return Promise.resolve(next);
  }

  submit(attemptId: string, result: AttemptResult): Promise<QuizAttempt | null> {
    const current = this.rows.get(attemptId);
    if (!current || current.status !== 'IN_PROGRESS') return Promise.resolve(null);
    const next: QuizAttempt = { ...current, status: 'SUBMITTED', ...result };
    this.rows.set(attemptId, next);
    return Promise.resolve(next);
  }

  listByQuiz(
    quizId: string,
    studentId: string,
    pageNumber: number,
    pageSize: number,
  ): Promise<{ items: QuizAttempt[]; total: number }> {
    return Promise.resolve(
      page(
        [...this.rows.values()].filter(
          (row) => row.quizId === quizId && row.studentId === studentId,
        ),
        pageNumber,
        pageSize,
      ),
    );
  }
}

/** Bộ repository in-memory dùng chung giữa các use case của một test. */
export function createWorld(): {
  ids: IdGenerator;
  courses: InMemoryCourses;
  lessons: InMemoryLessons;
  quizzes: InMemoryQuizzes;
  enrollments: InMemoryEnrollments;
  progress: InMemoryProgress;
  attempts: InMemoryAttempts;
} {
  const lessons = new InMemoryLessons();
  const quizzes = new InMemoryQuizzes();
  return {
    ids: sequentialIds(),
    courses: new InMemoryCourses(),
    lessons,
    quizzes,
    enrollments: new InMemoryEnrollments(),
    progress: new InMemoryProgress(lessons),
    attempts: new InMemoryAttempts(quizzes),
  };
}

import type { Principal } from '@aiops-lms/common/ports';

import type { QuizSummary } from '../../../domain/course.js';
import { loadManagedLesson } from '../../course-access.js';
import type { CourseRepository } from '../../ports/course-repository.js';
import type { LessonRepository } from '../../ports/lesson-repository.js';
import type { QuizRepository } from '../../ports/quiz-repository.js';

export class ListLessonQuizzesUseCase {
  constructor(
    private readonly courses: CourseRepository,
    private readonly lessons: LessonRepository,
    private readonly quizzes: QuizRepository,
  ) {}

  /** Mọi quiz của bài học (cả `DRAFT`), dành cho người quản lý khóa học. */
  async execute(principal: Principal, courseId: string, lessonId: string): Promise<QuizSummary[]> {
    await loadManagedLesson(this.courses, this.lessons, principal, courseId, lessonId);
    return this.quizzes.listByLesson(lessonId, false);
  }
}

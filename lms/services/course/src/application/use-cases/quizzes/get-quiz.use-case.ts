import type { Principal } from '@aiops-lms/common/ports';

import type { Quiz } from '../../../domain/course.js';
import { loadManagedQuiz } from '../../course-access.js';
import type { CourseRepository } from '../../ports/course-repository.js';
import type { LessonRepository } from '../../ports/lesson-repository.js';
import type { QuizRepository } from '../../ports/quiz-repository.js';

export class GetQuizUseCase {
  constructor(
    private readonly courses: CourseRepository,
    private readonly lessons: LessonRepository,
    private readonly quizzes: QuizRepository,
  ) {}

  /** Quiz đầy đủ kèm đáp án đúng, dành cho người quản lý khóa học. */
  execute(
    principal: Principal,
    ref: { courseId: string; lessonId: string; quizId: string },
  ): Promise<Quiz> {
    return loadManagedQuiz(this.courses, this.lessons, this.quizzes, principal, ref);
  }
}

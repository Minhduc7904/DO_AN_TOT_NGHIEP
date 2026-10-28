import type { Principal } from '@aiops-lms/common/ports';

import { courseErrors } from '../../../domain/errors.js';
import { loadManagedQuiz } from '../../course-access.js';
import { MediaUsageEffects } from '../../media-usage-effects.js';
import type { CourseRepository } from '../../ports/course-repository.js';
import type { LessonRepository } from '../../ports/lesson-repository.js';
import type { QuizRepository } from '../../ports/quiz-repository.js';

export class DeleteQuizUseCase {
  constructor(
    private readonly courses: CourseRepository,
    private readonly lessons: LessonRepository,
    private readonly quizzes: QuizRepository,
    private readonly media: MediaUsageEffects = new MediaUsageEffects(),
  ) {}

  async execute(
    principal: Principal,
    ref: { courseId: string; lessonId: string; quizId: string },
  ): Promise<void> {
    const quiz = await loadManagedQuiz(this.courses, this.lessons, this.quizzes, principal, ref);
    if (await this.quizzes.hasAttempts(quiz.id)) throw courseErrors.quizHasAttempts();
    await this.quizzes.delete(quiz.id, await this.media.deleteUsagesOf([quiz.id]));
  }
}

import type { Principal } from '@aiops-lms/common/ports';

import { loadManagedLesson } from '../../course-access.js';
import { MediaUsageEffects } from '../../media-usage-effects.js';
import type { CourseRepository } from '../../ports/course-repository.js';
import type { LessonRepository } from '../../ports/lesson-repository.js';
import type { QuizRepository } from '../../ports/quiz-repository.js';

export class DeleteLessonUseCase {
  constructor(
    private readonly courses: CourseRepository,
    private readonly lessons: LessonRepository,
    private readonly quizzes?: QuizRepository,
    private readonly media: MediaUsageEffects = new MediaUsageEffects(),
  ) {}

  /**
   * Xóa kéo theo quiz và tiến độ của bài học; các bài còn lại giữ nguyên `display_order`. Usage
   * media của bài học và các quiz của nó được gỡ bằng command.
   */
  async execute(principal: Principal, courseId: string, lessonId: string): Promise<void> {
    await loadManagedLesson(this.courses, this.lessons, principal, courseId, lessonId);
    const quizzes = this.quizzes ? await this.quizzes.listByLesson(lessonId, false) : [];
    const effects = await this.media.deleteUsagesOf([lessonId, ...quizzes.map((quiz) => quiz.id)]);
    await this.lessons.delete(lessonId, effects);
  }
}

import type { Principal } from '@aiops-lms/common/ports';

import { loadManagedCourse } from '../../course-access.js';
import { MediaUsageEffects } from '../../media-usage-effects.js';
import type { CourseRepository } from '../../ports/course-repository.js';
import type { LessonRepository } from '../../ports/lesson-repository.js';
import type { QuizRepository } from '../../ports/quiz-repository.js';

export class DeleteCourseUseCase {
  constructor(
    private readonly courses: CourseRepository,
    private readonly lessons?: LessonRepository,
    private readonly quizzes?: QuizRepository,
    private readonly media: MediaUsageEffects = new MediaUsageEffects(),
  ) {}

  /**
   * Xóa kéo theo bài học, quiz, ghi danh và tiến độ của khóa học, đồng thời gửi command xóa usage
   * media của course, lesson và quiz (usage id lấy từ `media` trước khi xóa).
   */
  async execute(principal: Principal, courseId: string): Promise<void> {
    await loadManagedCourse(this.courses, principal, courseId);
    await this.courses.delete(
      courseId,
      await this.media.deleteUsagesOf(await this.ownerIds(courseId)),
    );
  }

  private async ownerIds(courseId: string): Promise<string[]> {
    const owners = [courseId];
    if (!this.lessons || !this.quizzes) return owners;
    for (const lesson of await this.lessons.listByCourse(courseId)) {
      owners.push(lesson.id);
      for (const quiz of await this.quizzes.listByLesson(lesson.id, false)) owners.push(quiz.id);
    }
    return owners;
  }
}

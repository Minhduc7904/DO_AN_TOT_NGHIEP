import type { Principal } from '@aiops-lms/common/ports';

import { loadManagedLesson } from '../../course-access.js';
import type { CourseRepository } from '../../ports/course-repository.js';
import type { LessonRepository } from '../../ports/lesson-repository.js';

export class DeleteLessonUseCase {
  constructor(
    private readonly courses: CourseRepository,
    private readonly lessons: LessonRepository,
  ) {}

  /** Xóa kéo theo quiz và tiến độ của bài học; các bài còn lại giữ nguyên `display_order`. */
  async execute(principal: Principal, courseId: string, lessonId: string): Promise<void> {
    await loadManagedLesson(this.courses, this.lessons, principal, courseId, lessonId);
    await this.lessons.delete(lessonId);
  }
}

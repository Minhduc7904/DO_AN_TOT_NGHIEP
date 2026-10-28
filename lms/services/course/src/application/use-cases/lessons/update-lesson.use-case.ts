import { AppError } from '@aiops-lms/common/errors';
import type { Principal } from '@aiops-lms/common/ports';

import type { Lesson } from '../../../domain/course.js';
import { loadManagedLesson } from '../../course-access.js';
import { MediaUsageEffects } from '../../media-usage-effects.js';
import type { CourseRepository } from '../../ports/course-repository.js';
import type { LessonPatch, LessonRepository } from '../../ports/lesson-repository.js';

export class UpdateLessonUseCase {
  constructor(
    private readonly courses: CourseRepository,
    private readonly lessons: LessonRepository,
    private readonly media: MediaUsageEffects = new MediaUsageEffects(),
  ) {}

  async execute(
    principal: Principal,
    courseId: string,
    lessonId: string,
    patch: LessonPatch,
  ): Promise<Lesson> {
    await loadManagedLesson(this.courses, this.lessons, principal, courseId, lessonId);
    const effects =
      patch.contentMarkdown === undefined
        ? []
        : this.media.syncMarkdown('LESSON_CONTENT', lessonId, patch.contentMarkdown, principal.id);
    const updated = await this.lessons.update(lessonId, patch, effects);
    if (!updated) throw AppError.notFound('Không tìm thấy bài học');
    return updated;
  }
}

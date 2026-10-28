import { AppError } from '@aiops-lms/common/errors';
import type { Principal } from '@aiops-lms/common/ports';

import type { Lesson } from '../../../domain/course.js';
import { loadManagedLesson } from '../../course-access.js';
import type { CourseRepository } from '../../ports/course-repository.js';
import type { LessonPatch, LessonRepository } from '../../ports/lesson-repository.js';

export class UpdateLessonUseCase {
  constructor(
    private readonly courses: CourseRepository,
    private readonly lessons: LessonRepository,
  ) {}

  async execute(
    principal: Principal,
    courseId: string,
    lessonId: string,
    patch: LessonPatch,
  ): Promise<Lesson> {
    await loadManagedLesson(this.courses, this.lessons, principal, courseId, lessonId);
    const updated = await this.lessons.update(lessonId, patch);
    if (!updated) throw AppError.notFound('Không tìm thấy bài học');
    return updated;
  }
}

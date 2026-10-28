import type { Principal } from '@aiops-lms/common/ports';

import { courseErrors } from '../../../domain/errors.js';
import type { Lesson } from '../../../domain/course.js';
import { loadManagedCourse } from '../../course-access.js';
import type { CourseRepository } from '../../ports/course-repository.js';
import type { LessonRepository } from '../../ports/lesson-repository.js';

export class ReorderLessonsUseCase {
  constructor(
    private readonly courses: CourseRepository,
    private readonly lessons: LessonRepository,
  ) {}

  /** `lessonIds` phải là đúng tập bài học hiện có của khóa học (đủ, không trùng, không lạ). */
  async execute(
    principal: Principal,
    courseId: string,
    lessonIds: readonly string[],
  ): Promise<Lesson[]> {
    await loadManagedCourse(this.courses, principal, courseId);
    const current = await this.lessons.listByCourse(courseId);

    const requested = new Set(lessonIds);
    const sameSet =
      requested.size === lessonIds.length &&
      requested.size === current.length &&
      current.every((lesson) => requested.has(lesson.id));
    if (!sameSet) throw courseErrors.lessonOrderConflict();

    return this.lessons.reorder(courseId, lessonIds);
  }
}

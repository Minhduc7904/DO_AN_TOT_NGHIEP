import type { Principal } from '@aiops-lms/common/ports';
import { AppError } from '@aiops-lms/common/errors';

import { loadManagedCourse } from '../../course-access.js';
import type { Course } from '../../../domain/course.js';
import { MediaUsageEffects } from '../../media-usage-effects.js';
import type { CoursePatch, CourseRepository } from '../../ports/course-repository.js';

export class UpdateCourseUseCase {
  constructor(
    private readonly courses: CourseRepository,
    private readonly media: MediaUsageEffects = new MediaUsageEffects(),
  ) {}

  async execute(principal: Principal, courseId: string, patch: CoursePatch): Promise<Course> {
    await loadManagedCourse(this.courses, principal, courseId);
    const effects =
      patch.descriptionMarkdown === undefined
        ? []
        : this.media.syncMarkdown(
            'COURSE_DESCRIPTION',
            courseId,
            patch.descriptionMarkdown,
            principal.id,
          );
    const updated = await this.courses.update(courseId, patch, effects);
    if (!updated) throw AppError.notFound('Không tìm thấy khóa học');
    return updated;
  }
}

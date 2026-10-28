import type { Principal } from '@aiops-lms/common/ports';
import { AppError } from '@aiops-lms/common/errors';

import { loadManagedCourse } from '../../course-access.js';
import type { Course } from '../../../domain/course.js';
import type { CoursePatch, CourseRepository } from '../../ports/course-repository.js';

export class UpdateCourseUseCase {
  constructor(private readonly courses: CourseRepository) {}

  async execute(principal: Principal, courseId: string, patch: CoursePatch): Promise<Course> {
    await loadManagedCourse(this.courses, principal, courseId);
    const updated = await this.courses.update(courseId, patch);
    if (!updated) throw AppError.notFound('Không tìm thấy khóa học');
    return updated;
  }
}

import { AppError } from '@aiops-lms/common/errors';
import type { Principal } from '@aiops-lms/common/ports';

import type { CourseCounts, CourseRepository } from '../../ports/course-repository.js';

export class GetCourseSummaryUseCase {
  constructor(private readonly courses: CourseRepository) {}

  /** Số khóa học theo trạng thái trong phạm vi của người gọi (giảng viên: khóa của mình). */
  execute(principal: Principal): Promise<CourseCounts> {
    if (principal.role === 'student') throw AppError.forbidden();
    return this.courses.count(
      principal.role === 'instructor' ? { instructorId: principal.id } : {},
    );
  }
}

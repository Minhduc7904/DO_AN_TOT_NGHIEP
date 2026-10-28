import type { Principal } from '@aiops-lms/common/ports';

import { loadManagedCourse } from '../../course-access.js';
import type { CourseRepository } from '../../ports/course-repository.js';

export class DeleteCourseUseCase {
  constructor(private readonly courses: CourseRepository) {}

  /** Xóa kéo theo bài học, quiz, ghi danh và tiến độ của khóa học. */
  async execute(principal: Principal, courseId: string): Promise<void> {
    await loadManagedCourse(this.courses, principal, courseId);
    await this.courses.delete(courseId);
  }
}

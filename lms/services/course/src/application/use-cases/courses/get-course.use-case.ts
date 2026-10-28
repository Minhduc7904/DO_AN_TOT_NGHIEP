import { AppError } from '@aiops-lms/common/errors';
import type { Principal } from '@aiops-lms/common/ports';

import { assertCanManageCourse } from '../../../domain/access.js';
import type { Course, Lesson } from '../../../domain/course.js';
import type { CourseRepository } from '../../ports/course-repository.js';
import type { LessonRepository } from '../../ports/lesson-repository.js';

export class GetCourseUseCase {
  constructor(
    private readonly courses: CourseRepository,
    private readonly lessons: LessonRepository,
  ) {}

  /** Học viên chỉ xem được khóa học đã xuất bản; nội dung bài học lấy qua endpoint đã ghi danh. */
  async execute(
    principal: Principal,
    courseId: string,
  ): Promise<{ course: Course; lessons: Lesson[] }> {
    const course = await this.courses.findById(courseId);
    if (!course) throw AppError.notFound('Không tìm thấy khóa học');
    if (principal.role === 'student') {
      if (course.status !== 'PUBLISHED') throw AppError.notFound('Không tìm thấy khóa học');
    } else {
      assertCanManageCourse(principal, course);
    }
    return { course, lessons: await this.lessons.listByCourse(courseId) };
  }
}

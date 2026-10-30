import type { Principal } from '@aiops-lms/common/ports';

import type { Lesson } from '../../../domain/course.js';
import { loadManagedCourse } from '../../course-access.js';
import type { CourseRepository } from '../../ports/course-repository.js';
import type { EnrollmentRepository } from '../../ports/learning-repository.js';
import type { LessonRepository } from '../../ports/lesson-repository.js';
import { assertEnrolled } from '../learning/student-access.js';

export class ListCourseLessonsUseCase {
  constructor(
    private readonly courses: CourseRepository,
    private readonly lessons: LessonRepository,
    private readonly enrollments: EnrollmentRepository,
  ) {}

  /**
   * Bài học của khóa học theo thứ tự hiển thị, kèm nội dung. Học viên phải đã ghi danh (403
   * `STUDENT_NOT_ENROLLED` nếu chưa, kể cả khi khóa không tồn tại để không lộ khóa chưa xuất bản);
   * admin và giảng viên phải được quản lý khóa học.
   */
  async execute(principal: Principal, courseId: string): Promise<Lesson[]> {
    if (principal.role === 'student') {
      await assertEnrolled(this.enrollments, courseId, principal.id);
    } else {
      await loadManagedCourse(this.courses, principal, courseId);
    }
    return this.lessons.listByCourse(courseId);
  }
}

import { AppError } from '@aiops-lms/common/errors';
import type { Principal } from '@aiops-lms/common/ports';

import { assertCanManageCourse } from '../../../domain/access.js';
import type { Course } from '../../../domain/course.js';
import type { CourseRepository } from '../../ports/course-repository.js';
import type { EnrollmentRepository } from '../../ports/learning-repository.js';

/** Trạng thái ghi danh của học viên với khóa học. */
export interface CourseEnrollment {
  status: 'ENROLLED' | 'NOT_ENROLLED';
  enrolledAt: Date | null;
}

export interface CourseView {
  course: Course;
  /** `null` với admin và giảng viên. */
  enrollment: CourseEnrollment | null;
}

export class GetCourseUseCase {
  constructor(
    private readonly courses: CourseRepository,
    private readonly enrollments: EnrollmentRepository,
  ) {}

  /** Bài học không nằm trong kết quả; lấy qua `ListCourseLessonsUseCase`. */
  async execute(principal: Principal, courseId: string): Promise<CourseView> {
    const course = await this.courses.findById(courseId);
    if (!course) throw AppError.notFound('Không tìm thấy khóa học');
    if (principal.role === 'student') return this.viewAsStudent(principal.id, course);
    assertCanManageCourse(principal, course);
    return { course, enrollment: null };
  }

  /**
   * Học viên xem được khóa đã xuất bản hoặc khóa họ đã ghi danh (khóa bị gỡ xuất bản vẫn đọc được
   * bài học nên vẫn hiển thị), kèm trạng thái ghi danh của chính họ.
   */
  private async viewAsStudent(studentId: string, course: Course): Promise<CourseView> {
    const enrollment = await this.enrollments.find(course.id, studentId);
    if (!enrollment) {
      if (course.status !== 'PUBLISHED') throw AppError.notFound('Không tìm thấy khóa học');
      return { course, enrollment: { status: 'NOT_ENROLLED', enrolledAt: null } };
    }
    return { course, enrollment: { status: 'ENROLLED', enrolledAt: enrollment.enrolledAt } };
  }
}

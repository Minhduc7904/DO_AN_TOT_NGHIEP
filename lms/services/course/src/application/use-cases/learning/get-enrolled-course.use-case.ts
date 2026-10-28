import { AppError } from '@aiops-lms/common/errors';

import type { Course, Lesson } from '../../../domain/course.js';
import type { CourseRepository } from '../../ports/course-repository.js';
import type { EnrollmentRepository } from '../../ports/learning-repository.js';
import type { LessonRepository } from '../../ports/lesson-repository.js';
import { assertEnrolled } from './student-access.js';

export class GetEnrolledCourseUseCase {
  constructor(
    private readonly courses: CourseRepository,
    private readonly lessons: LessonRepository,
    private readonly enrollments: EnrollmentRepository,
  ) {}

  /** Khóa học kèm nội dung đầy đủ các bài học; chỉ dành cho học viên đã ghi danh. */
  async execute(
    studentId: string,
    courseId: string,
  ): Promise<{ course: Course; lessons: Lesson[] }> {
    await assertEnrolled(this.enrollments, courseId, studentId);
    const course = await this.courses.findById(courseId);
    if (!course) throw AppError.notFound('Không tìm thấy khóa học');
    return { course, lessons: await this.lessons.listByCourse(courseId) };
  }
}

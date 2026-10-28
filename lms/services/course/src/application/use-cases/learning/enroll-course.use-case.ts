import { AppError } from '@aiops-lms/common/errors';
import type { IdGenerator } from '@aiops-lms/common/ports';

import type { Enrollment } from '../../../domain/course.js';
import { courseErrors } from '../../../domain/errors.js';
import type { CourseRepository } from '../../ports/course-repository.js';
import type { EnrollmentRepository } from '../../ports/learning-repository.js';

export class EnrollCourseUseCase {
  constructor(
    private readonly courses: CourseRepository,
    private readonly enrollments: EnrollmentRepository,
    private readonly ids: IdGenerator,
  ) {}

  async execute(studentId: string, courseId: string): Promise<Enrollment> {
    const course = await this.courses.findById(courseId);
    if (!course) throw AppError.notFound('Không tìm thấy khóa học');
    if (course.status !== 'PUBLISHED') throw courseErrors.courseNotEnrollable();

    const enrollment = await this.enrollments.create({ id: this.ids.next(), courseId, studentId });
    if (!enrollment) throw courseErrors.enrollmentAlreadyExists();
    return enrollment;
  }
}

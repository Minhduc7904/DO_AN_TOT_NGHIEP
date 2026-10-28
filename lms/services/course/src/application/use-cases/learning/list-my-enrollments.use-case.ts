import type { Enrollment } from '../../../domain/course.js';
import type { EnrollmentRepository } from '../../ports/learning-repository.js';

export class ListMyEnrollmentsUseCase {
  constructor(private readonly enrollments: EnrollmentRepository) {}

  execute(
    studentId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: Enrollment[]; total: number }> {
    return this.enrollments.listByStudent(studentId, page, pageSize);
  }
}

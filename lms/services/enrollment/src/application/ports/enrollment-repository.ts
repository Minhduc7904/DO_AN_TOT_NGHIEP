import type { Enrollment } from '../../domain/enrollment.js';

export interface EnrollmentListFilter {
  principalId?: string;
  courseId?: string;
}

export abstract class EnrollmentRepository {
  abstract create(principalId: string, courseId: string): Promise<Enrollment>;
  abstract findByPrincipalAndCourse(
    principalId: string,
    courseId: string,
  ): Promise<Enrollment | null>;
  abstract list(filter: EnrollmentListFilter, limit: number): Promise<Enrollment[]>;
}

import type { Enrollment } from '../domain/enrollment.js';
import { CourseNotFoundError } from './course-not-found-error.js';
import { CourseClient, type CoursePrincipal } from './ports/course-client.js';
import { EnrollmentRepository, type EnrollmentListFilter } from './ports/enrollment-repository.js';

export class EnrollmentService {
  constructor(
    private readonly repository: EnrollmentRepository,
    private readonly courseClient: CourseClient,
  ) {}

  async create(principal: CoursePrincipal, courseId: string): Promise<Enrollment> {
    const courseExists = await this.courseClient.exists(courseId, principal);
    if (!courseExists) throw new CourseNotFoundError(courseId);
    return this.repository.create(principal.id, courseId);
  }

  list(filter: EnrollmentListFilter, limit: number): Promise<Enrollment[]> {
    return this.repository.list(filter, limit);
  }

  async check(principalId: string, courseId: string): Promise<boolean> {
    const found = await this.repository.findByPrincipalAndCourse(principalId, courseId);
    return found !== null;
  }
}

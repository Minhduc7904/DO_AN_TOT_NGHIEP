import { CourseNotFoundError } from '../../src/application/course-not-found-error.js';
import { EnrollmentConflictError } from '../../src/application/enrollment-conflict-error.js';
import { EnrollmentService } from '../../src/application/enrollment.service.js';
import type { CourseClient, CoursePrincipal } from '../../src/application/ports/course-client.js';
import type {
  EnrollmentListFilter,
  EnrollmentRepository,
} from '../../src/application/ports/enrollment-repository.js';
import type { Enrollment } from '../../src/domain/enrollment.js';

describe('EnrollmentService', () => {
  const principal: CoursePrincipal = { id: 'student-001', role: 'student' };
  const seed: Enrollment = {
    course_id: 'course-001',
    created_at: '2026-08-27T10:05:00Z',
    id: 'enrollment-001',
    principal_id: 'student-001',
  };
  let stored: Enrollment[];
  let courseExists: boolean;
  let repository: EnrollmentRepository;
  let courseClient: CourseClient;
  let service: EnrollmentService;

  beforeEach(() => {
    stored = [seed];
    courseExists = true;
    repository = {
      create: async (principalId, courseId) => {
        if (
          stored.some((item) => item.principal_id === principalId && item.course_id === courseId)
        ) {
          throw new EnrollmentConflictError(principalId, courseId);
        }
        const enrollment: Enrollment = {
          course_id: courseId,
          created_at: '2026-09-13T10:00:00Z',
          id: 'enrollment-002',
          principal_id: principalId,
        };
        stored.push(enrollment);
        return enrollment;
      },
      findByPrincipalAndCourse: async (principalId, courseId) =>
        stored.find((item) => item.principal_id === principalId && item.course_id === courseId) ??
        null,
      list: async (filter: EnrollmentListFilter) =>
        stored.filter(
          (item) =>
            (!filter.principalId || item.principal_id === filter.principalId) &&
            (!filter.courseId || item.course_id === filter.courseId),
        ),
    };
    courseClient = {
      exists: async () => courseExists,
    };
    service = new EnrollmentService(repository, courseClient);
  });

  it('creates an enrollment after confirming the course exists', async () => {
    const enrollment = await service.create(principal, 'course-002');
    expect(enrollment).toMatchObject({ course_id: 'course-002', principal_id: 'student-001' });
  });

  it('rejects enrollment when the course does not exist', async () => {
    courseExists = false;
    await expect(service.create(principal, 'missing-course')).rejects.toBeInstanceOf(
      CourseNotFoundError,
    );
  });

  it('propagates a conflict when the principal already enrolled in the course', async () => {
    await expect(service.create(principal, seed.course_id)).rejects.toBeInstanceOf(
      EnrollmentConflictError,
    );
  });

  it('lists enrollments filtered by principal or course', async () => {
    await expect(service.list({ principalId: 'student-001' }, 20)).resolves.toEqual([seed]);
    await expect(service.list({ courseId: 'course-001' }, 20)).resolves.toEqual([seed]);
  });

  it('reports enrolled status for the check contract', async () => {
    await expect(service.check('student-001', 'course-001')).resolves.toBe(true);
    await expect(service.check('student-001', 'missing-course')).resolves.toBe(false);
  });
});

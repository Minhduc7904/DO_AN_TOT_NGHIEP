import { CourseNotFoundError } from '../../src/application/course-not-found-error.js';
import { NotEnrolledError } from '../../src/application/not-enrolled-error.js';
import type {
  CourseClient,
  SubmissionPrincipal,
} from '../../src/application/ports/course-client.js';
import type { EnrollmentClient } from '../../src/application/ports/enrollment-client.js';
import type { StorageClient } from '../../src/application/ports/storage-client.js';
import type {
  CreateSubmissionRecord,
  SubmissionRepository,
} from '../../src/application/ports/submission-repository.js';
import { SubmissionForbiddenError } from '../../src/application/submission-forbidden-error.js';
import { SubmissionNotFoundError } from '../../src/application/submission-not-found-error.js';
import { SubmissionService } from '../../src/application/submission.service.js';
import type { Submission } from '../../src/domain/submission.js';

describe('SubmissionService', () => {
  const student: SubmissionPrincipal = { id: 'student-001', role: 'student' };
  const seed: Submission = {
    course_id: 'course-001',
    id: 'submission-001',
    principal_id: 'student-001',
    storage_object_key: 'submissions/submission-001',
    submitted_at: '2026-08-27T10:10:00.000Z',
  };
  let courseExists: boolean;
  let enrolled: boolean;
  let storedObject: { content: string; key: string } | undefined;
  let rows: Submission[];
  let service: SubmissionService;

  beforeEach(() => {
    courseExists = true;
    enrolled = true;
    rows = [seed];
    storedObject = undefined;
    const repository: SubmissionRepository = {
      create: async (input: CreateSubmissionRecord) => {
        const submission: Submission = {
          course_id: input.courseId,
          id: input.id,
          principal_id: input.principalId,
          storage_object_key: input.storageObjectKey,
          submitted_at: '2026-09-24T00:00:00.000Z',
        };
        rows.push(submission);
        return submission;
      },
      findById: async (id) => rows.find((row) => row.id === id) ?? null,
    };
    const courseClient: CourseClient = { exists: async () => courseExists };
    const enrollmentClient: EnrollmentClient = { isEnrolled: async () => enrolled };
    const storageClient: StorageClient = {
      store: async (key, content) => {
        storedObject = { content, key };
      },
    };
    service = new SubmissionService(repository, courseClient, enrollmentClient, storageClient);
  });

  it('stores the object through the network port before persisting Submission metadata', async () => {
    const submission = await service.create(student, 'course-001', 'answer');
    expect(submission).toMatchObject({ course_id: 'course-001', principal_id: 'student-001' });
    expect(submission.storage_object_key).toBe(`submissions/${submission.id}`);
    expect(storedObject).toEqual({ content: 'answer', key: submission.storage_object_key });
  });

  it('rejects a missing Course before storage or persistence', async () => {
    courseExists = false;
    await expect(service.create(student, 'missing', 'answer')).rejects.toBeInstanceOf(
      CourseNotFoundError,
    );
    expect(storedObject).toBeUndefined();
    expect(rows).toEqual([seed]);
  });

  it('rejects a principal that has not enrolled', async () => {
    enrolled = false;
    await expect(service.create(student, 'course-001', 'answer')).rejects.toBeInstanceOf(
      NotEnrolledError,
    );
    expect(storedObject).toBeUndefined();
  });

  it('allows owner, instructor and internal caller to read, but denies another student', async () => {
    await expect(service.getById(seed.id, student)).resolves.toEqual(seed);
    await expect(
      service.getById(seed.id, { id: 'instructor-001', role: 'instructor' }),
    ).resolves.toEqual(seed);
    await expect(service.getById(seed.id)).resolves.toEqual(seed);
    await expect(
      service.getById(seed.id, { id: 'student-002', role: 'student' }),
    ).rejects.toBeInstanceOf(SubmissionForbiddenError);
    await expect(service.getById('missing')).rejects.toBeInstanceOf(SubmissionNotFoundError);
  });
});

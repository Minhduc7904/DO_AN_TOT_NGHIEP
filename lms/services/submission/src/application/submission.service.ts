import { randomUUID } from 'node:crypto';

import type { Submission } from '../domain/submission.js';
import { CourseNotFoundError } from './course-not-found-error.js';
import { NotEnrolledError } from './not-enrolled-error.js';
import { CourseClient, type SubmissionPrincipal } from './ports/course-client.js';
import { EnrollmentClient } from './ports/enrollment-client.js';
import { StorageClient } from './ports/storage-client.js';
import { SubmissionRepository } from './ports/submission-repository.js';
import { SubmissionForbiddenError } from './submission-forbidden-error.js';
import { SubmissionNotFoundError } from './submission-not-found-error.js';

export class SubmissionService {
  constructor(
    private readonly repository: SubmissionRepository,
    private readonly courseClient: CourseClient,
    private readonly enrollmentClient: EnrollmentClient,
    private readonly storageClient: StorageClient,
  ) {}

  async create(
    principal: SubmissionPrincipal,
    courseId: string,
    content: string,
  ): Promise<Submission> {
    if (!(await this.courseClient.exists(courseId, principal))) {
      throw new CourseNotFoundError(courseId);
    }
    if (!(await this.enrollmentClient.isEnrolled(principal.id, courseId))) {
      throw new NotEnrolledError(principal.id, courseId);
    }

    const id = randomUUID();
    const storageObjectKey = `submissions/${id}`;
    await this.storageClient.store(storageObjectKey, content);
    return this.repository.create({
      courseId,
      id,
      principalId: principal.id,
      storageObjectKey,
    });
  }

  async getById(id: string, principal?: SubmissionPrincipal): Promise<Submission> {
    const submission = await this.repository.findById(id);
    if (!submission) throw new SubmissionNotFoundError(id);
    if (principal?.role === 'student' && submission.principal_id !== principal.id) {
      throw new SubmissionForbiddenError();
    }
    return submission;
  }
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EnrollmentClient } from '../../application/ports/enrollment-client.js';
import { SubmissionDependencyError } from '../../application/submission-dependency-error.js';
import { requestDependency } from './dependency-http.js';

@Injectable()
export class EnrollmentHttpClient extends EnrollmentClient {
  constructor(private readonly config: ConfigService) {
    super();
  }

  async isEnrolled(principalId: string, courseId: string): Promise<boolean> {
    const query = new URLSearchParams({ course_id: courseId, principal_id: principalId });
    return requestDependency({
      baseUrl: this.config.getOrThrow<string>('SUBMISSION_ENROLLMENT_BASE_URL'),
      dependency: 'submission-enrollment',
      method: 'GET',
      operation: 'check',
      parseResponse: async (response) => {
        const body: unknown = await response.json();
        if (
          !body ||
          typeof body !== 'object' ||
          !('enrolled' in body) ||
          typeof body.enrolled !== 'boolean'
        ) {
          throw new SubmissionDependencyError('submission-enrollment', 'unavailable');
        }
        return body.enrolled;
      },
      path: `/api/v1/enrollments/check?${query.toString()}`,
      timeoutMs: this.config.getOrThrow<number>('SUBMISSION_DEPENDENCY_TIMEOUT_MS'),
    });
  }
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { GradingDependencyError } from '../../application/grading-dependency-error.js';
import {
  SubmissionClient,
  type SubmissionSummary,
} from '../../application/ports/submission-client.js';
import { requestDependency } from './dependency-http.js';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

@Injectable()
export class SubmissionHttpClient extends SubmissionClient {
  constructor(private readonly config: ConfigService) {
    super();
  }

  getById(submissionId: string): Promise<SubmissionSummary | null> {
    return requestDependency({
      allowedStatuses: [404],
      baseUrl: this.config.getOrThrow<string>('GRADING_SUBMISSION_BASE_URL'),
      dependency: 'grading-submission',
      method: 'GET',
      operation: 'get',
      parseResponse: async (response) => {
        if (response.status === 404) return null;
        const body: unknown = await response.json();
        if (
          !body ||
          typeof body !== 'object' ||
          !('id' in body) ||
          !('principal_id' in body) ||
          !('course_id' in body) ||
          !isNonEmptyString(body.id) ||
          !isNonEmptyString(body.principal_id) ||
          !isNonEmptyString(body.course_id)
        ) {
          throw new GradingDependencyError('grading-submission', 'unavailable');
        }
        return { course_id: body.course_id, id: body.id, principal_id: body.principal_id };
      },
      path: `/api/v1/submissions/${encodeURIComponent(submissionId)}`,
      timeoutMs: this.config.getOrThrow<number>('GRADING_DEPENDENCY_TIMEOUT_MS'),
    });
  }
}

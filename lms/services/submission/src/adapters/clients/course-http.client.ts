import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CourseClient, type SubmissionPrincipal } from '../../application/ports/course-client.js';
import { requestDependency } from './dependency-http.js';

@Injectable()
export class CourseHttpClient extends CourseClient {
  constructor(private readonly config: ConfigService) {
    super();
  }

  async exists(courseId: string, principal: SubmissionPrincipal): Promise<boolean> {
    const response = await requestDependency({
      allowedStatuses: [404],
      baseUrl: this.config.getOrThrow<string>('SUBMISSION_COURSE_BASE_URL'),
      dependency: 'submission-course',
      headers: {
        'x-principal-id': principal.id,
        'x-principal-role': principal.role,
      },
      method: 'GET',
      operation: 'exists',
      path: `/api/v1/courses/${encodeURIComponent(courseId)}`,
      timeoutMs: this.config.getOrThrow<number>('SUBMISSION_DEPENDENCY_TIMEOUT_MS'),
    });
    if (response.status === 404) return false;
    return true;
  }
}

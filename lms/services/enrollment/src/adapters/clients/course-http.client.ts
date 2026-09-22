import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EnrollmentDependencyError } from '../../application/enrollment-dependency-error.js';
import { CourseClient, type CoursePrincipal } from '../../application/ports/course-client.js';

@Injectable()
export class CourseHttpClient extends CourseClient {
  constructor(private readonly config: ConfigService) {
    super();
  }

  async exists(courseId: string, principal: CoursePrincipal): Promise<boolean> {
    const baseUrl = this.config.getOrThrow<string>('ENROLLMENT_COURSE_BASE_URL');
    const timeoutMs = this.config.getOrThrow<number>('ENROLLMENT_COURSE_TIMEOUT_MS');
    const url = new URL(`/api/v1/courses/${encodeURIComponent(courseId)}`, baseUrl);
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(url, {
        headers: {
          accept: 'application/json',
          'x-principal-id': principal.id,
          'x-principal-role': principal.role,
        },
        method: 'GET',
        signal: controller.signal,
      });
      if (response.status === 404) return false;
      if (!response.ok) {
        throw new EnrollmentDependencyError('enrollment-course', 'unavailable');
      }
      return true;
    } catch (error) {
      if (error instanceof EnrollmentDependencyError) throw error;
      if (timedOut) throw new EnrollmentDependencyError('enrollment-course', 'timeout');
      throw new EnrollmentDependencyError('enrollment-course', 'unavailable');
    } finally {
      clearTimeout(timeout);
    }
  }
}

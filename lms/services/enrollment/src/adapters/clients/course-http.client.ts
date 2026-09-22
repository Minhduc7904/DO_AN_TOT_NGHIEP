import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { context, propagation, trace } from '@opentelemetry/api';

import { EnrollmentDependencyError } from '../../application/enrollment-dependency-error.js';
import { CourseClient, type CoursePrincipal } from '../../application/ports/course-client.js';
import { observeDependency } from '../telemetry/dependency-telemetry.js';
import { CircuitBreaker } from './circuit-breaker.js';

@Injectable()
export class CourseHttpClient extends CourseClient {
  private readonly breaker: CircuitBreaker;

  constructor(private readonly config: ConfigService) {
    super();
    this.breaker = new CircuitBreaker({
      cooldownMs: config.getOrThrow<number>('ENROLLMENT_COURSE_BREAKER_COOLDOWN_MS'),
      failureThreshold: config.getOrThrow<number>('ENROLLMENT_COURSE_BREAKER_THRESHOLD'),
    });
  }

  exists(courseId: string, principal: CoursePrincipal): Promise<boolean> {
    return observeDependency('enrollment-course', 'exists', async () => {
      if (!this.breaker.allowRequest()) {
        trace.getActiveSpan()?.setAttribute('circuit_breaker_open', true);
        throw new EnrollmentDependencyError('enrollment-course', 'unavailable');
      }
      try {
        const result = await this.fetchCourse(courseId, principal);
        this.breaker.onSuccess();
        return result;
      } catch (error) {
        this.breaker.onFailure();
        throw error;
      }
    });
  }

  private async fetchCourse(courseId: string, principal: CoursePrincipal): Promise<boolean> {
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
      const headers: Record<string, string> = {
        accept: 'application/json',
        'x-principal-id': principal.id,
        'x-principal-role': principal.role,
      };
      propagation.inject(context.active(), headers);

      const response = await fetch(url, { headers, method: 'GET', signal: controller.signal });
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

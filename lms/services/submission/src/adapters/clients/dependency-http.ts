import { context, propagation } from '@opentelemetry/api';

import {
  SubmissionDependencyError,
  type SubmissionDependency,
} from '../../application/submission-dependency-error.js';
import { observeDependency } from '../telemetry/dependency-telemetry.js';

interface DependencyRequest {
  allowedStatuses?: number[];
  baseUrl: string;
  body?: unknown;
  dependency: SubmissionDependency;
  headers?: Record<string, string>;
  method: 'GET' | 'PUT';
  operation: string;
  path: string;
  timeoutMs: number;
}

export function requestDependency(input: DependencyRequest): Promise<Response> {
  return observeDependency(input.dependency, input.operation, async () => {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, input.timeoutMs);

    try {
      const headers: Record<string, string> = { accept: 'application/json', ...input.headers };
      const init: RequestInit = { headers, method: input.method, signal: controller.signal };
      if (input.body !== undefined) {
        headers['content-type'] = 'application/json';
        init.body = JSON.stringify(input.body);
      }
      propagation.inject(context.active(), headers);
      const response = await fetch(new URL(input.path, input.baseUrl), init);
      if (!response.ok && !input.allowedStatuses?.includes(response.status)) {
        throw new SubmissionDependencyError(input.dependency, dependencyKind(response));
      }
      return response;
    } catch {
      throw new SubmissionDependencyError(input.dependency, timedOut ? 'timeout' : 'unavailable');
    } finally {
      clearTimeout(timeout);
    }
  });
}

export function dependencyKind(response: Response): 'timeout' | 'unavailable' {
  return response.status === 504 ? 'timeout' : 'unavailable';
}

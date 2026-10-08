import { context, propagation } from '@opentelemetry/api';

import {
  GradingDependencyError,
  type GradingDependency,
} from '../../application/grading-dependency-error.js';
import { observeDependency } from '../telemetry/dependency-telemetry.js';

interface DependencyRequest<Result = Response> {
  allowedStatuses?: number[];
  baseUrl: string;
  dependency: GradingDependency;
  method: 'GET';
  operation: string;
  parseResponse?: (response: Response) => Promise<Result>;
  path: string;
  timeoutMs: number;
}

export function requestDependency<Result = Response>(
  input: DependencyRequest<Result>,
): Promise<Result> {
  return observeDependency(input.dependency, input.operation, async () => {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, input.timeoutMs);

    try {
      // Lời gọi service-to-service không mang Bearer JWT hay principal header, chỉ có W3C context.
      const headers: Record<string, string> = { accept: 'application/json' };
      propagation.inject(context.active(), headers);
      const response = await fetch(new URL(input.path, input.baseUrl), {
        headers,
        method: input.method,
        signal: controller.signal,
      });
      if (!response.ok && !input.allowedStatuses?.includes(response.status)) {
        throw new GradingDependencyError(input.dependency, dependencyKind(response));
      }
      return input.parseResponse ? await input.parseResponse(response) : (response as Result);
    } catch (error) {
      if (error instanceof GradingDependencyError) throw error;
      throw new GradingDependencyError(input.dependency, timedOut ? 'timeout' : 'unavailable');
    } finally {
      clearTimeout(timeout);
    }
  });
}

export function dependencyKind(response: Response): 'timeout' | 'unavailable' {
  return response.status === 504 ? 'timeout' : 'unavailable';
}

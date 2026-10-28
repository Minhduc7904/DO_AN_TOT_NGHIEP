import { AppError, ERROR_CODES } from '@aiops-lms/common/errors';

import {
  ProviderCallError,
  type ProbeResult,
  type ProviderProbe,
  type ProviderTarget,
} from '../../application/ports/provider-client.js';
import { callProvider } from './provider-http.js';

/** Health check: `GET {baseUrl}/models` với timeout ngắn; 2xx → ok, 401/403 → auth-failed, còn lại → error. */
export class ModelsListProbe implements ProviderProbe {
  constructor(private readonly timeoutMs: number) {}

  async check(target: ProviderTarget): Promise<ProbeResult> {
    const started = performance.now();
    const elapsed = (): number => Math.round(performance.now() - started);
    try {
      const status = await callProvider(
        { method: 'GET', path: 'models', target, timeoutMs: this.timeoutMs },
        (response) => {
          if (response.status >= 200 && response.status < 300) return response.status;
          if (response.status === 401 || response.status === 403) {
            throw new ProviderCallError('auth-failed', response.status);
          }
          throw new ProviderCallError(
            response.status >= 500 ? 'upstream-error' : 'rejected',
            response.status,
          );
        },
      );
      return { outcome: 'ok', httpStatus: status, latencyMs: elapsed() };
    } catch (error) {
      if (error instanceof ProviderCallError) {
        return {
          outcome: error.kind === 'auth-failed' ? 'auth-failed' : 'error',
          httpStatus: error.upstreamStatus,
          latencyMs: elapsed(),
        };
      }
      if (
        error instanceof AppError &&
        (error.code === ERROR_CODES.dependencyTimeout ||
          error.code === ERROR_CODES.dependencyUnavailable)
      ) {
        return { outcome: 'unreachable', httpStatus: null, latencyMs: null };
      }
      throw error;
    }
  }
}

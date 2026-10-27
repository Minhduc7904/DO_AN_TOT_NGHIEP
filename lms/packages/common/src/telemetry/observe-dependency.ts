import { logDependencyFailure } from '@aiops-lms/observability';
import { context, metrics, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';

import { AppError, ERROR_CODES } from '../errors/index.js';

const tracer = trace.getTracer('@aiops-lms/common');
const meter = metrics.getMeter('@aiops-lms/common');
const requestCount = meter.createCounter('lms.dependency.request.count');
const errorCount = meter.createCounter('lms.dependency.error.count');
const duration = meter.createHistogram('lms.dependency.duration', { unit: 's' });

export interface ObserveDependencyOptions {
  /** Thuộc tính span bổ sung, ví dụ `db.system.name`. */
  attributes?: Record<string, string>;
  /** Lỗi được coi là kết quả nghiệp vụ (không tính vào error count). Mặc định: không có. */
  isExpectedFailure?: (error: unknown) => boolean;
}

function classify(error: unknown): string {
  if (error instanceof AppError) {
    if (error.code === ERROR_CODES.dependencyTimeout) return 'timeout';
    if (error.code === ERROR_CODES.dependencyUnavailable) return 'unavailable';
  }
  return 'unavailable';
}

/**
 * Bọc một lời gọi dependency (HTTP, DB, RabbitMQ, MinIO, SMTP, AI provider) bằng span CLIENT và
 * ba metric `lms.dependency.*`. `dependencyIdentity` là định danh canonical trong catalogue v2,
 * ví dụ `course-postgres`, `media-minio`.
 */
export async function observeDependency<T>(
  dependencyIdentity: string,
  operation: string,
  run: () => Promise<T>,
  options: ObserveDependencyOptions = {},
): Promise<T> {
  const attributes = { dependency_identity: dependencyIdentity, operation_name: operation };
  const span = tracer.startSpan(`${dependencyIdentity} ${operation}`, {
    kind: SpanKind.CLIENT,
    attributes: { ...attributes, ...options.attributes },
  });
  const start = performance.now();
  let status = 'ok';
  try {
    return await context.with(trace.setSpan(context.active(), span), run);
  } catch (error) {
    if (options.isExpectedFailure?.(error)) {
      status = 'expected_failure';
    } else {
      status = classify(error);
      span.setAttribute('error.type', status);
      span.setStatus({ code: SpanStatusCode.ERROR });
      logDependencyFailure(span, {
        dependency_identity: dependencyIdentity,
        error_type: status,
        operation_name: operation,
      });
    }
    throw error;
  } finally {
    const labels = { ...attributes, status };
    requestCount.add(1, labels);
    if (status !== 'ok' && status !== 'expected_failure') errorCount.add(1, labels);
    duration.record((performance.now() - start) / 1_000, labels);
    span.end();
  }
}

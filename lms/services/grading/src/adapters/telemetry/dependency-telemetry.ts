import { context, metrics, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';

import { GradeConflictError } from '../../application/grade-conflict-error.js';
import {
  GradingDependencyError,
  type GradingDependency,
} from '../../application/grading-dependency-error.js';

const tracer = trace.getTracer('@aiops-lms/grading');
const meter = metrics.getMeter('@aiops-lms/grading');
const requestCount = meter.createCounter('grading.dependency.request.count');
const errorCount = meter.createCounter('grading.dependency.error.count');
const duration = meter.createHistogram('grading.dependency.duration', { unit: 's' });

export async function observeDependency<T>(
  dependency: GradingDependency,
  operation: string,
  run: () => Promise<T>,
): Promise<T> {
  const attributes = { dependency_identity: dependency, operation_name: operation };
  const span = tracer.startSpan(`${dependency} ${operation}`, {
    attributes,
    kind: SpanKind.CLIENT,
  });
  const start = performance.now();
  let status = 'ok';
  try {
    return await context.with(trace.setSpan(context.active(), span), run);
  } catch (error) {
    // Conflict là kết quả nghiệp vụ do PostgreSQL phản hồi bình thường, không phải lỗi dependency.
    if (!(error instanceof GradeConflictError)) {
      status = error instanceof GradingDependencyError ? error.kind : 'unavailable';
      span.setAttribute('error.type', status);
      span.setStatus({ code: SpanStatusCode.ERROR });
    }
    throw error;
  } finally {
    const labels = { ...attributes, status };
    requestCount.add(1, labels);
    if (status !== 'ok') errorCount.add(1, labels);
    duration.record((performance.now() - start) / 1_000, labels);
    span.end();
  }
}

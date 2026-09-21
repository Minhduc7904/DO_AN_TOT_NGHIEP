import { context, metrics, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';

import { CourseDependencyError } from '../../application/course-dependency-error.js';

const tracer = trace.getTracer('@aiops-lms/course');
const meter = metrics.getMeter('@aiops-lms/course');
const requestCount = meter.createCounter('course.dependency.request.count');
const errorCount = meter.createCounter('course.dependency.error.count');
const duration = meter.createHistogram('course.dependency.duration', { unit: 's' });

export async function observeDependency<T>(
  dependency: 'course-postgres' | 'course-redis',
  operation: 'create' | 'get' | 'list' | 'set' | 'invalidate',
  run: () => Promise<T>,
): Promise<T> {
  const attributes = { dependency_identity: dependency, operation_name: operation };
  const span = tracer.startSpan(`${dependency} ${operation}`, {
    kind: SpanKind.CLIENT,
    attributes,
  });
  const start = performance.now();
  let status = 'ok';
  try {
    return await context.with(trace.setSpan(context.active(), span), run);
  } catch (error) {
    status = error instanceof CourseDependencyError ? error.kind : 'unavailable';
    span.setAttribute('error.type', status);
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw error;
  } finally {
    const labels = { ...attributes, status };
    requestCount.add(1, labels);
    if (status !== 'ok') errorCount.add(1, labels);
    duration.record((performance.now() - start) / 1_000, labels);
    span.end();
  }
}

import { context, metrics, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';

import { EnrollmentDependencyError } from '../../application/enrollment-dependency-error.js';

const tracer = trace.getTracer('@aiops-lms/enrollment');
const meter = metrics.getMeter('@aiops-lms/enrollment');
const requestCount = meter.createCounter('enrollment.dependency.request.count');
const errorCount = meter.createCounter('enrollment.dependency.error.count');
const duration = meter.createHistogram('enrollment.dependency.duration', { unit: 's' });

export async function observeDependency<T>(
  dependency: 'enrollment-postgres' | 'enrollment-course',
  operation: string,
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
    const conflict = error instanceof Error && 'code' in error && error.code === '23505';
    status =
      error instanceof EnrollmentDependencyError
        ? error.kind
        : conflict
          ? 'conflict'
          : 'unavailable';
    span.setAttribute('error.type', status);
    if (!conflict) span.setStatus({ code: SpanStatusCode.ERROR });
    throw error;
  } finally {
    const labels = { ...attributes, status };
    requestCount.add(1, labels);
    if (status !== 'ok' && status !== 'conflict') errorCount.add(1, labels);
    duration.record((performance.now() - start) / 1_000, labels);
    span.end();
  }
}

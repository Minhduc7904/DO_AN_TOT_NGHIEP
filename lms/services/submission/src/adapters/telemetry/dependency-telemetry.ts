import { context, metrics, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';

import {
  SubmissionDependencyError,
  type SubmissionDependency,
} from '../../application/submission-dependency-error.js';

const tracer = trace.getTracer('@aiops-lms/submission');
const meter = metrics.getMeter('@aiops-lms/submission');
const requestCount = meter.createCounter('submission.dependency.request.count');
const errorCount = meter.createCounter('submission.dependency.error.count');
const duration = meter.createHistogram('submission.dependency.duration', { unit: 's' });

export async function observeDependency<T>(
  dependency: SubmissionDependency,
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
    status = error instanceof SubmissionDependencyError ? error.kind : 'unavailable';
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

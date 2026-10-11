import { context, metrics, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';

import { GradeEventPublishError } from '../../application/grade-event-publish-error.js';

export const GRADING_RABBITMQ_DEPENDENCY = 'grading-rabbitmq';

const tracer = trace.getTracer('@aiops-lms/grading');
const meter = metrics.getMeter('@aiops-lms/grading');
const publishCount = meter.createCounter('grading.messaging.publish.count');
const publishErrorCount = meter.createCounter('grading.messaging.publish.error.count');
const publishDuration = meter.createHistogram('grading.messaging.publish.duration', { unit: 's' });
const pendingGauge = meter.createObservableGauge('grading.messaging.pending.count');

let pendingEvents = 0;
pendingGauge.addCallback((result) => {
  result.observe(pendingEvents, { dependency_identity: GRADING_RABBITMQ_DEPENDENCY });
});

/** Số event `pending` quan sát được ở lần đếm gần nhất của worker. */
export function setPendingGradeEvents(total: number): void {
  pendingEvents = total;
}

export interface PublishTarget {
  eventId: string;
  exchange: string;
  routingKey: string;
}

/**
 * Bao một lần publish bằng span PRODUCER (active trong `run` để inject trace context) và metric.
 * Label chỉ gồm giá trị hữu hạn; `event_id` chỉ xuất hiện ở span, không bao giờ ở metric.
 */
export async function observePublish<T>(target: PublishTarget, run: () => Promise<T>): Promise<T> {
  const labels = {
    dependency_identity: GRADING_RABBITMQ_DEPENDENCY,
    exchange: target.exchange,
    operation_name: 'publish',
    routing_key: target.routingKey,
  };
  const span = tracer.startSpan(`${target.exchange} publish`, {
    attributes: {
      dependency_identity: GRADING_RABBITMQ_DEPENDENCY,
      'messaging.destination.name': target.exchange,
      'messaging.message.id': target.eventId,
      'messaging.operation.type': 'publish',
      'messaging.rabbitmq.destination.routing_key': target.routingKey,
      'messaging.system': 'rabbitmq',
      operation_name: 'publish',
    },
    kind: SpanKind.PRODUCER,
  });
  const start = performance.now();
  let status = 'ok';
  try {
    return await context.with(trace.setSpan(context.active(), span), run);
  } catch (error) {
    status = error instanceof GradeEventPublishError ? error.kind : 'unavailable';
    span.setAttribute('error.type', status);
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw error;
  } finally {
    const withStatus = { ...labels, status };
    publishCount.add(1, withStatus);
    if (status !== 'ok') publishErrorCount.add(1, withStatus);
    publishDuration.record((performance.now() - start) / 1_000, withStatus);
    span.end();
  }
}

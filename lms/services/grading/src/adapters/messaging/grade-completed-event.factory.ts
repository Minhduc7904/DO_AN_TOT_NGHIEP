import { randomBytes } from 'node:crypto';

import {
  createGradeCompletedRabbitMqHeaders,
  gradeCompletedEventSchema,
  type GradeCompletedEvent,
  type GradeCompletedRabbitMqHeaders,
} from '@aiops-lms/contracts';
import { context, propagation, trace } from '@opentelemetry/api';

import { GradeEventPublishError } from '../../application/grade-event-publish-error.js';
import type { GradeCompletedSnapshot } from '../../domain/grade-completed-snapshot.js';

export interface GradeCompletedMessage {
  event: GradeCompletedEvent;
  headers: GradeCompletedRabbitMqHeaders;
}

interface TraceCorrelation {
  traceparent: string;
  tracestate: string | null;
}

/** Inject trace context đang active; cùng giá trị này đi vào RabbitMQ headers và `correlation` của envelope. */
function currentCorrelation(): TraceCorrelation {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  if (carrier['traceparent']) {
    return { traceparent: carrier['traceparent'], tracestate: carrier['tracestate'] ?? null };
  }
  const spanContext = trace.getActiveSpan()?.spanContext();
  if (spanContext && trace.isSpanContextValid(spanContext)) {
    const flags = spanContext.traceFlags.toString(16).padStart(2, '0');
    return {
      traceparent: `00-${spanContext.traceId}-${spanContext.spanId}-${flags}`,
      tracestate: spanContext.traceState?.serialize() || null,
    };
  }
  // Telemetry tắt: contract vẫn bắt buộc traceparent hợp lệ nên sinh context mới, không sampled.
  return {
    traceparent: `00-${randomBytes(16).toString('hex')}-${randomBytes(8).toString('hex')}-00`,
    tracestate: null,
  };
}

/**
 * Dựng envelope v1 từ snapshot. `event_id`, `occurred_at` và payload lấy từ snapshot nên không đổi
 * giữa các lần retry; chỉ `correlation` đổi theo từng publish attempt.
 */
export function buildGradeCompletedMessage(
  snapshot: GradeCompletedSnapshot,
  serviceVersion: string,
): GradeCompletedMessage {
  const correlation = currentCorrelation();
  const parsed = gradeCompletedEventSchema.safeParse({
    correlation:
      correlation.tracestate !== null && correlation.tracestate.length > 512
        ? { ...correlation, tracestate: null }
        : correlation,
    event_id: snapshot.eventId,
    event_name: 'grade.completed',
    occurred_at: snapshot.completedAt,
    payload: {
      completed_at: snapshot.completedAt,
      course_id: snapshot.courseId,
      grade_id: snapshot.gradeId,
      principal_id: snapshot.principalId,
      score: snapshot.score,
      submission_id: snapshot.submissionId,
    },
    producer: { service_name: 'grading', service_version: serviceVersion },
    schema_version: 1,
  });
  if (!parsed.success) throw new GradeEventPublishError('EVENT_INVALID');
  return { event: parsed.data, headers: createGradeCompletedRabbitMqHeaders(parsed.data) };
}

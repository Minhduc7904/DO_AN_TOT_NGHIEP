import {
  gradeCompletedEventSchema,
  gradeCompletedRabbitMqHeadersSchema,
} from '@aiops-lms/contracts';
import { Injectable } from '@nestjs/common';
import { context, trace } from '@opentelemetry/api';

import {
  GradeCompletedFixtureConsumer,
  type NotificationPreview,
} from './grade-completed.fixture-consumer.js';
import { NotificationConsumerFault } from './notification-consumer-fault.js';
import {
  NotificationMessagingTelemetry,
  type RabbitMqTraceHeaders,
} from './notification-messaging-telemetry.js';

export class InvalidGradeCompletedMessageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidGradeCompletedMessageError';
  }
}

function normalizeHeaders(headers: Record<string, unknown> | undefined): RabbitMqTraceHeaders {
  const normalized: RabbitMqTraceHeaders = {};

  for (const [key, value] of Object.entries(headers ?? {})) {
    if (typeof value === 'string') {
      normalized[key.toLowerCase()] = value;
    } else if (Buffer.isBuffer(value)) {
      normalized[key.toLowerCase()] = value.toString('utf8');
    }
  }

  return normalized;
}

function parseEvent(content: Buffer): unknown {
  try {
    return JSON.parse(content.toString('utf8'));
  } catch {
    throw new InvalidGradeCompletedMessageError('RabbitMQ message must contain JSON');
  }
}

function logProcessing(eventName: string, eventId: string, outcome: string): void {
  const spanContext = trace.getSpan(context.active())?.spanContext();
  console.info(
    JSON.stringify({
      event: eventName,
      event_id: eventId,
      level: 'info',
      outcome,
      service_name: 'notification',
      span_id: spanContext?.spanId,
      trace_id: spanContext?.traceId,
    }),
  );
}

@Injectable()
export class RabbitMqGradeCompletedMessageHandler {
  constructor(
    private readonly processor: GradeCompletedFixtureConsumer,
    private readonly fault: NotificationConsumerFault,
    private readonly telemetry: NotificationMessagingTelemetry,
  ) {}

  async handle(
    content: Buffer,
    rawHeaders: Record<string, unknown> | undefined,
  ): Promise<NotificationPreview> {
    const event = gradeCompletedEventSchema.parse(parseEvent(content));
    const headers = gradeCompletedRabbitMqHeadersSchema.parse(normalizeHeaders(rawHeaders));

    if (
      headers.traceparent !== event.correlation.traceparent ||
      (headers.tracestate ?? null) !== event.correlation.tracestate
    ) {
      throw new InvalidGradeCompletedMessageError(
        'RabbitMQ trace headers must match grade.completed correlation',
      );
    }

    const traceHeaders: RabbitMqTraceHeaders = {
      traceparent: headers.traceparent,
      ...(headers.tracestate ? { tracestate: headers.tracestate } : {}),
    };

    return this.telemetry.observe(traceHeaders, event, async () => {
      await this.fault.beforeProcess();
      const preview = this.processor.process(event);
      logProcessing(event.event_name, event.event_id, preview.status);
      return preview;
    });
  }
}

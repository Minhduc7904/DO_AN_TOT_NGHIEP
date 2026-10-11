import type { GradeCompletedEvent } from '@aiops-lms/contracts';
import { Inject, Injectable } from '@nestjs/common';
import {
  context,
  metrics,
  propagation,
  ROOT_CONTEXT,
  SpanKind,
  SpanStatusCode,
  trace,
  type Context,
  type TextMapGetter,
} from '@opentelemetry/api';

import {
  RABBITMQ_GRADE_COMPLETED_BINDING,
  type RabbitMqGradeCompletedBinding,
} from './rabbitmq-grade-completed.binding.js';

export type RabbitMqTraceHeaders = Record<string, string>;

const rabbitMqHeaderGetter: TextMapGetter<RabbitMqTraceHeaders> = {
  get(carrier, key) {
    return carrier[key.toLowerCase()];
  },
  keys(carrier) {
    return Object.keys(carrier);
  },
};

function errorType(error: unknown): string {
  return error instanceof Error && error.name ? error.name : 'processing_error';
}

@Injectable()
export class NotificationMessagingTelemetry {
  private readonly consumeCount = metrics
    .getMeter('@aiops-lms/notification')
    .createCounter('notification.rabbitmq.consume.count');
  private readonly consumeErrorCount = metrics
    .getMeter('@aiops-lms/notification')
    .createCounter('notification.rabbitmq.consume.error.count');
  private readonly consumeDuration = metrics
    .getMeter('@aiops-lms/notification')
    .createHistogram('notification.rabbitmq.consume.duration', { unit: 's' });
  private readonly processCount = metrics
    .getMeter('@aiops-lms/notification')
    .createCounter('notification.process.count');
  private readonly processErrorCount = metrics
    .getMeter('@aiops-lms/notification')
    .createCounter('notification.process.error.count');
  private readonly processDuration = metrics
    .getMeter('@aiops-lms/notification')
    .createHistogram('notification.process.duration', { unit: 's' });
  private readonly tracer = trace.getTracer('@aiops-lms/notification');

  constructor(
    @Inject(RABBITMQ_GRADE_COMPLETED_BINDING)
    private readonly binding: Pick<RabbitMqGradeCompletedBinding, 'queue'>,
  ) {}

  async observe<T>(
    headers: RabbitMqTraceHeaders,
    receive: () => GradeCompletedEvent,
    validate: (event: GradeCompletedEvent) => void,
    run: (event: GradeCompletedEvent) => Promise<T>,
  ): Promise<T> {
    const parentContext = propagation.extract(ROOT_CONTEXT, headers, rabbitMqHeaderGetter);
    const attributes = {
      dependency_identity: 'notification-rabbitmq',
      'messaging.destination.kind': 'queue',
      'messaging.destination.name': this.binding.queue,
      'messaging.operation': 'receive',
      'messaging.system': 'rabbitmq',
      operation_name: 'consume',
    };
    const consumeSpan = this.tracer.startSpan(
      'rabbitmq consume grade.completed',
      { attributes, kind: SpanKind.CONSUMER },
      parentContext,
    );
    const consumeContext = trace.setSpan(parentContext, consumeSpan);
    const consumeStartedAt = performance.now();
    let consumeStatus = 'ok';
    let event: GradeCompletedEvent | undefined;

    try {
      return await context.with(consumeContext, async () => {
        const receivedEvent = receive();
        event = receivedEvent;
        consumeSpan.setAttributes({
          event_name: receivedEvent.event_name,
          'messaging.message.id': receivedEvent.event_id,
        });
        validate(receivedEvent);
        return this.observeProcessing(receivedEvent, () => run(receivedEvent));
      });
    } catch (error) {
      consumeStatus = errorType(error);
      consumeSpan.recordException(error instanceof Error ? error : String(error));
      consumeSpan.setAttribute('error.type', consumeStatus);
      consumeSpan.setStatus({ code: SpanStatusCode.ERROR });
      context.with(consumeContext, () => this.logConsumeError(error, event));
      throw error;
    } finally {
      const labels = {
        dependency_identity: 'notification-rabbitmq',
        operation_name: 'consume',
        status: consumeStatus,
      };
      this.consumeCount.add(1, labels);
      if (consumeStatus !== 'ok') {
        this.consumeErrorCount.add(1, labels);
      }
      this.consumeDuration.record((performance.now() - consumeStartedAt) / 1_000, labels);
      consumeSpan.end();
    }
  }

  private logConsumeError(error: unknown, event: GradeCompletedEvent | undefined): void {
    const spanContext = trace.getSpan(context.active())?.spanContext();
    console.error(
      JSON.stringify({
        error_type: errorType(error),
        event: event?.event_name ?? 'grade.completed',
        ...(event ? { event_id: event.event_id } : {}),
        level: 'error',
        operation_name: 'consume',
        service_name: 'notification',
        span_id: spanContext?.spanId,
        trace_id: spanContext?.traceId,
      }),
    );
  }

  private async observeProcessing<T>(
    event: GradeCompletedEvent,
    run: () => Promise<T>,
  ): Promise<T> {
    const processSpan = this.tracer.startSpan(
      'notification process grade.completed',
      {
        attributes: {
          event_name: event.event_name,
          'messaging.message.id': event.event_id,
          operation_name: 'process',
        },
        kind: SpanKind.INTERNAL,
      },
      context.active(),
    );
    const processContext: Context = trace.setSpan(context.active(), processSpan);
    const processStartedAt = performance.now();
    let processStatus = 'ok';

    try {
      return await context.with(processContext, run);
    } catch (error) {
      processStatus = errorType(error);
      processSpan.recordException(error instanceof Error ? error : String(error));
      processSpan.setAttribute('error.type', processStatus);
      processSpan.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      const labels = { operation_name: 'process', status: processStatus };
      this.processCount.add(1, labels);
      if (processStatus !== 'ok') {
        this.processErrorCount.add(1, labels);
      }
      this.processDuration.record((performance.now() - processStartedAt) / 1_000, labels);
      processSpan.end();
    }
  }
}

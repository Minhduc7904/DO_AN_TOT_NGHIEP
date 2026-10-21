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

export type NotificationDeliveryOutcome = 'accepted' | 'duplicate' | 'rejected' | 'unavailable';

@Injectable()
export class NotificationMessagingTelemetry {
  private readonly connectionCount = metrics
    .getMeter('@aiops-lms/notification')
    .createCounter('notification.rabbitmq.connection.count');
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
      'messaging.operation.type': 'receive',
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
    let consumeStatus: NotificationDeliveryOutcome = 'accepted';
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
        const result = await this.observeProcessing(receivedEvent, () => run(receivedEvent));
        consumeStatus = this.deliveryOutcome(result);
        consumeSpan.setAttribute('notification.delivery.outcome', consumeStatus);
        return result;
      });
    } catch (error) {
      consumeStatus = this.isRejected(error) ? 'rejected' : 'unavailable';
      const failureType = errorType(error);
      consumeSpan.addEvent('exception', {
        'exception.type': failureType,
        'exception.message': 'Message consumption failed',
      });
      consumeSpan.setAttribute('error.type', failureType);
      consumeSpan.setAttribute('notification.delivery.outcome', consumeStatus);
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
      if (consumeStatus === 'rejected' || consumeStatus === 'unavailable') {
        this.consumeErrorCount.add(1, labels);
      }
      this.consumeDuration.record((performance.now() - consumeStartedAt) / 1_000, labels);
      consumeSpan.end();
    }
  }

  recordUnavailable(error: unknown): void {
    const labels = {
      dependency_identity: 'notification-rabbitmq',
      operation_name: 'connect',
      status: 'unavailable',
    };
    this.connectionCount.add(1, labels);
    console.error(
      JSON.stringify({
        error_type: errorType(error),
        event: 'grade.completed',
        level: 'error',
        operation_name: 'connect',
        outcome: 'unavailable',
        service_name: 'notification',
      }),
    );
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
          dependency_identity: 'notification-rabbitmq',
          event_name: event.event_name,
          'messaging.message.id': event.event_id,
          operation_name: 'process',
          'messaging.operation.type': 'process',
          'messaging.system': 'rabbitmq',
        },
        kind: SpanKind.INTERNAL,
      },
      context.active(),
    );
    const processContext: Context = trace.setSpan(context.active(), processSpan);
    const processStartedAt = performance.now();
    let processStatus: NotificationDeliveryOutcome = 'accepted';

    try {
      const result = await context.with(processContext, run);
      processStatus = this.deliveryOutcome(result);
      processSpan.setAttribute('notification.delivery.outcome', processStatus);
      return result;
    } catch (error) {
      processStatus = 'unavailable';
      processSpan.addEvent('exception', {
        'exception.type': errorType(error),
        'exception.message': 'Message processing failed',
      });
      processSpan.setAttribute('error.type', errorType(error));
      processSpan.setAttribute('notification.delivery.outcome', processStatus);
      processSpan.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      const labels = { operation_name: 'process', status: processStatus };
      this.processCount.add(1, labels);
      if (processStatus === 'unavailable') {
        this.processErrorCount.add(1, labels);
      }
      this.processDuration.record((performance.now() - processStartedAt) / 1_000, labels);
      processSpan.end();
    }
  }

  private deliveryOutcome(value: unknown): 'accepted' | 'duplicate' {
    return typeof value === 'object' && value !== null && 'status' in value
      ? value.status === 'duplicate'
        ? 'duplicate'
        : 'accepted'
      : 'accepted';
  }

  private isRejected(error: unknown): boolean {
    return (
      error instanceof Error &&
      (error.name === 'InvalidGradeCompletedMessageError' || error.name === 'ZodError')
    );
  }
}

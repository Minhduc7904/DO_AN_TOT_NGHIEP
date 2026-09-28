import type { GradeCompletedEvent } from '@aiops-lms/contracts';
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

  async observe<T>(
    headers: RabbitMqTraceHeaders,
    event: GradeCompletedEvent,
    run: () => Promise<T>,
  ): Promise<T> {
    const parentContext = propagation.extract(ROOT_CONTEXT, headers, rabbitMqHeaderGetter);
    const attributes = {
      dependency_identity: 'notification-rabbitmq',
      event_name: event.event_name,
      'messaging.destination.kind': 'queue',
      'messaging.destination.name': 'notification.grade-completed.v1',
      'messaging.message.id': event.event_id,
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

    try {
      return await context.with(consumeContext, () => this.observeProcessing(event, run));
    } catch (error) {
      consumeStatus = errorType(error);
      consumeSpan.recordException(error instanceof Error ? error : String(error));
      consumeSpan.setAttribute('error.type', consumeStatus);
      consumeSpan.setStatus({ code: SpanStatusCode.ERROR });
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

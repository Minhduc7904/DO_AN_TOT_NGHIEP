import type { ConfigService } from '@nestjs/config';

export const RABBITMQ_GRADE_COMPLETED_BINDING = Symbol('RABBITMQ_GRADE_COMPLETED_BINDING');

export interface RabbitMqGradeCompletedBinding {
  exchange: string;
  prefetch: number;
  queue: string;
  routing_key: 'grade.completed';
  url: string;
}

export function createRabbitMqGradeCompletedBinding(
  config: Pick<ConfigService, 'getOrThrow'>,
): RabbitMqGradeCompletedBinding {
  return {
    exchange: config.getOrThrow<string>('NOTIFICATION_GRADE_COMPLETED_EXCHANGE'),
    prefetch: config.getOrThrow<number>('NOTIFICATION_CONSUMER_PREFETCH'),
    queue: config.getOrThrow<string>('NOTIFICATION_GRADE_COMPLETED_QUEUE'),
    routing_key: 'grade.completed',
    url: config.getOrThrow<string>('NOTIFICATION_RABBITMQ_URL'),
  };
}

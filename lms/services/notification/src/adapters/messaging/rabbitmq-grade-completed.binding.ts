import type { ConfigService } from '@nestjs/config';

export interface RabbitMqGradeCompletedBinding {
  exchange: string;
  queue: string;
  routing_key: 'grade.completed';
  url: string;
}

export function createRabbitMqGradeCompletedBinding(
  config: Pick<ConfigService, 'getOrThrow'>,
): RabbitMqGradeCompletedBinding {
  return {
    exchange: config.getOrThrow<string>('NOTIFICATION_GRADE_COMPLETED_EXCHANGE'),
    queue: config.getOrThrow<string>('NOTIFICATION_GRADE_COMPLETED_QUEUE'),
    routing_key: 'grade.completed',
    url: config.getOrThrow<string>('NOTIFICATION_RABBITMQ_URL'),
  };
}

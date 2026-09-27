import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { GradeCompletedFixtureConsumer } from './grade-completed.fixture-consumer.js';
import {
  createRabbitMqGradeCompletedBinding,
  type RabbitMqGradeCompletedBinding,
} from './rabbitmq-grade-completed.binding.js';

export const RABBITMQ_GRADE_COMPLETED_BINDING = Symbol('RABBITMQ_GRADE_COMPLETED_BINDING');

@Module({
  providers: [
    GradeCompletedFixtureConsumer,
    {
      provide: RABBITMQ_GRADE_COMPLETED_BINDING,
      inject: [ConfigService],
      useFactory: (config: ConfigService): RabbitMqGradeCompletedBinding =>
        createRabbitMqGradeCompletedBinding(config),
    },
  ],
  exports: [GradeCompletedFixtureConsumer, RABBITMQ_GRADE_COMPLETED_BINDING],
})
export class NotificationModule {}

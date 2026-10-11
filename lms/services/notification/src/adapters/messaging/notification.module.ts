import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { GradeCompletedFixtureConsumer } from './grade-completed.fixture-consumer.js';
import { NotificationConsumerFault } from './notification-consumer-fault.js';
import { NotificationMessagingTelemetry } from './notification-messaging-telemetry.js';
import { connectRabbitMq, RABBITMQ_CONNECT } from './rabbitmq-client.js';
import {
  createRabbitMqGradeCompletedBinding,
  RABBITMQ_GRADE_COMPLETED_BINDING,
  type RabbitMqGradeCompletedBinding,
} from './rabbitmq-grade-completed.binding.js';
import { RabbitMqGradeCompletedConsumer } from './rabbitmq-grade-completed.consumer.js';
import { RabbitMqGradeCompletedMessageHandler } from './rabbitmq-grade-completed.message-handler.js';

@Module({
  providers: [
    GradeCompletedFixtureConsumer,
    NotificationConsumerFault,
    NotificationMessagingTelemetry,
    RabbitMqGradeCompletedMessageHandler,
    RabbitMqGradeCompletedConsumer,
    { provide: RABBITMQ_CONNECT, useValue: connectRabbitMq },
    {
      provide: RABBITMQ_GRADE_COMPLETED_BINDING,
      inject: [ConfigService],
      useFactory: (config: ConfigService): RabbitMqGradeCompletedBinding =>
        createRabbitMqGradeCompletedBinding(config),
    },
  ],
  exports: [
    GradeCompletedFixtureConsumer,
    RabbitMqGradeCompletedConsumer,
    RABBITMQ_GRADE_COMPLETED_BINDING,
  ],
})
export class NotificationModule {}

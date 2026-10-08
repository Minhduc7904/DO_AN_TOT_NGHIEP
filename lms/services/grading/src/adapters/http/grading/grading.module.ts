import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { GradePublicationCoordinator } from '../../../application/grade-publication.coordinator.js';
import { GradeCompletedPublisher } from '../../../application/ports/grade-completed-publisher.js';
import { GradePublicationRepository } from '../../../application/ports/grade-publication-repository.js';
import { GradeRepository } from '../../../application/ports/grade-repository.js';
import { SubmissionClient } from '../../../application/ports/submission-client.js';
import { GradingService } from '../../../application/grading.service.js';
import { SubmissionHttpClient } from '../../clients/submission-http.client.js';
import { PendingGradeEventWorker } from '../../messaging/pending-grade-event.worker.js';
import { RabbitMqGradeCompletedPublisher } from '../../messaging/rabbitmq-grade-completed.publisher.js';
import { PostgresGradeRepository } from '../../persistence/postgres-grade.repository.js';
import { GradingController } from './grading.controller.js';

@Module({
  controllers: [GradingController],
  providers: [
    {
      provide: GradingService,
      inject: [GradeRepository, SubmissionClient, GradePublicationCoordinator],
      useFactory: (
        repository: GradeRepository,
        submissionClient: SubmissionClient,
        publication: GradePublicationCoordinator,
      ): GradingService => new GradingService(repository, submissionClient, publication),
    },
    {
      provide: GradePublicationCoordinator,
      inject: [GradePublicationRepository, GradeCompletedPublisher],
      useFactory: (
        repository: GradePublicationRepository,
        publisher: GradeCompletedPublisher,
      ): GradePublicationCoordinator => new GradePublicationCoordinator(repository, publisher),
    },
    {
      provide: PendingGradeEventWorker,
      inject: [GradePublicationRepository, GradePublicationCoordinator, ConfigService],
      useFactory: (
        repository: GradePublicationRepository,
        coordinator: GradePublicationCoordinator,
        config: ConfigService,
      ): PendingGradeEventWorker => new PendingGradeEventWorker(repository, coordinator, config),
    },
    PostgresGradeRepository,
    RabbitMqGradeCompletedPublisher,
    SubmissionHttpClient,
    { provide: GradeRepository, useExisting: PostgresGradeRepository },
    { provide: GradePublicationRepository, useExisting: PostgresGradeRepository },
    { provide: GradeCompletedPublisher, useExisting: RabbitMqGradeCompletedPublisher },
    { provide: SubmissionClient, useExisting: SubmissionHttpClient },
  ],
})
export class GradingModule {}

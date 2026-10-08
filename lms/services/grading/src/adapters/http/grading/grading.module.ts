import { Module } from '@nestjs/common';

import { GradeRepository } from '../../../application/ports/grade-repository.js';
import { SubmissionClient } from '../../../application/ports/submission-client.js';
import { GradingService } from '../../../application/grading.service.js';
import { SubmissionHttpClient } from '../../clients/submission-http.client.js';
import { PostgresGradeRepository } from '../../persistence/postgres-grade.repository.js';
import { GradingController } from './grading.controller.js';

@Module({
  controllers: [GradingController],
  providers: [
    {
      provide: GradingService,
      inject: [GradeRepository, SubmissionClient],
      useFactory: (
        repository: GradeRepository,
        submissionClient: SubmissionClient,
      ): GradingService => new GradingService(repository, submissionClient),
    },
    PostgresGradeRepository,
    SubmissionHttpClient,
    { provide: GradeRepository, useExisting: PostgresGradeRepository },
    { provide: SubmissionClient, useExisting: SubmissionHttpClient },
  ],
})
export class GradingModule {}

import { Module } from '@nestjs/common';

import { SubmissionService } from '../../../application/submission.service.js';
import { CourseClient } from '../../../application/ports/course-client.js';
import { EnrollmentClient } from '../../../application/ports/enrollment-client.js';
import { StorageClient } from '../../../application/ports/storage-client.js';
import { SubmissionRepository } from '../../../application/ports/submission-repository.js';
import { CourseHttpClient } from '../../clients/course-http.client.js';
import { EnrollmentHttpClient } from '../../clients/enrollment-http.client.js';
import { StorageHttpClient } from '../../clients/storage-http.client.js';
import { PostgresSubmissionRepository } from '../../persistence/postgres-submission.repository.js';
import { SubmissionController } from './submission.controller.js';

@Module({
  controllers: [SubmissionController],
  providers: [
    {
      provide: SubmissionService,
      inject: [SubmissionRepository, CourseClient, EnrollmentClient, StorageClient],
      useFactory: (
        repository: SubmissionRepository,
        courseClient: CourseClient,
        enrollmentClient: EnrollmentClient,
        storageClient: StorageClient,
      ): SubmissionService =>
        new SubmissionService(repository, courseClient, enrollmentClient, storageClient),
    },
    PostgresSubmissionRepository,
    CourseHttpClient,
    EnrollmentHttpClient,
    StorageHttpClient,
    { provide: SubmissionRepository, useExisting: PostgresSubmissionRepository },
    { provide: CourseClient, useExisting: CourseHttpClient },
    { provide: EnrollmentClient, useExisting: EnrollmentHttpClient },
    { provide: StorageClient, useExisting: StorageHttpClient },
  ],
})
export class SubmissionModule {}

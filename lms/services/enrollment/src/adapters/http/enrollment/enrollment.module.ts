import { Module } from '@nestjs/common';

import { EnrollmentService } from '../../../application/enrollment.service.js';
import { CourseClient } from '../../../application/ports/course-client.js';
import { EnrollmentRepository } from '../../../application/ports/enrollment-repository.js';
import { CourseHttpClient } from '../../clients/course-http.client.js';
import { PostgresEnrollmentRepository } from '../../persistence/postgres-enrollment.repository.js';
import { EnrollmentController } from './enrollment.controller.js';

@Module({
  controllers: [EnrollmentController],
  providers: [
    {
      provide: EnrollmentService,
      inject: [EnrollmentRepository, CourseClient],
      useFactory: (
        repository: EnrollmentRepository,
        courseClient: CourseClient,
      ): EnrollmentService => new EnrollmentService(repository, courseClient),
    },
    PostgresEnrollmentRepository,
    CourseHttpClient,
    { provide: EnrollmentRepository, useExisting: PostgresEnrollmentRepository },
    { provide: CourseClient, useExisting: CourseHttpClient },
  ],
})
export class EnrollmentModule {}

import { Module } from '@nestjs/common';

import { CourseService } from '../../../application/course.service.js';
import { CourseRepository } from '../../../application/ports/course-repository.js';
import { PostgresCourseRepository } from '../../persistence/postgres-course.repository.js';
import { CourseController } from './course.controller.js';

@Module({
  controllers: [CourseController],
  providers: [
    {
      provide: CourseService,
      inject: [CourseRepository],
      useFactory: (repository: CourseRepository): CourseService => new CourseService(repository),
    },
    PostgresCourseRepository,
    { provide: CourseRepository, useExisting: PostgresCourseRepository },
  ],
})
export class CourseModule {}

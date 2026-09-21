import { Module } from '@nestjs/common';

import { CourseService } from '../../../application/course.service.js';
import { CourseRepository } from '../../../application/ports/course-repository.js';
import { CourseCache } from '../../../application/ports/course-cache.js';
import { RedisCourseCache } from '../../cache/redis-course.cache.js';
import { PostgresCourseRepository } from '../../persistence/postgres-course.repository.js';
import { CourseController } from './course.controller.js';

@Module({
  controllers: [CourseController],
  providers: [
    {
      provide: CourseService,
      inject: [CourseRepository, CourseCache],
      useFactory: (repository: CourseRepository, cache: CourseCache): CourseService =>
        new CourseService(repository, cache),
    },
    PostgresCourseRepository,
    RedisCourseCache,
    { provide: CourseRepository, useExisting: PostgresCourseRepository },
    { provide: CourseCache, useExisting: RedisCourseCache },
  ],
})
export class CourseModule {}

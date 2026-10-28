import type { Principal } from '@aiops-lms/common/ports';

import type { Course } from '../../../domain/course.js';
import type { CourseRepository } from '../../ports/course-repository.js';
import { type CourseQuery, scopeCourseFilter } from './course-scope.js';

export class ListCoursesUseCase {
  constructor(private readonly courses: CourseRepository) {}

  execute(
    principal: Principal,
    query: CourseQuery,
    page: number,
    pageSize: number,
  ): Promise<{ items: Course[]; total: number }> {
    return this.courses.list(scopeCourseFilter(principal, query), page, pageSize);
  }
}

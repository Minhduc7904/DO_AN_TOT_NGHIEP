import type { IdGenerator, Principal } from '@aiops-lms/common/ports';
import { AppError } from '@aiops-lms/common/errors';

import type { Course } from '../../../domain/course.js';
import type { CourseRepository } from '../../ports/course-repository.js';

export interface CreateCourseInput {
  name: string;
  descriptionMarkdown: string | null;
}

export class CreateCourseUseCase {
  constructor(
    private readonly courses: CourseRepository,
    private readonly ids: IdGenerator,
  ) {}

  /** Khóa học mới luôn là `DRAFT` và thuộc người tạo. */
  execute(principal: Principal, input: CreateCourseInput): Promise<Course> {
    if (principal.role === 'student') throw AppError.forbidden();
    return this.courses.create({
      id: this.ids.next(),
      name: input.name,
      descriptionMarkdown: input.descriptionMarkdown,
      instructorId: principal.id,
    });
  }
}

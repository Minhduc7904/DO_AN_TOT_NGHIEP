import type { IdGenerator, Principal } from '@aiops-lms/common/ports';
import { AppError } from '@aiops-lms/common/errors';

import type { Course } from '../../../domain/course.js';
import { MediaUsageEffects } from '../../media-usage-effects.js';
import type { CourseRepository } from '../../ports/course-repository.js';

export interface CreateCourseInput {
  name: string;
  descriptionMarkdown: string | null;
}

export class CreateCourseUseCase {
  constructor(
    private readonly courses: CourseRepository,
    private readonly ids: IdGenerator,
    private readonly media: MediaUsageEffects = new MediaUsageEffects(),
  ) {}

  /** Khóa học mới luôn là `DRAFT` và thuộc người tạo. */
  execute(principal: Principal, input: CreateCourseInput): Promise<Course> {
    if (principal.role === 'student') throw AppError.forbidden();
    const id = this.ids.next();
    return this.courses.create(
      {
        id,
        name: input.name,
        descriptionMarkdown: input.descriptionMarkdown,
        instructorId: principal.id,
      },
      input.descriptionMarkdown === null
        ? []
        : this.media.syncMarkdown(
            'COURSE_DESCRIPTION',
            id,
            input.descriptionMarkdown,
            principal.id,
          ),
    );
  }
}

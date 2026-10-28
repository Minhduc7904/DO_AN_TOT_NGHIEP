import type { IdGenerator, Principal } from '@aiops-lms/common/ports';

import { courseErrors } from '../../../domain/errors.js';
import type { Lesson } from '../../../domain/course.js';
import { loadManagedCourse } from '../../course-access.js';
import { MediaUsageEffects } from '../../media-usage-effects.js';
import type { CourseRepository } from '../../ports/course-repository.js';
import type { LessonRepository } from '../../ports/lesson-repository.js';

export interface CreateLessonInput {
  title: string;
  contentMarkdown: string | null;
  displayOrder?: number | undefined;
}

export class CreateLessonUseCase {
  constructor(
    private readonly courses: CourseRepository,
    private readonly lessons: LessonRepository,
    private readonly ids: IdGenerator,
    private readonly media: MediaUsageEffects = new MediaUsageEffects(),
  ) {}

  async execute(principal: Principal, courseId: string, input: CreateLessonInput): Promise<Lesson> {
    await loadManagedCourse(this.courses, principal, courseId);
    const id = this.ids.next();
    const lesson = await this.lessons.create(
      {
        id,
        courseId,
        title: input.title,
        contentMarkdown: input.contentMarkdown,
        displayOrder: input.displayOrder,
      },
      input.contentMarkdown === null
        ? []
        : this.media.syncMarkdown('LESSON_CONTENT', id, input.contentMarkdown, principal.id),
    );
    if (!lesson) throw courseErrors.lessonOrderConflict();
    return lesson;
  }
}

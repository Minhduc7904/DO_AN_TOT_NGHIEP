import type { Principal } from '@aiops-lms/common/ports';

import type { Lesson } from '../../../domain/course.js';
import { loadManagedLesson } from '../../course-access.js';
import type { CourseRepository } from '../../ports/course-repository.js';
import type { LessonRepository } from '../../ports/lesson-repository.js';

export class GetLessonUseCase {
  constructor(
    private readonly courses: CourseRepository,
    private readonly lessons: LessonRepository,
  ) {}

  async execute(principal: Principal, courseId: string, lessonId: string): Promise<Lesson> {
    const { lesson } = await loadManagedLesson(
      this.courses,
      this.lessons,
      principal,
      courseId,
      lessonId,
    );
    return lesson;
  }
}

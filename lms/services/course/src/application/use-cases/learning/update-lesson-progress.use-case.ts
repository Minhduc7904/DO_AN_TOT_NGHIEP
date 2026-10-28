import type { IdGenerator, Clock } from '@aiops-lms/common/ports';

import type { LessonProgress } from '../../../domain/course.js';
import type { EnrollmentRepository, ProgressRepository } from '../../ports/learning-repository.js';
import type { LessonRepository } from '../../ports/lesson-repository.js';
import { loadEnrolledLesson } from './student-access.js';

export class UpdateLessonProgressUseCase {
  constructor(
    private readonly lessons: LessonRepository,
    private readonly enrollments: EnrollmentRepository,
    private readonly progress: ProgressRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  /** Tiến độ chỉ tăng; đạt 100% thì bài học hoàn thành. */
  async execute(
    studentId: string,
    lessonId: string,
    progressPercent: number,
  ): Promise<LessonProgress> {
    await loadEnrolledLesson(this.lessons, this.enrollments, studentId, lessonId);
    return this.progress.upsert({
      id: this.ids.next(),
      lessonId,
      studentId,
      progressPercent,
      now: this.clock.now(),
    });
  }
}

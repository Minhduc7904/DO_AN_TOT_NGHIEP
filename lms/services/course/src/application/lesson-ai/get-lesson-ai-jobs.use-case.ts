import type { Principal } from '@aiops-lms/common/ports';

import type { LessonAiJob } from '../../domain/lesson-ai.js';
import { loadManagedLesson } from '../course-access.js';
import type { CourseRepository } from '../ports/course-repository.js';
import type { LessonAiService } from '../ports/lesson-ai-service.js';
import type { LessonRepository } from '../ports/lesson-repository.js';

/** Các job AI gần nhất của bài học (mới trước, tối đa 10), không kèm nội dung bài học cũ. */
export class GetLessonAiJobsUseCase {
  constructor(
    private readonly courses: CourseRepository,
    private readonly lessons: LessonRepository,
    private readonly ai: LessonAiService,
  ) {}

  async execute(principal: Principal, courseId: string, lessonId: string): Promise<LessonAiJob[]> {
    await loadManagedLesson(this.courses, this.lessons, principal, courseId, lessonId);
    return this.ai.listJobs(lessonId);
  }
}

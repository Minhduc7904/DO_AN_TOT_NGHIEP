import type { Principal } from '@aiops-lms/common/ports';

import type { LessonAiJobDetail } from '../../domain/lesson-ai.js';
import { loadManagedLesson } from '../course-access.js';
import type { CourseRepository } from '../ports/course-repository.js';
import type { LessonAiService } from '../ports/lesson-ai-service.js';
import type { LessonRepository } from '../ports/lesson-repository.js';

/** Chi tiết một job, kèm nội dung bài học cũ nếu job đã ghi đè (để khôi phục); 404 nếu job không thuộc bài học. */
export class GetLessonAiJobUseCase {
  constructor(
    private readonly courses: CourseRepository,
    private readonly lessons: LessonRepository,
    private readonly ai: LessonAiService,
  ) {}

  async execute(
    principal: Principal,
    courseId: string,
    lessonId: string,
    jobId: string,
  ): Promise<LessonAiJobDetail> {
    await loadManagedLesson(this.courses, this.lessons, principal, courseId, lessonId);
    return this.ai.getJob(lessonId, jobId);
  }
}

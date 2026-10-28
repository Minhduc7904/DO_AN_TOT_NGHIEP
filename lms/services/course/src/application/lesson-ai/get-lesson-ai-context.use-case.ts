import { AppError } from '@aiops-lms/common/errors';

import type { LessonRepository } from '../ports/lesson-repository.js';

export interface LessonAiContext {
  courseId: string;
  lessonId: string;
  title: string;
  contentMarkdown: string | null;
}

/** Bối cảnh bài học cho `ai-worker` (chỉ đọc): tiêu đề và nội dung hiện tại. */
export class GetLessonAiContextUseCase {
  constructor(private readonly lessons: LessonRepository) {}

  async execute(courseId: string, lessonId: string): Promise<LessonAiContext> {
    const lesson = await this.lessons.findInCourse(courseId, lessonId);
    if (!lesson) throw AppError.notFound('Không tìm thấy bài học');
    return {
      courseId,
      lessonId,
      title: lesson.title,
      contentMarkdown: lesson.contentMarkdown,
    };
  }
}

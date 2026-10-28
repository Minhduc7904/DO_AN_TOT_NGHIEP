import type { Principal } from '@aiops-lms/common/ports';

import { courseErrors } from '../../domain/errors.js';
import { loadManagedLesson } from '../course-access.js';
import type { CourseRepository } from '../ports/course-repository.js';
import type { LessonRepository } from '../ports/lesson-repository.js';
import type { UpdateLessonUseCase } from '../use-cases/lessons/update-lesson.use-case.js';

/**
 * `ai-worker` ghi nội dung bài học do AI soạn, dưới danh nghĩa người yêu cầu job. Dùng lại `UpdateLessonUseCase`
 * nên kiểm tra quyền sở hữu, giới hạn độ dài và lệnh đồng bộ media usage giống khi giảng viên tự sửa bài học.
 * Bài học đã có nội dung mà không `overwrite` thì `409 LESSON_CONTENT_EXISTS` (kiểm tra lại ở đây vì nội dung
 * có thể đổi từ lúc tạo job); trả nội dung cũ để job lưu cho việc khôi phục.
 */
export class ApplyLessonAiContentUseCase {
  constructor(
    private readonly courses: CourseRepository,
    private readonly lessons: LessonRepository,
    private readonly updateLesson: UpdateLessonUseCase,
  ) {}

  async execute(
    principal: Principal,
    courseId: string,
    lessonId: string,
    input: { contentMarkdown: string; overwriteContent: boolean },
  ): Promise<{ previousContentMarkdown: string | null }> {
    const { lesson } = await loadManagedLesson(
      this.courses,
      this.lessons,
      principal,
      courseId,
      lessonId,
    );
    const hasContent = (lesson.contentMarkdown?.trim().length ?? 0) > 0;
    if (hasContent && !input.overwriteContent) throw courseErrors.lessonContentExists();

    await this.updateLesson.execute(principal, courseId, lessonId, {
      contentMarkdown: input.contentMarkdown,
    });
    return { previousContentMarkdown: hasContent ? lesson.contentMarkdown : null };
  }
}

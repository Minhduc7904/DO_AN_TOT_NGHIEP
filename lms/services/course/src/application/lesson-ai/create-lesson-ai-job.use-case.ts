import type { Principal } from '@aiops-lms/common/ports';

import { courseErrors } from '../../domain/errors.js';
import type { LessonAiJob, LessonAiJobType } from '../../domain/lesson-ai.js';
import { loadManagedLesson } from '../course-access.js';
import type { CourseRepository } from '../ports/course-repository.js';
import type { LessonAiService } from '../ports/lesson-ai-service.js';
import type { LessonAttachmentSource } from '../ports/lesson-attachment-source.js';
import type { LessonRepository } from '../ports/lesson-repository.js';

export interface CreateLessonAiJobInput {
  jobType: LessonAiJobType;
  mediaIds: readonly string[];
  questionCount: number | undefined;
  overwriteContent: boolean;
}

/**
 * Tạo job AI (trả ngay, `ai-worker` chạy nền). `course` kiểm tra những gì chỉ `course` biết: quyền sở hữu,
 * bài học thuộc khóa học, bài học đã có nội dung mà không ghi đè, và các tài liệu có thật sự là tệp đính kèm
 * của bài học (theo `media`). Phần còn lại (tài liệu đã `EXTRACTED`, một job đang hoạt động mỗi loại) do `ai`.
 */
export class CreateLessonAiJobUseCase {
  constructor(
    private readonly courses: CourseRepository,
    private readonly lessons: LessonRepository,
    private readonly ai: LessonAiService,
    private readonly attachments: LessonAttachmentSource,
  ) {}

  async execute(
    principal: Principal,
    courseId: string,
    lessonId: string,
    input: CreateLessonAiJobInput,
  ): Promise<LessonAiJob> {
    const { lesson } = await loadManagedLesson(
      this.courses,
      this.lessons,
      principal,
      courseId,
      lessonId,
    );
    if (
      input.jobType === 'SYNTHESIZE_LESSON' &&
      !input.overwriteContent &&
      (lesson.contentMarkdown?.trim().length ?? 0) > 0
    ) {
      throw courseErrors.lessonContentExists();
    }

    const mediaIds = [...new Set(input.mediaIds)];
    const attached = new Set(
      (await this.attachments.listLessonAttachments(lessonId)).map(
        (attachment) => attachment.mediaId,
      ),
    );
    const notAttached = mediaIds.filter((mediaId) => !attached.has(mediaId));
    if (notAttached.length > 0) throw courseErrors.aiDocumentsNotExtracted(notAttached);

    return this.ai.createJob({
      jobType: input.jobType,
      courseId,
      lessonId,
      mediaIds,
      questionCount: input.questionCount,
      overwriteContent: input.overwriteContent,
      requestedBy: { id: principal.id, role: principal.role },
    });
  }
}

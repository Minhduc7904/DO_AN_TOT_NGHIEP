import type { Principal } from '@aiops-lms/common/ports';

import type { LessonAiDocumentView } from '../../domain/lesson-ai.js';
import { loadManagedLesson } from '../course-access.js';
import type { CourseRepository } from '../ports/course-repository.js';
import type { LessonAiService } from '../ports/lesson-ai-service.js';
import type { LessonAttachmentSource } from '../ports/lesson-attachment-source.js';
import type { LessonRepository } from '../ports/lesson-repository.js';
import { mergeDocuments } from './document-view.js';

/**
 * Đưa tệp đính kèm của bài học vào hàng chờ trích xuất: lấy danh sách tệp từ `media`, nhờ `ai` tạo bản ghi
 * `PENDING` (hoặc `UNSUPPORTED`) và phát lệnh trích xuất, tùy chọn thử lại tài liệu `FAILED`. Idempotent.
 */
export class SyncLessonAiDocumentsUseCase {
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
    options: { retryFailed: boolean },
  ): Promise<LessonAiDocumentView[]> {
    await loadManagedLesson(this.courses, this.lessons, principal, courseId, lessonId);
    const attachments = await this.attachments.listLessonAttachments(lessonId);
    if (attachments.length === 0) return [];
    return mergeDocuments(
      attachments,
      await this.ai.syncDocuments(attachments, options.retryFailed),
    );
  }
}

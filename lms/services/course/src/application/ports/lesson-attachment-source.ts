import type { LessonAttachment } from '../../domain/lesson-ai.js';

export const LESSON_ATTACHMENT_SOURCE = Symbol('LESSON_ATTACHMENT_SOURCE');

/** Cạnh `course → media` (internal): tệp đính kèm của bài học. */
export interface LessonAttachmentSource {
  /** Tệp đính kèm theo thứ tự đính kèm. */
  listLessonAttachments(lessonId: string): Promise<LessonAttachment[]>;
}

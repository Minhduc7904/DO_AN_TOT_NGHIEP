import type { LessonAiDocumentView, LessonAttachment } from '../../domain/lesson-ai.js';
import type { AiDocumentState } from '../ports/lesson-ai-service.js';

/**
 * Hợp nhất tệp đính kèm (metadata và thứ tự từ `media`) với trạng thái trích xuất do `ai` trả. `PROCESSING`
 * của `ai` hiển thị là `EXTRACTING`; tệp mà `ai` không nhắc tới coi như chưa xếp hàng.
 */
export function mergeDocuments(
  attachments: readonly LessonAttachment[],
  states: readonly AiDocumentState[],
): LessonAiDocumentView[] {
  const byMedia = new Map(states.map((state) => [state.mediaId, state]));
  return attachments.map((attachment) => {
    const state = byMedia.get(attachment.mediaId);
    return {
      mediaId: attachment.mediaId,
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      mediaType: attachment.mediaType,
      status: !state ? 'NOT_QUEUED' : state.status === 'PROCESSING' ? 'EXTRACTING' : state.status,
      errorCode: state?.errorCode ?? null,
      errorMessage: state?.errorMessage ?? null,
      textLength: state?.textLength ?? 0,
      updatedAt: state?.updatedAt ?? null,
    };
  });
}

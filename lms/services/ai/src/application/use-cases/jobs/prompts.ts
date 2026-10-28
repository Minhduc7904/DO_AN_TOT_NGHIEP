import type { AiJobType } from '../../../domain/lesson-ai.js';
import { UNTRUSTED_NOTICE } from '../documents/prompts.js';

export const SAVE_LESSON_TOOL = 'save_lesson_content';
export const CREATE_QUIZ_TOOL = 'create_quiz';

export function systemPrompt(jobType: AiJobType, questionCount: number | null): string {
  if (jobType === 'SYNTHESIZE_LESSON') {
    return (
      'Bạn là trợ lý soạn bài giảng cho giảng viên. Hãy tổng hợp các tài liệu được cung cấp thành MỘT bài học ' +
      'Markdown hoàn chỉnh, mạch lạc, có tiêu đề và các mục rõ ràng, dùng ngôn ngữ của tài liệu. ' +
      `Khi xong, gọi đúng một lần công cụ ${SAVE_LESSON_TOOL} với toàn bộ bài học (tối đa 20000 ký tự). ` +
      'Nếu công cụ báo lỗi, hãy sửa theo thông báo và gọi lại. Không trả lời bằng văn bản thường thay cho việc gọi công cụ. ' +
      UNTRUSTED_NOTICE
    );
  }
  return (
    `Bạn là trợ lý soạn câu hỏi trắc nghiệm. Dựa trên các tài liệu được cung cấp, hãy soạn đúng ${questionCount ?? 10} câu hỏi ` +
    'kiểm tra mức độ hiểu bài, dùng ngôn ngữ của tài liệu. Mỗi câu 2–10 lựa chọn; SINGLE_CHOICE có đúng 1 đáp án đúng, ' +
    'MULTIPLE_CHOICE có ít nhất 1 đáp án đúng; điểm (points) lớn hơn 0 và không quá 100. ' +
    `Khi xong, gọi đúng một lần công cụ ${CREATE_QUIZ_TOOL}. Nếu công cụ báo lỗi, hãy sửa theo thông báo và gọi lại. ` +
    'Không trả lời bằng văn bản thường thay cho việc gọi công cụ. ' +
    UNTRUSTED_NOTICE
  );
}

function escapeAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}

/** Tiêu đề bài học và các tài liệu, mỗi tài liệu trong một khối `<document>`. */
export function userPrompt(
  lessonTitle: string,
  documents: readonly { fileName: string; text: string }[],
): string {
  const blocks = documents.map(
    (document) =>
      `<document name="${escapeAttribute(document.fileName)}">\n${document.text}\n</document>`,
  );
  return `Tiêu đề bài học: ${lessonTitle}\n\n${blocks.join('\n\n')}`;
}

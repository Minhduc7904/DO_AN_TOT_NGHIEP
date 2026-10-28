import type { Quiz, QuizQuestion } from '../domain/course.js';
import type { MarkdownUsageType, MediaEffect, MediaUsageLookup } from './ports/media-effects.js';

/** Tập markdown của một quiz (mô tả, câu hỏi, đáp án) để `media` so khớp tham chiếu media. */
export function quizMarkdown(
  description: string | null,
  questions: readonly QuizQuestion[],
): string {
  const parts = description ? [description] : [];
  for (const question of questions) {
    parts.push(question.questionMarkdown);
    for (const option of question.options) parts.push(option.optionMarkdown);
  }
  return parts.join('\n\n');
}

/** Dựng danh sách tác động `media` cho từng loại thay đổi; không có `lookup` thì chỉ đồng bộ markdown. */
export class MediaUsageEffects {
  constructor(private readonly lookup: MediaUsageLookup | null = null) {}

  syncMarkdown(
    usageType: MarkdownUsageType,
    ownerId: string,
    markdown: string | null,
    actorId: string,
  ): MediaEffect[] {
    return [{ kind: 'sync-markdown-usage', ownerId, usageType, markdown, actorId }];
  }

  syncQuiz(
    quiz: Pick<Quiz, 'id' | 'descriptionMarkdown' | 'questions'>,
    actorId: string,
  ): MediaEffect[] {
    return this.syncMarkdown(
      'QUIZ_CONTENT',
      quiz.id,
      quizMarkdown(quiz.descriptionMarkdown, quiz.questions),
      actorId,
    );
  }

  /** Usage của các owner sắp bị xóa; media không trả lời thì lỗi lan lên (503), không xóa nửa vời. */
  async deleteUsagesOf(ownerIds: readonly string[]): Promise<MediaEffect[]> {
    if (!this.lookup || ownerIds.length === 0) return [];
    const usageIds = await this.lookup.findUsageIds(ownerIds);
    return usageIds.length === 0 ? [] : [{ kind: 'delete-usages', usageIds }];
  }
}

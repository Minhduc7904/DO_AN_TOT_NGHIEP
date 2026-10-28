/**
 * Tác động lên `media` mà thay đổi trong course kéo theo. Repository ghi chúng vào outbox trong
 * cùng transaction với thay đổi nghiệp vụ; relay phát sang `media-worker` (at-least-once).
 */
export type MarkdownUsageType = 'COURSE_DESCRIPTION' | 'LESSON_CONTENT' | 'QUIZ_CONTENT';

export type MediaEffect =
  | {
      kind: 'sync-markdown-usage';
      /** Id course/lesson/quiz sở hữu markdown. */
      ownerId: string;
      usageType: MarkdownUsageType;
      markdown: string | null;
      actorId: string;
    }
  | { kind: 'delete-usages'; usageIds: readonly string[] };

export const MEDIA_USAGE_LOOKUP = Symbol('MEDIA_USAGE_LOOKUP');

/** Cạnh `course → media` (internal): hỏi usage id theo owner trước khi xóa course/lesson/quiz. */
export interface MediaUsageLookup {
  findUsageIds(ownerIds: readonly string[]): Promise<string[]>;
}

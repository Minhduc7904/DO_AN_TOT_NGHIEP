import type { IdGenerator } from '@aiops-lms/common/ports';

import type { QuizQuestion } from '../../../domain/course.js';
import { type QuestionDraft, validateQuestions } from '../../../domain/quiz-content.js';

/** Kiểm tra nội dung rồi gán id và `display_order` (1..n) cho câu hỏi và lựa chọn. */
export function buildQuestionTree(
  drafts: readonly QuestionDraft[],
  ids: IdGenerator,
): QuizQuestion[] {
  validateQuestions(drafts);
  return drafts.map((draft, questionIndex) => ({
    id: ids.next(),
    questionMarkdown: draft.questionMarkdown,
    questionType: draft.questionType,
    points: draft.points,
    displayOrder: questionIndex + 1,
    options: draft.options.map((option, optionIndex) => ({
      id: ids.next(),
      optionMarkdown: option.optionMarkdown,
      isCorrect: option.isCorrect,
      displayOrder: optionIndex + 1,
    })),
  }));
}

import type { CreateQuizRequest } from '@aiops-lms/contracts';

import type { QuestionDraft } from '../../../domain/quiz-content.js';

/** Chuyển câu hỏi snake_case của request thành bản nháp của domain (dùng chung cho API công khai và nội bộ). */
export function toQuestionDrafts(questions: CreateQuizRequest['questions']): QuestionDraft[] {
  return questions.map((question) => ({
    questionMarkdown: question.question_markdown,
    questionType: question.question_type,
    points: question.points,
    options: question.options.map((option) => ({
      optionMarkdown: option.option_markdown,
      isCorrect: option.is_correct,
    })),
  }));
}

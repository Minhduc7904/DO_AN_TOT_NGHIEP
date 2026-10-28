import type { AttemptAnswer, QuizQuestion } from './course.js';

export interface GradingResult {
  score: number;
  maxScore: number;
  correctQuestionIds: string[];
}

/** Điểm được cộng dồn theo phần trăm điểm (số nguyên) để tránh sai số số thực. */
function toHundredths(points: number): number {
  return Math.round(points * 100);
}

/**
 * Chấm điểm thuần: một câu đúng khi tập lựa chọn đã chọn bằng đúng tập đáp án đúng (không chấm
 * điểm từng phần). Điểm tối đa là tổng điểm của quiz tại thời điểm chấm.
 */
export class QuizGrader {
  grade(questions: readonly QuizQuestion[], answers: readonly AttemptAnswer[]): GradingResult {
    const selectedByQuestion = new Map(
      answers.map((answer) => [answer.questionId, new Set(answer.optionIds)]),
    );
    let score = 0;
    let maxScore = 0;
    const correctQuestionIds: string[] = [];

    for (const question of questions) {
      const points = toHundredths(question.points);
      maxScore += points;

      const selected = selectedByQuestion.get(question.id) ?? new Set<string>();
      const correctOptionIds = question.options
        .filter((option) => option.isCorrect)
        .map((option) => option.id);
      const isCorrect =
        selected.size === correctOptionIds.length &&
        correctOptionIds.every((optionId) => selected.has(optionId));
      if (isCorrect) {
        score += points;
        correctQuestionIds.push(question.id);
      }
    }

    return { score: score / 100, maxScore: maxScore / 100, correctQuestionIds };
  }
}

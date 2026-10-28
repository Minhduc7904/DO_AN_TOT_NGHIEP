import { AppError } from '@aiops-lms/common/errors';

import type { QuestionType } from './course.js';

export const QUIZ_LIMITS = {
  titleMin: 2,
  titleMax: 200,
  markdownMax: 20000,
  optionMax: 2000,
  questionsMax: 100,
  optionsMin: 2,
  optionsMax: 10,
  pointsMax: 100,
} as const;

export interface QuestionDraft {
  questionMarkdown: string;
  questionType: QuestionType;
  points: number;
  options: { optionMarkdown: string; isCorrect: boolean }[];
}

interface Issue {
  path: string;
  message: string;
}

function fail(issues: Issue[]): never {
  throw AppError.validation('Nội dung quiz không hợp lệ', issues);
}

export function validateQuizTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length < QUIZ_LIMITS.titleMin || trimmed.length > QUIZ_LIMITS.titleMax) {
    fail([
      {
        path: 'title',
        message: `Tiêu đề dài ${QUIZ_LIMITS.titleMin}–${QUIZ_LIMITS.titleMax} ký tự`,
      },
    ]);
  }
  return trimmed;
}

/** Điểm dương, tối đa 100 và không quá 2 chữ số thập phân. */
function isValidPoints(points: number): boolean {
  if (!Number.isFinite(points) || points <= 0 || points > QUIZ_LIMITS.pointsMax) return false;
  return Math.abs(points * 100 - Math.round(points * 100)) < 1e-9;
}

export function validateQuestions(questions: readonly QuestionDraft[]): void {
  const issues: Issue[] = [];
  if (questions.length > QUIZ_LIMITS.questionsMax) {
    issues.push({ path: 'questions', message: `Tối đa ${QUIZ_LIMITS.questionsMax} câu hỏi` });
  }

  questions.forEach((question, index) => {
    const at = `questions.${index}`;
    const markdown = question.questionMarkdown.trim();
    if (markdown.length === 0 || markdown.length > QUIZ_LIMITS.markdownMax) {
      issues.push({
        path: `${at}.question_markdown`,
        message: `Nội dung câu hỏi dài 1–${QUIZ_LIMITS.markdownMax} ký tự`,
      });
    }
    if (!isValidPoints(question.points)) {
      issues.push({
        path: `${at}.points`,
        message: `Điểm phải lớn hơn 0, tối đa ${QUIZ_LIMITS.pointsMax}, không quá 2 chữ số thập phân`,
      });
    }
    if (
      question.options.length < QUIZ_LIMITS.optionsMin ||
      question.options.length > QUIZ_LIMITS.optionsMax
    ) {
      issues.push({
        path: `${at}.options`,
        message: `Mỗi câu hỏi có ${QUIZ_LIMITS.optionsMin}–${QUIZ_LIMITS.optionsMax} lựa chọn`,
      });
    }
    question.options.forEach((option, optionIndex) => {
      const text = option.optionMarkdown.trim();
      if (text.length === 0 || text.length > QUIZ_LIMITS.optionMax) {
        issues.push({
          path: `${at}.options.${optionIndex}.option_markdown`,
          message: `Nội dung lựa chọn dài 1–${QUIZ_LIMITS.optionMax} ký tự`,
        });
      }
    });

    const correct = question.options.filter((option) => option.isCorrect).length;
    if (question.questionType === 'SINGLE_CHOICE' && correct !== 1) {
      issues.push({
        path: `${at}.options`,
        message: 'Câu một đáp án phải có đúng 1 lựa chọn đúng',
      });
    }
    if (question.questionType === 'MULTIPLE_CHOICE' && correct < 1) {
      issues.push({
        path: `${at}.options`,
        message: 'Câu nhiều đáp án phải có ít nhất 1 lựa chọn đúng',
      });
    }
  });

  if (issues.length > 0) fail(issues);
}

/** Quiz chỉ được xuất bản khi đã có ít nhất một câu hỏi. */
export function assertPublishable(questionCount: number): void {
  if (questionCount < 1) {
    fail([{ path: 'status', message: 'Quiz cần ít nhất 1 câu hỏi trước khi xuất bản' }]);
  }
}

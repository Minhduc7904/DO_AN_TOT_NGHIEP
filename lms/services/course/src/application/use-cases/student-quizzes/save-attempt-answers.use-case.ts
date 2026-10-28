import { AppError } from '@aiops-lms/common/errors';

import type { AttemptAnswer, Quiz, QuizAttempt } from '../../../domain/course.js';
import { courseErrors } from '../../../domain/errors.js';
import type { AttemptRepository } from '../../ports/attempt-repository.js';
import type { QuizRepository } from '../../ports/quiz-repository.js';
import { loadAttemptQuiz, loadOwnAttempt } from './attempt-access.js';

function assertAnswersMatchQuiz(quiz: Quiz, answers: readonly AttemptAnswer[]): void {
  const questions = new Map(quiz.questions.map((question) => [question.id, question]));
  const seen = new Set<string>();

  for (const answer of answers) {
    const question = questions.get(answer.questionId);
    if (!question) throw AppError.validation(`Câu hỏi ${answer.questionId} không thuộc quiz`);
    if (seen.has(answer.questionId)) {
      throw AppError.validation(`Câu hỏi ${answer.questionId} xuất hiện nhiều lần`);
    }
    seen.add(answer.questionId);

    const optionIds = new Set(question.options.map((option) => option.id));
    const chosen = new Set(answer.optionIds);
    if (chosen.size !== answer.optionIds.length || ![...chosen].every((id) => optionIds.has(id))) {
      throw AppError.validation(`Lựa chọn của câu hỏi ${answer.questionId} không hợp lệ`);
    }
    if (question.questionType === 'SINGLE_CHOICE' && chosen.size > 1) {
      throw AppError.validation(`Câu hỏi ${answer.questionId} chỉ được chọn một đáp án`);
    }
  }
}

export class SaveAttemptAnswersUseCase {
  constructor(
    private readonly attempts: AttemptRepository,
    private readonly quizzes: QuizRepository,
  ) {}

  /** Thay toàn bộ câu trả lời đã lưu; câu không có lựa chọn coi như bỏ trống. */
  async execute(
    studentId: string,
    attemptId: string,
    answers: readonly AttemptAnswer[],
  ): Promise<QuizAttempt> {
    const attempt = await loadOwnAttempt(this.attempts, studentId, attemptId);
    if (attempt.status !== 'IN_PROGRESS') throw courseErrors.quizAttemptAlreadySubmitted();

    assertAnswersMatchQuiz(await loadAttemptQuiz(this.quizzes, attempt), answers);

    const saved = await this.attempts.replaceAnswers(
      attemptId,
      answers.filter((answer) => answer.optionIds.length > 0),
    );
    if (!saved) throw courseErrors.quizAttemptAlreadySubmitted();
    return saved;
  }
}

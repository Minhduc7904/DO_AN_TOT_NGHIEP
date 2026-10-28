import { AppError } from '@aiops-lms/common/errors';

import type { Quiz, QuizAttempt } from '../../../domain/course.js';
import type { AttemptRepository } from '../../ports/attempt-repository.js';
import type { QuizRepository } from '../../ports/quiz-repository.js';

/** Lượt làm bài của chính học viên; lượt của người khác coi như không tồn tại. */
export async function loadOwnAttempt(
  attempts: AttemptRepository,
  studentId: string,
  attemptId: string,
): Promise<QuizAttempt> {
  const attempt = await attempts.findById(attemptId);
  if (!attempt || attempt.studentId !== studentId) {
    throw AppError.notFound('Không tìm thấy lượt làm bài');
  }
  return attempt;
}

export async function loadAttemptQuiz(
  quizzes: QuizRepository,
  attempt: QuizAttempt,
): Promise<Quiz> {
  const quiz = await quizzes.findById(attempt.quizId);
  if (!quiz) throw AppError.notFound('Không tìm thấy quiz');
  return quiz;
}

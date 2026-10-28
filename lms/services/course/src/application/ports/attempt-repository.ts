import type { AttemptAnswer, QuizAttempt } from '../../domain/course.js';

export const ATTEMPT_REPOSITORY = Symbol('ATTEMPT_REPOSITORY');

export interface NewAttempt {
  id: string;
  quizId: string;
  studentId: string;
  startedAt: Date;
}

export interface AttemptResult {
  score: number;
  maxScore: number;
  submittedAt: Date;
}

export interface AttemptRepository {
  findInProgress(quizId: string, studentId: string): Promise<QuizAttempt | null>;
  /** `null` khi (quiz, học viên) đã có lượt đang làm. */
  create(attempt: NewAttempt): Promise<QuizAttempt | null>;
  findById(attemptId: string): Promise<QuizAttempt | null>;
  /** Thay toàn bộ câu trả lời của lượt đang làm. */
  replaceAnswers(attemptId: string, answers: readonly AttemptAnswer[]): Promise<QuizAttempt | null>;
  /** `null` khi lượt làm bài không còn `IN_PROGRESS`. */
  submit(attemptId: string, result: AttemptResult): Promise<QuizAttempt | null>;
  listByQuiz(
    quizId: string,
    studentId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: QuizAttempt[]; total: number }>;
}

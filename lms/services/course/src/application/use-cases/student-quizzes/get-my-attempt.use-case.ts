import type { Quiz, QuizAttempt } from '../../../domain/course.js';
import type { AttemptRepository } from '../../ports/attempt-repository.js';
import type { QuizRepository } from '../../ports/quiz-repository.js';
import { loadAttemptQuiz, loadOwnAttempt } from './attempt-access.js';

export class GetMyAttemptUseCase {
  constructor(
    private readonly attempts: AttemptRepository,
    private readonly quizzes: QuizRepository,
  ) {}

  async execute(
    studentId: string,
    attemptId: string,
  ): Promise<{ attempt: QuizAttempt; quiz: Quiz }> {
    const attempt = await loadOwnAttempt(this.attempts, studentId, attemptId);
    return { attempt, quiz: await loadAttemptQuiz(this.quizzes, attempt) };
  }
}

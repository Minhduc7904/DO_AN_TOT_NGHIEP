import type { Clock } from '@aiops-lms/common/ports';

import type { Quiz, QuizAttempt } from '../../../domain/course.js';
import { courseErrors } from '../../../domain/errors.js';
import type { QuizGrader } from '../../../domain/quiz-grader.js';
import type { AttemptRepository } from '../../ports/attempt-repository.js';
import type { QuizRepository } from '../../ports/quiz-repository.js';
import { loadAttemptQuiz, loadOwnAttempt } from './attempt-access.js';

export class SubmitQuizAttemptUseCase {
  constructor(
    private readonly attempts: AttemptRepository,
    private readonly quizzes: QuizRepository,
    private readonly grader: QuizGrader,
    private readonly clock: Clock,
  ) {}

  /** Chấm theo các câu trả lời đã lưu và đóng băng điểm cùng điểm tối đa tại thời điểm nộp. */
  async execute(
    studentId: string,
    attemptId: string,
  ): Promise<{ attempt: QuizAttempt; quiz: Quiz }> {
    const attempt = await loadOwnAttempt(this.attempts, studentId, attemptId);
    if (attempt.status !== 'IN_PROGRESS') throw courseErrors.quizAttemptAlreadySubmitted();

    const quiz = await loadAttemptQuiz(this.quizzes, attempt);
    const result = this.grader.grade(quiz.questions, attempt.answers);

    const submitted = await this.attempts.submit(attemptId, {
      score: result.score,
      maxScore: result.maxScore,
      submittedAt: this.clock.now(),
    });
    if (!submitted) throw courseErrors.quizAttemptAlreadySubmitted();
    return { attempt: submitted, quiz };
  }
}

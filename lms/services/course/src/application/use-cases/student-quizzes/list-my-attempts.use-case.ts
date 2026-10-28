import type { QuizAttempt } from '../../../domain/course.js';
import type { AttemptRepository } from '../../ports/attempt-repository.js';
import type { EnrollmentRepository } from '../../ports/learning-repository.js';
import type { LessonRepository } from '../../ports/lesson-repository.js';
import type { QuizRepository } from '../../ports/quiz-repository.js';
import { loadEnrolledQuiz } from '../learning/student-access.js';

export class ListMyAttemptsUseCase {
  constructor(
    private readonly quizzes: QuizRepository,
    private readonly lessons: LessonRepository,
    private readonly enrollments: EnrollmentRepository,
    private readonly attempts: AttemptRepository,
  ) {}

  async execute(
    studentId: string,
    quizId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: QuizAttempt[]; total: number }> {
    await loadEnrolledQuiz(this.quizzes, this.lessons, this.enrollments, studentId, quizId);
    return this.attempts.listByQuiz(quizId, studentId, page, pageSize);
  }
}

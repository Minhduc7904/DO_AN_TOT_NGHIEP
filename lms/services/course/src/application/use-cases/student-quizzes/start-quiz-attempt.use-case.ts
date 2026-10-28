import type { Clock, IdGenerator } from '@aiops-lms/common/ports';

import type { QuizAttempt } from '../../../domain/course.js';
import type { AttemptRepository } from '../../ports/attempt-repository.js';
import type { EnrollmentRepository } from '../../ports/learning-repository.js';
import type { LessonRepository } from '../../ports/lesson-repository.js';
import type { QuizRepository } from '../../ports/quiz-repository.js';
import { loadEnrolledQuiz } from '../learning/student-access.js';

export class StartQuizAttemptUseCase {
  constructor(
    private readonly quizzes: QuizRepository,
    private readonly lessons: LessonRepository,
    private readonly enrollments: EnrollmentRepository,
    private readonly attempts: AttemptRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  /** Tiếp tục lượt đang làm nếu có (`resumed`), nếu không thì mở lượt mới. */
  async execute(
    studentId: string,
    quizId: string,
  ): Promise<{ attempt: QuizAttempt; resumed: boolean }> {
    await loadEnrolledQuiz(this.quizzes, this.lessons, this.enrollments, studentId, quizId);

    const existing = await this.attempts.findInProgress(quizId, studentId);
    if (existing) return { attempt: existing, resumed: true };

    const created = await this.attempts.create({
      id: this.ids.next(),
      quizId,
      studentId,
      startedAt: this.clock.now(),
    });
    if (created) return { attempt: created, resumed: false };

    // Hai yêu cầu đồng thời: bên thua đua nhận lại lượt do bên thắng tạo.
    const raced = await this.attempts.findInProgress(quizId, studentId);
    if (!raced) throw new Error('Không tạo được lượt làm bài');
    return { attempt: raced, resumed: true };
  }
}

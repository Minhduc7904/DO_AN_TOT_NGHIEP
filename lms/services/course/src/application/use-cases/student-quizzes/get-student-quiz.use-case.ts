import type { Quiz } from '../../../domain/course.js';
import type { EnrollmentRepository } from '../../ports/learning-repository.js';
import type { LessonRepository } from '../../ports/lesson-repository.js';
import type { QuizRepository } from '../../ports/quiz-repository.js';
import { loadEnrolledQuiz } from '../learning/student-access.js';

export class GetStudentQuizUseCase {
  constructor(
    private readonly quizzes: QuizRepository,
    private readonly lessons: LessonRepository,
    private readonly enrollments: EnrollmentRepository,
  ) {}

  /** Trả cây câu hỏi đầy đủ; presenter của học viên ẩn `is_correct`. */
  execute(studentId: string, quizId: string): Promise<Quiz> {
    return loadEnrolledQuiz(this.quizzes, this.lessons, this.enrollments, studentId, quizId);
  }
}

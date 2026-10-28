import type { QuizSummary } from '../../../domain/course.js';
import type { EnrollmentRepository } from '../../ports/learning-repository.js';
import type { LessonRepository } from '../../ports/lesson-repository.js';
import type { QuizRepository } from '../../ports/quiz-repository.js';
import { loadEnrolledLesson } from '../learning/student-access.js';

export class ListStudentLessonQuizzesUseCase {
  constructor(
    private readonly lessons: LessonRepository,
    private readonly enrollments: EnrollmentRepository,
    private readonly quizzes: QuizRepository,
  ) {}

  /** Chỉ quiz `PUBLISHED`. */
  async execute(studentId: string, lessonId: string): Promise<QuizSummary[]> {
    await loadEnrolledLesson(this.lessons, this.enrollments, studentId, lessonId);
    return this.quizzes.listByLesson(lessonId, true);
  }
}

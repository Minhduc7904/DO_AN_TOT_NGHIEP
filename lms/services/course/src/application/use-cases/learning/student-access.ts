import { AppError } from '@aiops-lms/common/errors';

import type { Lesson, Quiz } from '../../../domain/course.js';
import { courseErrors } from '../../../domain/errors.js';
import type { EnrollmentRepository } from '../../ports/learning-repository.js';
import type { LessonRepository } from '../../ports/lesson-repository.js';
import type { QuizRepository } from '../../ports/quiz-repository.js';

export async function assertEnrolled(
  enrollments: EnrollmentRepository,
  courseId: string,
  studentId: string,
): Promise<void> {
  if (!(await enrollments.find(courseId, studentId))) throw courseErrors.studentNotEnrolled();
}

/** Bài học mà học viên đã ghi danh khóa chứa nó; 404 nếu bài học không tồn tại. */
export async function loadEnrolledLesson(
  lessons: LessonRepository,
  enrollments: EnrollmentRepository,
  studentId: string,
  lessonId: string,
): Promise<Lesson> {
  const lesson = await lessons.findById(lessonId);
  if (!lesson) throw AppError.notFound('Không tìm thấy bài học');
  await assertEnrolled(enrollments, lesson.courseId, studentId);
  return lesson;
}

/** Quiz đã xuất bản thuộc khóa học mà học viên đã ghi danh (quiz nháp coi như không tồn tại). */
export async function loadEnrolledQuiz(
  quizzes: QuizRepository,
  lessons: LessonRepository,
  enrollments: EnrollmentRepository,
  studentId: string,
  quizId: string,
): Promise<Quiz> {
  const quiz = await quizzes.findById(quizId);
  if (!quiz || quiz.status !== 'PUBLISHED') throw AppError.notFound('Không tìm thấy quiz');
  await loadEnrolledLesson(lessons, enrollments, studentId, quiz.lessonId);
  return quiz;
}

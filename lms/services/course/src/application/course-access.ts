import { AppError } from '@aiops-lms/common/errors';
import type { Principal } from '@aiops-lms/common/ports';

import { assertCanManageCourse } from '../domain/access.js';
import type { Course, Lesson, Quiz } from '../domain/course.js';
import type { CourseRepository } from './ports/course-repository.js';
import type { LessonRepository } from './ports/lesson-repository.js';
import type { QuizRepository } from './ports/quiz-repository.js';

/** Khóa học mà `principal` được quản lý; 404 nếu không tồn tại, 403 nếu không sở hữu. */
export async function loadManagedCourse(
  courses: CourseRepository,
  principal: Principal,
  courseId: string,
): Promise<Course> {
  const course = await courses.findById(courseId);
  if (!course) throw AppError.notFound('Không tìm thấy khóa học');
  assertCanManageCourse(principal, course);
  return course;
}

export async function loadManagedLesson(
  courses: CourseRepository,
  lessons: LessonRepository,
  principal: Principal,
  courseId: string,
  lessonId: string,
): Promise<{ course: Course; lesson: Lesson }> {
  const course = await loadManagedCourse(courses, principal, courseId);
  const lesson = await lessons.findInCourse(courseId, lessonId);
  if (!lesson) throw AppError.notFound('Không tìm thấy bài học');
  return { course, lesson };
}

export async function loadManagedQuiz(
  courses: CourseRepository,
  lessons: LessonRepository,
  quizzes: QuizRepository,
  principal: Principal,
  ids: { courseId: string; lessonId: string; quizId: string },
): Promise<Quiz> {
  await loadManagedLesson(courses, lessons, principal, ids.courseId, ids.lessonId);
  const quiz = await quizzes.findInLesson(ids.lessonId, ids.quizId);
  if (!quiz) throw AppError.notFound('Không tìm thấy quiz');
  return quiz;
}

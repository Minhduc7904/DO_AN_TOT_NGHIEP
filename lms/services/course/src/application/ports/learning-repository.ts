import type { Enrollment, LessonProgress } from '../../domain/course.js';

export const ENROLLMENT_REPOSITORY = Symbol('ENROLLMENT_REPOSITORY');
export const PROGRESS_REPOSITORY = Symbol('PROGRESS_REPOSITORY');

export interface NewEnrollment {
  id: string;
  courseId: string;
  studentId: string;
}

export interface EnrollmentRepository {
  /** `null` khi học viên đã ghi danh khóa học. */
  create(enrollment: NewEnrollment): Promise<Enrollment | null>;
  find(courseId: string, studentId: string): Promise<Enrollment | null>;
  listByStudent(
    studentId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: Enrollment[]; total: number }>;
}

export interface ProgressUpdate {
  id: string;
  lessonId: string;
  studentId: string;
  progressPercent: number;
  now: Date;
}

export interface ProgressRepository {
  /** Tiến độ không giảm; `completedAt` được đặt ở lần đầu đạt 100%. */
  upsert(update: ProgressUpdate): Promise<LessonProgress>;
  listByCourse(studentId: string, courseId: string): Promise<LessonProgress[]>;
}

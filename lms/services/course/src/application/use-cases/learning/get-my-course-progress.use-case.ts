import type { LessonProgress } from '../../../domain/course.js';
import type { EnrollmentRepository, ProgressRepository } from '../../ports/learning-repository.js';
import type { LessonRepository } from '../../ports/lesson-repository.js';
import { assertEnrolled } from './student-access.js';

export interface CourseProgress {
  courseId: string;
  totalLessons: number;
  completedLessons: number;
  /** Phần trăm bài học đã hoàn thành, làm tròn 2 chữ số thập phân. */
  percent: number;
  lessons: LessonProgress[];
}

export class GetMyCourseProgressUseCase {
  constructor(
    private readonly lessons: LessonRepository,
    private readonly enrollments: EnrollmentRepository,
    private readonly progress: ProgressRepository,
  ) {}

  async execute(studentId: string, courseId: string): Promise<CourseProgress> {
    await assertEnrolled(this.enrollments, courseId, studentId);
    const [lessons, progress] = await Promise.all([
      this.lessons.listByCourse(courseId),
      this.progress.listByCourse(studentId, courseId),
    ]);
    const completedLessons = progress.filter((item) => item.completedAt !== null).length;
    const percent =
      lessons.length === 0 ? 0 : Math.round((completedLessons / lessons.length) * 10000) / 100;
    return { courseId, totalLessons: lessons.length, completedLessons, percent, lessons: progress };
  }
}

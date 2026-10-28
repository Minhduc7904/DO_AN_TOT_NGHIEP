import type { Lesson } from '../../domain/course.js';
import type { MediaEffect } from './media-effects.js';

export const LESSON_REPOSITORY = Symbol('LESSON_REPOSITORY');

export interface NewLesson {
  id: string;
  courseId: string;
  title: string;
  contentMarkdown: string | null;
  /** Bỏ trống để thêm vào cuối khóa học. */
  displayOrder?: number | undefined;
}

export interface LessonPatch {
  title?: string | undefined;
  contentMarkdown?: string | null | undefined;
}

export interface LessonRepository {
  /** `null` khi `displayOrder` đã có trong khóa học. */
  create(lesson: NewLesson, effects?: readonly MediaEffect[]): Promise<Lesson | null>;
  findInCourse(courseId: string, lessonId: string): Promise<Lesson | null>;
  findById(lessonId: string): Promise<Lesson | null>;
  listByCourse(courseId: string): Promise<Lesson[]>;
  update(
    lessonId: string,
    patch: LessonPatch,
    effects?: readonly MediaEffect[],
  ): Promise<Lesson | null>;
  delete(lessonId: string, effects?: readonly MediaEffect[]): Promise<boolean>;
  /** Gán `displayOrder` 1..n theo thứ tự `orderedIds` (đã được use case kiểm tra đủ và đúng tập). */
  reorder(courseId: string, orderedIds: readonly string[]): Promise<Lesson[]>;
}

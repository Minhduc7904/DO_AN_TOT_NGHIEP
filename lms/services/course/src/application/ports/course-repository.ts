import type { Course, CourseStatus } from '../../domain/course.js';

export const COURSE_REPOSITORY = Symbol('COURSE_REPOSITORY');

export interface NewCourse {
  id: string;
  name: string;
  descriptionMarkdown: string | null;
  instructorId: string;
}

export interface CoursePatch {
  name?: string | undefined;
  descriptionMarkdown?: string | null | undefined;
  status?: CourseStatus | undefined;
}

export interface CourseFilter {
  status?: CourseStatus | undefined;
  /** Chỉ lấy khóa học của giảng viên này. */
  instructorId?: string | undefined;
  /** Tìm theo tên (không phân biệt hoa thường). */
  search?: string | undefined;
}

export interface CourseCounts {
  total: number;
  draft: number;
  published: number;
  archived: number;
}

export interface CourseRepository {
  create(course: NewCourse): Promise<Course>;
  findById(id: string): Promise<Course | null>;
  update(id: string, patch: CoursePatch): Promise<Course | null>;
  delete(id: string): Promise<boolean>;
  list(
    filter: CourseFilter,
    page: number,
    pageSize: number,
  ): Promise<{ items: Course[]; total: number }>;
  count(filter: CourseFilter): Promise<CourseCounts>;
  /** Keyset theo `id` tăng dần cho export streaming: lấy tối đa `limit` bản ghi sau `afterId`. */
  listAfter(filter: CourseFilter, afterId: string | null, limit: number): Promise<Course[]>;
}

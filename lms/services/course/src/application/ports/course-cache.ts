import type { Course } from '../../domain/course.js';

export abstract class CourseCache {
  abstract getItem(id: string): Promise<Course | null>;
  abstract setItem(course: Course): Promise<void>;
  abstract getList(limit: number): Promise<{ items: Course[] | null; version: string }>;
  abstract setList(limit: number, items: Course[], version: string): Promise<void>;
  abstract invalidateLists(): Promise<void>;
}

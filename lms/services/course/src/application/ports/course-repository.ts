import type { Course } from '../../domain/course.js';

export abstract class CourseRepository {
  abstract create(title: string): Promise<Course>;
  abstract findById(id: string): Promise<Course | null>;
  abstract list(limit: number): Promise<Course[]>;
}

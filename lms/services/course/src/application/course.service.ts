import type { Course } from '../domain/course.js';
import { CourseRepository } from './ports/course-repository.js';

export class CourseService {
  constructor(private readonly repository: CourseRepository) {}

  create(title: string): Promise<Course> {
    return this.repository.create(title);
  }

  findById(id: string): Promise<Course | null> {
    return this.repository.findById(id);
  }

  async list(limit: number): Promise<{ items: Course[] }> {
    return { items: await this.repository.list(limit) };
  }
}

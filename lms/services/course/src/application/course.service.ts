import type { Course } from '../domain/course.js';
import { CourseRepository } from './ports/course-repository.js';
import { CourseCache } from './ports/course-cache.js';

export class CourseService {
  constructor(
    private readonly repository: CourseRepository,
    private readonly cache?: CourseCache,
  ) {}

  async create(title: string): Promise<Course> {
    const course = await this.repository.create(title);
    if (this.cache) {
      await Promise.allSettled([this.cache.setItem(course), this.cache.invalidateLists()]);
    }
    return course;
  }

  async findById(id: string): Promise<Course | null> {
    const cached = await this.cache?.getItem(id).catch(() => null);
    if (cached) return cached;
    const course = await this.repository.findById(id);
    if (course) await this.cache?.setItem(course).catch(() => undefined);
    return course;
  }

  async list(limit: number): Promise<{ items: Course[] }> {
    const cached = await this.cache?.getList(limit).catch(() => null);
    if (cached?.items) return { items: cached.items };
    const items = await this.repository.list(limit);
    if (cached) await this.cache?.setList(limit, items, cached.version).catch(() => undefined);
    return { items };
  }
}

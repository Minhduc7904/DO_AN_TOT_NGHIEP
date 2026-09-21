import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

import { CourseRepository } from '../../application/ports/course-repository.js';
import type { Course } from '../../domain/course.js';

interface CourseRow {
  id: string;
  title: string;
  created_at: Date;
}

@Injectable()
export class PostgresCourseRepository extends CourseRepository implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(config: ConfigService) {
    super();
    this.pool = new Pool({ connectionString: config.getOrThrow<string>('COURSE_DATABASE_URL') });
  }

  async create(title: string): Promise<Course> {
    const result = await this.pool.query<CourseRow>(
      'INSERT INTO courses (id, title) VALUES ($1, $2) RETURNING id, title, created_at',
      [randomUUID(), title],
    );
    return this.toCourse(result.rows[0]!);
  }

  async findById(id: string): Promise<Course | null> {
    const result = await this.pool.query<CourseRow>(
      'SELECT id, title, created_at FROM courses WHERE id = $1',
      [id],
    );
    return result.rows[0] ? this.toCourse(result.rows[0]) : null;
  }

  async list(limit: number): Promise<Course[]> {
    const result = await this.pool.query<CourseRow>(
      'SELECT id, title, created_at FROM courses ORDER BY created_at, id LIMIT $1',
      [limit],
    );
    return result.rows.map((row) => this.toCourse(row));
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  private toCourse(row: CourseRow): Course {
    return { id: row.id, title: row.title, created_at: row.created_at.toISOString() };
  }
}

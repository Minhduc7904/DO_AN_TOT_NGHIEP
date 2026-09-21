import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

import { CourseRepository } from '../../application/ports/course-repository.js';
import { CourseDependencyError } from '../../application/course-dependency-error.js';
import type { Course } from '../../domain/course.js';
import { observeDependency } from '../telemetry/dependency-telemetry.js';

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
    this.pool = new Pool({
      connectionString: config.getOrThrow<string>('COURSE_DATABASE_URL'),
      connectionTimeoutMillis: 1_000,
      query_timeout: 2_000,
    });
  }

  async create(title: string): Promise<Course> {
    const result = await this.query<CourseRow>(
      'create',
      'INSERT INTO courses (id, title) VALUES ($1, $2) RETURNING id, title, created_at',
      [randomUUID(), title],
    );
    return this.toCourse(result.rows[0]!);
  }

  async findById(id: string): Promise<Course | null> {
    const result = await this.query<CourseRow>(
      'get',
      'SELECT id, title, created_at FROM courses WHERE id = $1',
      [id],
    );
    return result.rows[0] ? this.toCourse(result.rows[0]) : null;
  }

  async list(limit: number): Promise<Course[]> {
    const result = await this.query<CourseRow>(
      'list',
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

  private query<Row extends import('pg').QueryResultRow>(
    operation: 'create' | 'get' | 'list',
    statement: string,
    values: unknown[],
  ): Promise<import('pg').QueryResult<Row>> {
    return observeDependency('course-postgres', operation, async () => {
      try {
        return await this.pool.query<Row>(statement, values);
      } catch (error) {
        const code = error instanceof Error && 'code' in error ? String(error.code) : '';
        const timedOut =
          code === '57014' ||
          code === 'ETIMEDOUT' ||
          (error instanceof Error && /timeout|timed out/iu.test(error.message));
        throw new CourseDependencyError('course-postgres', timedOut ? 'timeout' : 'unavailable');
      }
    });
  }
}

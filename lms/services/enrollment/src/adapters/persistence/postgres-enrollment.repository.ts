import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

import { EnrollmentConflictError } from '../../application/enrollment-conflict-error.js';
import { EnrollmentDependencyError } from '../../application/enrollment-dependency-error.js';
import {
  EnrollmentRepository,
  type EnrollmentListFilter,
} from '../../application/ports/enrollment-repository.js';
import type { Enrollment } from '../../domain/enrollment.js';
import { observeDependency } from '../telemetry/dependency-telemetry.js';

interface EnrollmentRow {
  id: string;
  principal_id: string;
  course_id: string;
  created_at: Date;
}

@Injectable()
export class PostgresEnrollmentRepository extends EnrollmentRepository implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(config: ConfigService) {
    super();
    this.pool = new Pool({
      connectionString: config.getOrThrow<string>('ENROLLMENT_DATABASE_URL'),
      connectionTimeoutMillis: 1_000,
      query_timeout: 2_000,
    });
  }

  async create(principalId: string, courseId: string): Promise<Enrollment> {
    try {
      const result = await this.query<EnrollmentRow>(
        'create',
        `INSERT INTO enrollments (id, principal_id, course_id)
         VALUES ($1, $2, $3)
         RETURNING id, principal_id, course_id, created_at`,
        [randomUUID(), principalId, courseId],
      );
      return this.toEnrollment(result.rows[0]!);
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? String(error.code) : '';
      if (code === '23505') throw new EnrollmentConflictError(principalId, courseId);
      throw error;
    }
  }

  async findByPrincipalAndCourse(
    principalId: string,
    courseId: string,
  ): Promise<Enrollment | null> {
    const result = await this.query<EnrollmentRow>(
      'get',
      'SELECT id, principal_id, course_id, created_at FROM enrollments WHERE principal_id = $1 AND course_id = $2',
      [principalId, courseId],
    );
    return result.rows[0] ? this.toEnrollment(result.rows[0]) : null;
  }

  async list(filter: EnrollmentListFilter, limit: number): Promise<Enrollment[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (filter.principalId) {
      values.push(filter.principalId);
      conditions.push(`principal_id = $${values.length}`);
    }
    if (filter.courseId) {
      values.push(filter.courseId);
      conditions.push(`course_id = $${values.length}`);
    }
    values.push(limit);
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await this.query<EnrollmentRow>(
      'list',
      `SELECT id, principal_id, course_id, created_at FROM enrollments ${where}
       ORDER BY created_at, id LIMIT $${values.length}`,
      values,
    );
    return result.rows.map((row) => this.toEnrollment(row));
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  private toEnrollment(row: EnrollmentRow): Enrollment {
    return {
      id: row.id,
      principal_id: row.principal_id,
      course_id: row.course_id,
      created_at: row.created_at.toISOString(),
    };
  }

  private query<Row extends import('pg').QueryResultRow>(
    operation: 'create' | 'get' | 'list',
    statement: string,
    values: unknown[],
  ): Promise<import('pg').QueryResult<Row>> {
    return observeDependency('enrollment-postgres', operation, async () => {
      try {
        return await this.pool.query<Row>(statement, values);
      } catch (error) {
        const code = error instanceof Error && 'code' in error ? String(error.code) : '';
        if (code === '23505') throw error;
        const timedOut =
          code === '57014' ||
          code === 'ETIMEDOUT' ||
          (error instanceof Error && /timeout|timed out/iu.test(error.message));
        throw new EnrollmentDependencyError(
          'enrollment-postgres',
          timedOut ? 'timeout' : 'unavailable',
        );
      }
    });
  }
}

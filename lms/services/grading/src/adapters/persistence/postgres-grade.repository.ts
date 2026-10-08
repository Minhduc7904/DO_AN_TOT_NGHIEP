import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

import { GradeConflictError } from '../../application/grade-conflict-error.js';
import { GradingDependencyError } from '../../application/grading-dependency-error.js';
import {
  GradeRepository,
  type CreateGradeRecord,
} from '../../application/ports/grade-repository.js';
import type { Grade } from '../../domain/grade.js';
import { observeDependency } from '../telemetry/dependency-telemetry.js';

interface GradeRow {
  id: string;
  submission_id: string;
  principal_id: string;
  course_id: string;
  score: string;
  completed_at: Date;
}

const GRADE_COLUMNS = 'id, submission_id, principal_id, course_id, score, completed_at';

@Injectable()
export class PostgresGradeRepository extends GradeRepository implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(config: ConfigService) {
    super();
    this.pool = new Pool({
      connectionString: config.getOrThrow<string>('GRADING_DATABASE_URL'),
      connectionTimeoutMillis: 1_000,
      query_timeout: 2_000,
    });
  }

  async create(input: CreateGradeRecord): Promise<Grade> {
    const result = await this.query<GradeRow>(
      'create',
      `INSERT INTO grades (id, submission_id, principal_id, course_id, score)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${GRADE_COLUMNS}`,
      [input.id, input.submissionId, input.principalId, input.courseId, input.score],
      input.submissionId,
    );
    return this.toGrade(result.rows[0]!);
  }

  async findById(id: string): Promise<Grade | null> {
    const result = await this.query<GradeRow>(
      'get',
      `SELECT ${GRADE_COLUMNS} FROM grades WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? this.toGrade(result.rows[0]) : null;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  private toGrade(row: GradeRow): Grade {
    return {
      completed_at: row.completed_at.toISOString(),
      course_id: row.course_id,
      id: row.id,
      principal_id: row.principal_id,
      score: Number(row.score),
      submission_id: row.submission_id,
    };
  }

  private query<Row extends import('pg').QueryResultRow>(
    operation: 'create' | 'get',
    statement: string,
    values: unknown[],
    conflictSubmissionId?: string,
  ): Promise<import('pg').QueryResult<Row>> {
    return observeDependency('grading-postgres', operation, async () => {
      try {
        return await this.pool.query<Row>(statement, values);
      } catch (error) {
        const code = error instanceof Error && 'code' in error ? String(error.code) : '';
        if (code === '23505' && conflictSubmissionId !== undefined) {
          throw new GradeConflictError(conflictSubmissionId);
        }
        const timedOut =
          code === '57014' ||
          code === 'ETIMEDOUT' ||
          (error instanceof Error && /timeout|timed out/iu.test(error.message));
        throw new GradingDependencyError('grading-postgres', timedOut ? 'timeout' : 'unavailable');
      }
    });
  }
}

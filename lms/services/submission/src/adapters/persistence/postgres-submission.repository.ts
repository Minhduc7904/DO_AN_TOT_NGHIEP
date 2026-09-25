import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

import { SubmissionDependencyError } from '../../application/submission-dependency-error.js';
import {
  SubmissionRepository,
  type CreateSubmissionRecord,
} from '../../application/ports/submission-repository.js';
import type { Submission } from '../../domain/submission.js';
import { observeDependency } from '../telemetry/dependency-telemetry.js';

interface SubmissionRow {
  id: string;
  principal_id: string;
  course_id: string;
  storage_object_key: string;
  submitted_at: Date;
}

@Injectable()
export class PostgresSubmissionRepository extends SubmissionRepository implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(config: ConfigService) {
    super();
    this.pool = new Pool({
      connectionString: config.getOrThrow<string>('SUBMISSION_DATABASE_URL'),
      connectionTimeoutMillis: 1_000,
      query_timeout: 2_000,
    });
  }

  async create(input: CreateSubmissionRecord): Promise<Submission> {
    const result = await this.query<SubmissionRow>(
      'create',
      `INSERT INTO submissions (id, principal_id, course_id, storage_object_key)
       VALUES ($1, $2, $3, $4)
       RETURNING id, principal_id, course_id, storage_object_key, submitted_at`,
      [input.id, input.principalId, input.courseId, input.storageObjectKey],
    );
    return this.toSubmission(result.rows[0]!);
  }

  async findById(id: string): Promise<Submission | null> {
    const result = await this.query<SubmissionRow>(
      'get',
      `SELECT id, principal_id, course_id, storage_object_key, submitted_at
       FROM submissions WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? this.toSubmission(result.rows[0]) : null;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  private toSubmission(row: SubmissionRow): Submission {
    return {
      course_id: row.course_id,
      id: row.id,
      principal_id: row.principal_id,
      storage_object_key: row.storage_object_key,
      submitted_at: row.submitted_at.toISOString(),
    };
  }

  private query<Row extends import('pg').QueryResultRow>(
    operation: 'create' | 'get',
    statement: string,
    values: unknown[],
  ): Promise<import('pg').QueryResult<Row>> {
    return observeDependency('submission-postgres', operation, async () => {
      try {
        return await this.pool.query<Row>(statement, values);
      } catch (error) {
        const code = error instanceof Error && 'code' in error ? String(error.code) : '';
        const timedOut =
          code === '57014' ||
          code === 'ETIMEDOUT' ||
          (error instanceof Error && /timeout|timed out/iu.test(error.message));
        throw new SubmissionDependencyError(
          'submission-postgres',
          timedOut ? 'timeout' : 'unavailable',
        );
      }
    });
  }
}

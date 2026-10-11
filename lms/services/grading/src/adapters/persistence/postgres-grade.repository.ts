import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

import { GradeConflictError } from '../../application/grade-conflict-error.js';
import { GradingDependencyError } from '../../application/grading-dependency-error.js';
import type { GradeEventPublishErrorCode } from '../../application/grade-event-publish-error.js';
import {
  GradeRepository,
  type CreateGradeRecord,
} from '../../application/ports/grade-repository.js';
import { GradePublicationRepository } from '../../application/ports/grade-publication-repository.js';
import type { Grade } from '../../domain/grade.js';
import type { GradeCompletedSnapshot } from '../../domain/grade-completed-snapshot.js';
import { observeDependency } from '../telemetry/dependency-telemetry.js';

interface GradeRow {
  id: string;
  submission_id: string;
  principal_id: string;
  course_id: string;
  score: string;
  completed_at: Date;
}

interface PendingGradeRow extends GradeRow {
  event_id: string;
}

const GRADE_COLUMNS = 'id, submission_id, principal_id, course_id, score, completed_at';

type DatabaseOperation =
  | 'create'
  | 'get'
  | 'list_pending'
  | 'count_pending'
  | 'record_attempt'
  | 'mark_published'
  | 'mark_failed';

@Injectable()
export class PostgresGradeRepository
  extends GradeRepository
  implements GradePublicationRepository, OnApplicationShutdown
{
  private readonly logger = new Logger(PostgresGradeRepository.name);
  private readonly pool: Pool;

  constructor(config: ConfigService) {
    super();
    this.pool = new Pool({
      connectionString: config.getOrThrow<string>('GRADING_DATABASE_URL'),
      connectionTimeoutMillis: 1_000,
      query_timeout: 2_000,
    });
    // Client idle bị đóng/ngắt kết nối làm Pool phát 'error'; thiếu listener thì process crash.
    // Chỉ log mã lỗi, không log message hay connection string để tránh lộ credential.
    this.pool.on('error', (error: Error & { code?: string }) => {
      this.logger.warn(`Idle PostgreSQL client lỗi (code=${error.code ?? 'unknown'})`);
    });
  }

  async create(input: CreateGradeRecord): Promise<Grade> {
    const result = await this.query<GradeRow>(
      'create',
      `INSERT INTO grades (id, event_id, submission_id, principal_id, course_id, score)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${GRADE_COLUMNS}`,
      [input.id, input.eventId, input.submissionId, input.principalId, input.courseId, input.score],
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

  async findPending(limit: number): Promise<GradeCompletedSnapshot[]> {
    const result = await this.query<PendingGradeRow>(
      'list_pending',
      `SELECT ${GRADE_COLUMNS}, event_id FROM grades
        WHERE publish_status = 'pending'
        ORDER BY completed_at, id
        LIMIT $1`,
      [limit],
    );
    return result.rows.map((row) => ({
      completedAt: row.completed_at.toISOString(),
      courseId: row.course_id,
      eventId: row.event_id,
      gradeId: row.id,
      principalId: row.principal_id,
      score: Number(row.score),
      submissionId: row.submission_id,
    }));
  }

  async countPending(): Promise<number> {
    const result = await this.query<{ total: number }>(
      'count_pending',
      "SELECT count(*)::int AS total FROM grades WHERE publish_status = 'pending'",
      [],
    );
    return result.rows[0]?.total ?? 0;
  }

  async recordAttempt(eventId: string): Promise<boolean> {
    const result = await this.query(
      'record_attempt',
      `UPDATE grades SET publish_attempts = publish_attempts + 1
        WHERE event_id = $1 AND publish_status = 'pending'`,
      [eventId],
    );
    return result.rowCount === 1;
  }

  async markPublished(eventId: string): Promise<void> {
    await this.query(
      'mark_published',
      `UPDATE grades
          SET publish_status = 'published', published_at = now(), last_publish_error_code = NULL
        WHERE event_id = $1 AND publish_status = 'pending'`,
      [eventId],
    );
  }

  async markFailed(eventId: string, code: GradeEventPublishErrorCode): Promise<void> {
    await this.query(
      'mark_failed',
      `UPDATE grades SET last_publish_error_code = $2
        WHERE event_id = $1 AND publish_status = 'pending'`,
      [eventId, code],
    );
  }

  async onApplicationShutdown(): Promise<void> {
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
    operation: DatabaseOperation,
    statement: string,
    values: unknown[],
    conflictSubmissionId?: string,
  ): Promise<import('pg').QueryResult<Row>> {
    return observeDependency('grading-postgres', operation, async () => {
      try {
        return await this.pool.query<Row>(statement, values);
      } catch (error) {
        const code = error instanceof Error && 'code' in error ? String(error.code) : '';
        // Chỉ unique(submission_id) là xung đột nghiệp vụ; vi phạm unique khác (id, event_id) là lỗi hệ thống.
        const constraint =
          error instanceof Error && 'constraint' in error ? String(error.constraint) : '';
        if (
          code === '23505' &&
          constraint === 'grades_submission_id_key' &&
          conflictSubmissionId !== undefined
        ) {
          throw new GradeConflictError(conflictSubmissionId);
        }
        // pg không gắn code ổn định cho connection/query timeout phía client (chỉ có message
        // "timeout exceeded when trying to connect" / "Query read timeout"), nên giữ nhận diện bằng message.
        const timedOut =
          code === '57014' ||
          code === 'ETIMEDOUT' ||
          (error instanceof Error && /timeout|timed out/iu.test(error.message));
        throw new GradingDependencyError('grading-postgres', timedOut ? 'timeout' : 'unavailable');
      }
    });
  }
}

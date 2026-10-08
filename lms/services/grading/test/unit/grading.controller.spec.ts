import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { GradingController } from '../../src/adapters/http/grading/grading.controller.js';
import { HttpExceptionFilter } from '../../src/adapters/http/http-exception.filter.js';
import { GradeConflictError } from '../../src/application/grade-conflict-error.js';
import { GradingDependencyError } from '../../src/application/grading-dependency-error.js';
import { GradingService } from '../../src/application/grading.service.js';
import type { GradeRepository } from '../../src/application/ports/grade-repository.js';
import type { SubmissionClient } from '../../src/application/ports/submission-client.js';
import type { Grade } from '../../src/domain/grade.js';

describe('Grading HTTP contract', () => {
  const seed: Grade = {
    completed_at: '2026-08-27T10:15:00.000Z',
    course_id: 'course-001',
    id: '7d1f3a52-0c4e-4b8a-9d36-5a2e8f10c001',
    principal_id: 'student-001',
    score: 85.5,
    submission_id: 'submission-001',
  };
  const instructor = { 'x-principal-id': 'instructor-001', 'x-principal-role': 'instructor' };
  const student = { 'x-principal-id': 'student-001', 'x-principal-role': 'student' };
  const otherStudent = { 'x-principal-id': 'student-002', 'x-principal-role': 'student' };
  let rows: Grade[];
  let submissionIds: string[];
  let submissionFailure: GradingDependencyError | undefined;
  let app: INestApplication;

  beforeEach(async () => {
    rows = [seed];
    submissionIds = ['submission-001', 'submission-002'];
    submissionFailure = undefined;
    const repository: GradeRepository = {
      create: async (input) => {
        if (rows.some((row) => row.submission_id === input.submissionId)) {
          throw new GradeConflictError(input.submissionId);
        }
        const row: Grade = {
          completed_at: '2026-10-08T00:00:00.000Z',
          course_id: input.courseId,
          id: input.id,
          principal_id: input.principalId,
          score: input.score,
          submission_id: input.submissionId,
        };
        rows.push(row);
        return row;
      },
      findById: async (id) => rows.find((row) => row.id === id) ?? null,
    };
    const submissionClient: SubmissionClient = {
      getById: async (id) => {
        if (submissionFailure) throw submissionFailure;
        return submissionIds.includes(id)
          ? { course_id: 'course-001', id, principal_id: 'student-001' }
          : null;
      },
    };
    const module = await Test.createTestingModule({
      controllers: [GradingController],
      providers: [
        {
          provide: GradingService,
          useFactory: (): GradingService => new GradingService(repository, submissionClient),
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates a grade and returns only the canonical representation', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/grades')
      .set(instructor)
      .send({ score: 92.5, submission_id: 'submission-002' })
      .expect(201)
      .expect(({ body }) => {
        expect(Object.keys(body).sort()).toEqual(['completed_at', 'id', 'score', 'submission_id']);
        expect(body).toMatchObject({ score: 92.5, submission_id: 'submission-002' });
      });
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ course_id: 'course-001', principal_id: 'student-001' });
  });

  it('requires a complete principal and the instructor role', async () => {
    const body = { score: 90, submission_id: 'submission-002' };
    await request(app.getHttpServer())
      .post('/api/v1/grades')
      .send(body)
      .expect(401)
      .expect(({ body: error }) => expect(error).toMatchObject({ code: 'UNAUTHORIZED' }));
    await request(app.getHttpServer())
      .post('/api/v1/grades')
      .set('x-principal-id', 'instructor-001')
      .send(body)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/grades')
      .set(student)
      .send(body)
      .expect(403)
      .expect(({ body: error }) => expect(error).toMatchObject({ code: 'FORBIDDEN' }));
    await request(app.getHttpServer())
      .post('/api/v1/grades')
      .set({ 'x-principal-id': 'admin-001', 'x-principal-role': 'admin' })
      .send(body)
      .expect(403);
    expect(rows).toEqual([seed]);
  });

  it.each([
    ['negative score', { score: -1, submission_id: 'submission-002' }],
    ['score above 100', { score: 100.01, submission_id: 'submission-002' }],
    ['non-numeric score', { score: 'NaN', submission_id: 'submission-002' }],
    ['null score', { score: null, submission_id: 'submission-002' }],
    ['missing score', { submission_id: 'submission-002' }],
    ['missing submission_id', { score: 90 }],
    ['blank submission_id', { score: 90, submission_id: '   ' }],
    ['oversized submission_id', { score: 90, submission_id: 'x'.repeat(201) }],
    ['extra field', { extra: true, score: 90, submission_id: 'submission-002' }],
  ])('rejects %s with VALIDATION_ERROR', async (_name, payload) => {
    await request(app.getHttpServer())
      .post('/api/v1/grades')
      .set(instructor)
      .send(payload)
      .expect(400)
      .expect(({ body }) => expect(body).toMatchObject({ code: 'VALIDATION_ERROR' }));
    expect(rows).toEqual([seed]);
  });

  it('accepts the inclusive score boundaries', async () => {
    submissionIds.push('submission-003');
    await request(app.getHttpServer())
      .post('/api/v1/grades')
      .set(instructor)
      .send({ score: 0, submission_id: 'submission-002' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/grades')
      .set(instructor)
      .send({ score: 100, submission_id: 'submission-003' })
      .expect(201);
  });

  it('maps a missing Submission to 404 and a duplicate grade to 409', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/grades')
      .set(instructor)
      .send({ score: 90, submission_id: 'missing' })
      .expect(404)
      .expect(({ body }) =>
        expect(body).toMatchObject({ code: 'NOT_FOUND', message: 'Submission không tồn tại' }),
      );
    await request(app.getHttpServer())
      .post('/api/v1/grades')
      .set(instructor)
      .send({ score: 90, submission_id: 'submission-001' })
      .expect(409)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          code: 'CONFLICT',
          details: null,
          message: 'Submission đã có grade hoàn tất',
        }),
      );
    expect(rows).toEqual([seed]);
  });

  it('maps Submission dependency failures to canonical 503 and 504 envelopes', async () => {
    const payload = { score: 90, submission_id: 'submission-002' };
    submissionFailure = new GradingDependencyError('grading-submission', 'unavailable');
    await request(app.getHttpServer())
      .post('/api/v1/grades')
      .set(instructor)
      .send(payload)
      .expect(503)
      .expect(({ body }) => expect(body).toMatchObject({ code: 'DEPENDENCY_UNAVAILABLE' }));
    submissionFailure = new GradingDependencyError('grading-submission', 'timeout');
    await request(app.getHttpServer())
      .post('/api/v1/grades')
      .set(instructor)
      .send(payload)
      .expect(504)
      .expect(({ body }) => expect(body).toMatchObject({ code: 'DEPENDENCY_TIMEOUT' }));
  });

  it('lets the owner and any instructor read a grade but protects another student', async () => {
    const path = `/api/v1/grades/${seed.id}`;
    const expected = {
      completed_at: seed.completed_at,
      id: seed.id,
      score: 85.5,
      submission_id: 'submission-001',
    };
    await request(app.getHttpServer())
      .get(path)
      .set(student)
      .expect(200)
      .expect(({ body }) => expect(body).toEqual(expected));
    await request(app.getHttpServer())
      .get(path)
      .set(instructor)
      .expect(200)
      .expect(({ body }) => expect(body).toEqual(expected));
    await request(app.getHttpServer())
      .get(path)
      .set(otherStudent)
      .expect(403)
      .expect(({ body }) => expect(body).toMatchObject({ code: 'FORBIDDEN' }));
    await request(app.getHttpServer()).get(path).expect(401);
  });

  it('returns 404 for unknown or malformed grade IDs', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/grades/11111111-1111-4111-8111-111111111111')
      .set(instructor)
      .expect(404)
      .expect(({ body }) => expect(body).toMatchObject({ code: 'NOT_FOUND' }));
    await request(app.getHttpServer()).get('/api/v1/grades/not-a-uuid').set(instructor).expect(404);
  });

  it('does not expose update, delete or list routes', async () => {
    await request(app.getHttpServer()).get('/api/v1/grades').set(instructor).expect(404);
    await request(app.getHttpServer())
      .put(`/api/v1/grades/${seed.id}`)
      .set(instructor)
      .send({ score: 1 })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/v1/grades/${seed.id}`)
      .set(instructor)
      .expect(404);
  });
});

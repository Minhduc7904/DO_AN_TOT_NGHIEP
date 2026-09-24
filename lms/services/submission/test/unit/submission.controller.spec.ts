import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { SubmissionController } from '../../src/adapters/http/submission/submission.controller.js';
import { HttpExceptionFilter } from '../../src/adapters/http/http-exception.filter.js';
import { SubmissionService } from '../../src/application/submission.service.js';
import { CourseClient } from '../../src/application/ports/course-client.js';
import { EnrollmentClient } from '../../src/application/ports/enrollment-client.js';
import { StorageClient } from '../../src/application/ports/storage-client.js';
import { SubmissionRepository } from '../../src/application/ports/submission-repository.js';
import type { Submission } from '../../src/domain/submission.js';

describe('Submission HTTP contract', () => {
  const seed: Submission = {
    course_id: 'course-001',
    id: 'submission-001',
    principal_id: 'student-001',
    storage_object_key: 'submissions/submission-001',
    submitted_at: '2026-08-27T10:10:00.000Z',
  };
  const student = { 'x-principal-id': 'student-001', 'x-principal-role': 'student' };
  let rows: Submission[];
  let courseExists: boolean;
  let enrolled: boolean;
  let app: INestApplication;

  beforeEach(async () => {
    rows = [seed];
    courseExists = true;
    enrolled = true;
    const repository: SubmissionRepository = {
      create: async (input) => {
        const row: Submission = {
          course_id: input.courseId,
          id: input.id,
          principal_id: input.principalId,
          storage_object_key: input.storageObjectKey,
          submitted_at: '2026-09-24T00:00:00.000Z',
        };
        rows.push(row);
        return row;
      },
      findById: async (id) => rows.find((row) => row.id === id) ?? null,
    };
    const courseClient: CourseClient = { exists: async () => courseExists };
    const enrollmentClient: EnrollmentClient = { isEnrolled: async () => enrolled };
    const storageClient: StorageClient = { store: async () => undefined };
    const module = await Test.createTestingModule({
      controllers: [SubmissionController],
      providers: [
        {
          provide: SubmissionService,
          useFactory: (): SubmissionService =>
            new SubmissionService(repository, courseClient, enrollmentClient, storageClient),
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

  it('creates a Submission for an enrolled student', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/submissions')
      .set(student)
      .send({ content: 'answer', course_id: 'course-001' })
      .expect(201)
      .expect(({ body }) =>
        expect(body).toMatchObject({ course_id: 'course-001', principal_id: 'student-001' }),
      );
  });

  it('validates principal, role and payload', async () => {
    await request(app.getHttpServer()).post('/api/v1/submissions').send({}).expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/submissions')
      .set('x-principal-id', 'instructor-001')
      .set('x-principal-role', 'instructor')
      .send({ content: 'answer', course_id: 'course-001' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/submissions')
      .set(student)
      .send({ course_id: 'course-001' })
      .expect(400)
      .expect(({ body }) => expect(body).toMatchObject({ code: 'VALIDATION_ERROR' }));
  });

  it('maps invalid Course and Enrollment to canonical errors', async () => {
    courseExists = false;
    await request(app.getHttpServer())
      .post('/api/v1/submissions')
      .set(student)
      .send({ content: 'answer', course_id: 'missing' })
      .expect(404);
    courseExists = true;
    enrolled = false;
    await request(app.getHttpServer())
      .post('/api/v1/submissions')
      .set(student)
      .send({ content: 'answer', course_id: 'course-001' })
      .expect(403)
      .expect(({ body }) => expect(body).toMatchObject({ code: 'FORBIDDEN' }));
  });

  it('supports owner/instructor/internal reads and protects another student', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/submissions/submission-001')
      .set(student)
      .expect(200)
      .expect(({ body }) => expect(body).toEqual(seed));
    await request(app.getHttpServer())
      .get('/api/v1/submissions/submission-001')
      .set('x-principal-id', 'student-002')
      .set('x-principal-role', 'student')
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/submissions/submission-001')
      .set('x-principal-id', 'instructor-001')
      .set('x-principal-role', 'instructor')
      .expect(200);
    await request(app.getHttpServer()).get('/api/v1/submissions/submission-001').expect(200);
    await request(app.getHttpServer()).get('/api/v1/submissions/missing').expect(404);
  });
});

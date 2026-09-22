import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { EnrollmentController } from '../../src/adapters/http/enrollment/enrollment.controller.js';
import { HttpExceptionFilter } from '../../src/adapters/http/http-exception.filter.js';
import { EnrollmentConflictError } from '../../src/application/enrollment-conflict-error.js';
import { EnrollmentService } from '../../src/application/enrollment.service.js';
import { CourseClient } from '../../src/application/ports/course-client.js';
import { EnrollmentRepository } from '../../src/application/ports/enrollment-repository.js';
import type { Enrollment } from '../../src/domain/enrollment.js';

describe('Enrollment HTTP contract', () => {
  const seed: Enrollment = {
    course_id: 'course-001',
    created_at: '2026-08-27T10:05:00.000Z',
    id: 'enrollment-001',
    principal_id: 'student-001',
  };
  const student = { 'x-principal-id': 'student-001', 'x-principal-role': 'student' };
  const instructor = { 'x-principal-id': 'instructor-001', 'x-principal-role': 'instructor' };
  let rows: Enrollment[];
  let courseExists: boolean;
  let app: INestApplication;

  async function createApp(): Promise<INestApplication> {
    const repository: EnrollmentRepository = {
      create: async (principalId, courseId) => {
        if (rows.some((row) => row.principal_id === principalId && row.course_id === courseId)) {
          throw new EnrollmentConflictError(principalId, courseId);
        }
        const enrollment: Enrollment = {
          course_id: courseId,
          created_at: new Date().toISOString(),
          id: 'enrollment-002',
          principal_id: principalId,
        };
        rows.push(enrollment);
        return enrollment;
      },
      findByPrincipalAndCourse: async (principalId, courseId) =>
        rows.find((row) => row.principal_id === principalId && row.course_id === courseId) ?? null,
      list: async (filter) =>
        rows.filter(
          (row) =>
            (!filter.principalId || row.principal_id === filter.principalId) &&
            (!filter.courseId || row.course_id === filter.courseId),
        ),
    };
    const courseClient: CourseClient = { exists: async () => courseExists };
    const module = await Test.createTestingModule({
      controllers: [EnrollmentController],
      providers: [
        { provide: EnrollmentRepository, useValue: repository },
        { provide: CourseClient, useValue: courseClient },
        {
          provide: EnrollmentService,
          useFactory: (): EnrollmentService => new EnrollmentService(repository, courseClient),
        },
      ],
    }).compile();
    const instance = module.createNestApplication();
    instance.useGlobalFilters(new HttpExceptionFilter());
    await instance.init();
    return instance;
  }

  beforeEach(async () => {
    rows = [seed];
    courseExists = true;
    app = await createApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('requires a trusted principal', async () => {
    await request(app.getHttpServer()).get('/api/v1/enrollments').expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/enrollments')
      .set('x-principal-id', 'student-001')
      .set('x-principal-role', 'admin')
      .expect(403);
  });

  it('lets a student enroll in an existing course', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/enrollments')
      .set(student)
      .send({ course_id: 'course-002' })
      .expect(201)
      .expect(({ body }) =>
        expect(body).toMatchObject({ course_id: 'course-002', principal_id: 'student-001' }),
      );
  });

  it('rejects instructor-initiated enroll and invalid payloads', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/enrollments')
      .set(instructor)
      .send({ course_id: 'course-002' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/enrollments')
      .set(student)
      .send({})
      .expect(400)
      .expect(({ body }) =>
        expect(body).toMatchObject({ code: 'VALIDATION_ERROR', details: null }),
      );
  });

  it('returns 404 when the referenced course does not exist', async () => {
    courseExists = false;
    await request(app.getHttpServer())
      .post('/api/v1/enrollments')
      .set(student)
      .send({ course_id: 'missing-course' })
      .expect(404)
      .expect(({ body }) => expect(body).toMatchObject({ code: 'NOT_FOUND', details: null }));
  });

  it('returns 409 when the principal already enrolled in the course', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/enrollments')
      .set(student)
      .send({ course_id: seed.course_id })
      .expect(409)
      .expect(({ body }) => expect(body).toMatchObject({ code: 'CONFLICT', details: null }));
  });

  it('scopes list to the caller principal for students and requires a filter for instructors', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/enrollments')
      .set(student)
      .expect(200)
      .expect(({ body }) => expect(body).toEqual({ items: [seed] }));
    await request(app.getHttpServer()).get('/api/v1/enrollments').set(instructor).expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/enrollments?course_id=course-001')
      .set(instructor)
      .expect(200)
      .expect(({ body }) => expect(body).toEqual({ items: [seed] }));
  });

  it('answers the internal check contract used by Submission', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/enrollments/check?principal_id=student-001&course_id=course-001')
      .set(student)
      .expect(200)
      .expect(({ body }) =>
        expect(body).toEqual({
          course_id: 'course-001',
          enrolled: true,
          principal_id: 'student-001',
        }),
      );
    await request(app.getHttpServer())
      .get('/api/v1/enrollments/check?principal_id=student-001&course_id=missing')
      .set(student)
      .expect(200)
      .expect(({ body }) => expect(body.enrolled).toBe(false));
  });
});

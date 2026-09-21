import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { CourseController } from '../../src/adapters/http/course/course.controller.js';
import { HttpExceptionFilter } from '../../src/adapters/http/http-exception.filter.js';
import { CourseService } from '../../src/application/course.service.js';
import { CourseRepository } from '../../src/application/ports/course-repository.js';
import type { Course } from '../../src/domain/course.js';

describe('Course HTTP contract', () => {
  const seed: Course = {
    id: 'course-001',
    title: 'Distributed Systems Basics',
    created_at: '2026-08-27T10:00:00.000Z',
  };
  const rows = new Map<string, Course>([[seed.id, seed]]);
  let app: INestApplication;

  async function createApp(): Promise<INestApplication> {
    const repository: CourseRepository = {
      create: async (title) => {
        const course = { id: 'course-002', title, created_at: new Date().toISOString() };
        rows.set(course.id, course);
        return course;
      },
      findById: async (id) => rows.get(id) ?? null,
      list: async (limit) => [...rows.values()].slice(0, limit),
    };
    const module = await Test.createTestingModule({
      controllers: [CourseController],
      providers: [
        { provide: CourseRepository, useValue: repository },
        { provide: CourseService, useFactory: (): CourseService => new CourseService(repository) },
      ],
    }).compile();
    const instance = module.createNestApplication();
    instance.useGlobalFilters(new HttpExceptionFilter());
    await instance.init();
    return instance;
  }

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists and gets courses through the published representation', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/courses?limit=1')
      .set('x-principal-id', 'student-001')
      .set('x-principal-role', 'student')
      .expect(200)
      .expect(({ body }) => expect(body).toEqual({ items: [seed] }));
    await request(app.getHttpServer())
      .get('/api/v1/courses/course-001')
      .set('x-principal-id', 'student-001')
      .set('x-principal-role', 'student')
      .expect(200)
      .expect(({ body }) => expect(body).toEqual(seed));
  });

  it('requires a trusted principal and instructor role for create', async () => {
    await request(app.getHttpServer()).get('/api/v1/courses').expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/courses')
      .set('x-principal-id', 'student-001')
      .set('x-principal-role', 'student')
      .send({ title: 'New Course' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/courses')
      .set('x-principal-id', 'instructor-001')
      .set('x-principal-role', 'instructor')
      .send({ title: 'New Course' })
      .expect(201)
      .expect(({ body }) => expect(body).toMatchObject({ id: 'course-002', title: 'New Course' }));
  });

  it('returns canonical validation and not-found envelopes', async () => {
    const principal = { 'x-principal-id': 'student-001', 'x-principal-role': 'student' };
    await request(app.getHttpServer())
      .get('/api/v1/courses?limit=0')
      .set(principal)
      .expect(400)
      .expect(({ body }) =>
        expect(body).toMatchObject({ code: 'VALIDATION_ERROR', details: null }),
      );
    await request(app.getHttpServer())
      .get('/api/v1/courses/missing')
      .set(principal)
      .expect(404)
      .expect(({ body }) => expect(body).toMatchObject({ code: 'NOT_FOUND', details: null }));
  });
});

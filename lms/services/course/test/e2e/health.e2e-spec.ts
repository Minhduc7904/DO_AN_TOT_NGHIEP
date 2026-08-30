import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module.js';

describe('Course health endpoint', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns liveness data with an UTC timestamp', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.status).toBe('ok');
    expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);
  });

  it('returns 404 for an unimplemented business route', async () => {
    await request(app.getHttpServer()).get('/api/v1/courses').expect(404);
  });
});

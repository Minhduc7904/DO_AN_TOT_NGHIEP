import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { HttpExceptionFilter } from '../../src/adapters/http/http-exception.filter.js';
import { StorageController } from '../../src/adapters/http/storage/storage.controller.js';
import { StorageMockService } from '../../src/application/storage-mock.service.js';

describe('Storage Mock HTTP contract', () => {
  let app: INestApplication;
  let storage: StorageMockService;

  beforeEach(async () => {
    storage = new StorageMockService({ error_mode: 'none', latency_ms: 0 });
    const module = await Test.createTestingModule({
      controllers: [StorageController],
      providers: [{ provide: StorageMockService, useValue: storage }],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('stores and reads an object through the published network contract', async () => {
    const objectPath = '/api/v1/objects/submissions%2Fsubmission-001';
    await request(app.getHttpServer())
      .put(objectPath)
      .send({ content: 'answer' })
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({ object_key: 'submissions/submission-001', stored: true }),
      );
    await request(app.getHttpServer())
      .get(objectPath)
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          content: 'answer',
          object_key: 'submissions/submission-001',
        }),
      );
  });

  it('controls deterministic error injection and resets to baseline', async () => {
    await request(app.getHttpServer())
      .put('/internal/v1/fault')
      .send({ error_mode: 'unavailable', latency_ms: 0 })
      .expect(200);
    await request(app.getHttpServer())
      .put('/api/v1/objects/submissions%2Ffailed')
      .send({ content: 'answer' })
      .expect(503)
      .expect(({ body }) => expect(body).toMatchObject({ code: 'DEPENDENCY_UNAVAILABLE' }));
    await request(app.getHttpServer()).delete('/internal/v1/fault').expect(200);
    await request(app.getHttpServer())
      .put('/api/v1/objects/submissions%2Frecovered')
      .send({ content: 'answer' })
      .expect(200);
  });

  it('applies deterministic latency configured by the control plane', async () => {
    storage.configure({ error_mode: 'none', latency_ms: 10 });
    const started = performance.now();
    await storage.store('submissions/slow', 'answer');
    expect(performance.now() - started).toBeGreaterThanOrEqual(8);
  });
});

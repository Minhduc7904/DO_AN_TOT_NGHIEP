import { validateEnvironment, validateWorkerEnvironment } from '../../src/config/env.schema.js';

describe('env.schema', () => {
  it('API yêu cầu SCHEDULER_DATABASE_URL và dùng cổng mặc định 3008', () => {
    expect(() => validateEnvironment({})).toThrow('SCHEDULER_DATABASE_URL');

    const environment = validateEnvironment({
      SCHEDULER_DATABASE_URL: 'postgresql://user:pw@localhost:5432/scheduler_db',
    });

    expect(environment.PORT).toBe(3008);
  });

  it('worker dùng cổng 3010, yêu cầu client credential và có mặc định hợp lý', () => {
    const base = { SCHEDULER_DATABASE_URL: 'postgresql://user:pw@localhost:5432/scheduler_db' };
    expect(() => validateWorkerEnvironment(base)).toThrow('SERVICE_CLIENT_ID');

    const environment = validateWorkerEnvironment({
      ...base,
      SERVICE_CLIENT_ID: 'scheduler-worker',
      SERVICE_CLIENT_SECRET: 'scheduler-worker-secret-local-only',
    });

    expect(environment).toMatchObject({
      PORT: 3010,
      SCHEDULER_MEDIA_BASE_URL: 'http://localhost:3004',
      SCHEDULER_WORKER_CONCURRENCY: 2,
      SCHEDULER_RUN_MAX_ATTEMPTS: 3,
    });
    expect(environment.SCHEDULER_RUN_LEASE_MS).toBeGreaterThan(
      environment.SCHEDULER_MEDIA_TIMEOUT_MS,
    );
  });

  it('lease của run phải dài hơn timeout gọi media', () => {
    expect(() =>
      validateWorkerEnvironment({
        SCHEDULER_DATABASE_URL: 'postgresql://user:pw@localhost:5432/scheduler_db',
        SERVICE_CLIENT_ID: 'scheduler-worker',
        SERVICE_CLIENT_SECRET: 'scheduler-worker-secret-local-only',
        SCHEDULER_MEDIA_TIMEOUT_MS: '60000',
        SCHEDULER_RUN_LEASE_MS: '30000',
      }),
    ).toThrow('SCHEDULER_RUN_LEASE_MS');
  });
});

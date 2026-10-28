import { randomBytes } from 'node:crypto';

import { validateEnvironment, validateWorkerEnvironment } from '../../src/config/env.schema.js';

const VALID_KEY = randomBytes(32).toString('base64');
const BASE = { AI_DATABASE_URL: 'postgresql://user:pw@localhost:5432/ai_db' };

describe('env.schema', () => {
  it('yêu cầu AI_DATABASE_URL và AI_ENCRYPTION_KEY, dùng cổng và timeout mặc định', () => {
    expect(() => validateEnvironment({})).toThrow('AI_DATABASE_URL');
    expect(() => validateEnvironment(BASE)).toThrow('AI_ENCRYPTION_KEY');

    const environment = validateEnvironment({ ...BASE, AI_ENCRYPTION_KEY: VALID_KEY });

    expect(environment.PORT).toBe(3009);
    expect(environment.AI_COMPLETION_TIMEOUT_MS).toBe(240_000);
    expect(environment.AI_HEALTH_CHECK_TIMEOUT_MS).toBe(6_000);
  });

  it('từ chối khóa mã hóa không phải base64 của đúng 32 byte', () => {
    const wrongLength = randomBytes(16).toString('base64');
    for (const key of [wrongLength, 'không-phải-base64!', '']) {
      expect(() => validateEnvironment({ ...BASE, AI_ENCRYPTION_KEY: key })).toThrow(
        'AI_ENCRYPTION_KEY',
      );
    }
  });

  it('worker: cần thêm thông tin đăng nhập service, có mặc định cho cổng 3011, lease và địa chỉ course/media', () => {
    const base = { ...BASE, AI_ENCRYPTION_KEY: VALID_KEY };
    expect(() => validateWorkerEnvironment(base)).toThrow('SERVICE_CLIENT_ID');

    const environment = validateWorkerEnvironment({
      ...base,
      SERVICE_CLIENT_ID: 'ai-worker',
      SERVICE_CLIENT_SECRET: 'ai-worker-client-secret-local-only',
    });

    expect(environment.PORT).toBe(3011);
    expect(environment.AI_WORKER_LEASE_MS).toBe(600_000);
    expect(environment.AI_WORKER_MAX_ATTEMPTS).toBe(5);
    expect(environment.AI_COURSE_BASE_URL).toBe('http://localhost:3003');
    expect(environment.AI_MEDIA_BASE_URL).toBe('http://localhost:3004');
    expect(environment.AI_COMPLETION_TIMEOUT_MS).toBeLessThan(environment.AI_WORKER_LEASE_MS);
  });
});

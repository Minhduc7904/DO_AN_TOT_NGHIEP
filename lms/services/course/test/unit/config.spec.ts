import { validateEnvironment } from '../../src/config/env.schema.js';

describe('env.schema', () => {
  it('yêu cầu COURSE_DATABASE_URL và dùng cổng mặc định', () => {
    expect(() => validateEnvironment({})).toThrow('COURSE_DATABASE_URL');

    const environment = validateEnvironment({
      COURSE_DATABASE_URL: 'postgresql://user:pw@localhost:5432/course_db',
      SERVICE_CLIENT_ID: 'course',
      SERVICE_CLIENT_SECRET: 'course-local-only-secret',
    });

    expect(environment.PORT).toBe(3003);
    expect(environment.COURSE_MEDIA_BASE_URL).toBe('http://localhost:3004');
  });

  it('cấu hình cạnh course → ai có giá trị mặc định', () => {
    const environment = validateEnvironment({
      COURSE_DATABASE_URL: 'postgresql://user:pw@localhost:5432/course_db',
      SERVICE_CLIENT_ID: 'course',
      SERVICE_CLIENT_SECRET: 'course-local-only-secret',
    });

    expect(environment).toMatchObject({
      COURSE_AI_BASE_URL: 'http://localhost:3009',
      COURSE_AI_TIMEOUT_MS: 5_000,
      COURSE_AI_BREAKER_THRESHOLD: 3,
      COURSE_AI_BREAKER_COOLDOWN_MS: 5_000,
    });
  });
});

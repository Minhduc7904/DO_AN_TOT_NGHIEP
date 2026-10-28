import { validateEnvironment } from '../../src/config/env.schema.js';

describe('gateway environment', () => {
  it('có mặc định cục bộ và chỉ bật route v1 khi có URL', () => {
    const env = validateEnvironment({});

    expect(env.PORT).toBe(3000);
    expect(env.GATEWAY_UPSTREAM_TIMEOUT_MS).toBe(30_000);
    expect(env.GATEWAY_AUTH_BASE_URL).toBe('http://localhost:3001');
    expect(env.GATEWAY_ENROLLMENT_BASE_URL).toBeUndefined();
  });

  it('từ chối secret ngắn và timeout ngoài khoảng', () => {
    expect(() => validateEnvironment({ GATEWAY_JWT_SECRET: 'ngan' })).toThrow(/GATEWAY_JWT_SECRET/);
    expect(() => validateEnvironment({ GATEWAY_UPSTREAM_TIMEOUT_MS: '10' })).toThrow(
      /GATEWAY_UPSTREAM_TIMEOUT_MS/,
    );
  });
});

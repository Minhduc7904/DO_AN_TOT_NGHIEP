import { validateEnvironment } from '../../src/config/env.schema.js';

const CLIENT = {
  SERVICE_CLIENT_ID: 'gateway',
  SERVICE_CLIENT_SECRET: 'gateway-secret-0123456789',
};

describe('gateway environment', () => {
  it('có mặc định cục bộ', () => {
    const env = validateEnvironment(CLIENT);

    expect(env.PORT).toBe(3000);
    expect(env.GATEWAY_UPSTREAM_TIMEOUT_MS).toBe(30_000);
    expect(env.GATEWAY_IDENTITY_BASE_URL).toBe('http://localhost:3001');
    expect(env.GATEWAY_COURSE_BASE_URL).toBe('http://localhost:3003');
  });

  it('từ chối secret client ngắn và timeout ngoài khoảng', () => {
    expect(() => validateEnvironment({ ...CLIENT, SERVICE_CLIENT_SECRET: 'ngan' })).toThrow(
      /SERVICE_CLIENT_SECRET/,
    );
    expect(() => validateEnvironment({})).toThrow(/SERVICE_CLIENT_ID/);
    expect(() => validateEnvironment({ ...CLIENT, GATEWAY_UPSTREAM_TIMEOUT_MS: '10' })).toThrow(
      /GATEWAY_UPSTREAM_TIMEOUT_MS/,
    );
  });
});

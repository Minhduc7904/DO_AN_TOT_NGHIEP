import { validateEnvironment } from '../../src/config/env.schema.js';

const base = {
  IDENTITY_DATABASE_URL: 'postgresql://user:pw@localhost:5432/identity_db',
};

describe('identity environment', () => {
  it('development không cần khóa ký và mặc định không có client bootstrap', () => {
    const env = validateEnvironment(base);

    expect(env.IDENTITY_SIGNING_KEY_PEM).toBeUndefined();
    expect(env.SERVICE_CLIENTS_BOOTSTRAP).toEqual([]);
    expect(env.IDENTITY_SERVICE_TOKEN_TTL_SECONDS).toBe(600);
  });

  it('production bắt buộc khóa ký trừ khi cho phép khóa tạm một cách tường minh', () => {
    expect(() => validateEnvironment({ ...base, NODE_ENV: 'production' })).toThrow(
      /IDENTITY_SIGNING_KEY_PEM/,
    );
    expect(() =>
      validateEnvironment({
        ...base,
        NODE_ENV: 'production',
        IDENTITY_ALLOW_EPHEMERAL_SIGNING_KEY: 'true',
      }),
    ).not.toThrow();
    expect(() =>
      validateEnvironment({
        ...base,
        NODE_ENV: 'production',
        IDENTITY_SIGNING_KEY_PEM: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----',
      }),
    ).not.toThrow();
  });

  it('chuyển `\\n` literal trong PEM thành xuống dòng', () => {
    const env = validateEnvironment({ ...base, IDENTITY_SIGNING_KEY_PEM: 'a\\nb' });

    expect(env.IDENTITY_SIGNING_KEY_PEM).toBe('a\nb');
  });

  it('đọc registry client từ JSON và từ chối JSON hoặc secret yếu', () => {
    const client = {
      client_id: 'gateway',
      client_secret: 'gateway-secret-0123456',
      audiences: ['course'],
      scopes: ['gateway:proxy'],
    };
    const env = validateEnvironment({
      ...base,
      SERVICE_CLIENTS_BOOTSTRAP: JSON.stringify([client]),
    });

    expect(env.SERVICE_CLIENTS_BOOTSTRAP).toEqual([
      {
        clientId: 'gateway',
        clientSecret: 'gateway-secret-0123456',
        audiences: ['course'],
        scopes: ['gateway:proxy'],
      },
    ]);
    expect(() =>
      validateEnvironment({ ...base, SERVICE_CLIENTS_BOOTSTRAP: 'không phải json' }),
    ).toThrow(/SERVICE_CLIENTS_BOOTSTRAP/);
    expect(() =>
      validateEnvironment({
        ...base,
        SERVICE_CLIENTS_BOOTSTRAP: JSON.stringify([{ ...client, client_secret: 'ngan' }]),
      }),
    ).toThrow(/SERVICE_CLIENTS_BOOTSTRAP/);
  });
});

import { DEFAULT_PORT } from '../../src/config/app-config';
import { validateEnvironment } from '../../src/config/env.schema.js';

describe('validateEnvironment', () => {
  it('uses deterministic defaults', () => {
    expect(validateEnvironment({})).toEqual({
      NODE_ENV: 'development',
      PORT: DEFAULT_PORT,
    });
  });

  it('coerces a valid port from environment text', () => {
    expect(validateEnvironment({ NODE_ENV: 'production', PORT: '4100' })).toEqual({
      NODE_ENV: 'production',
      PORT: 4100,
    });
  });

  it.each([0, 65_536, 'not-a-port'])('rejects invalid port %p', (port) => {
    expect(() => validateEnvironment({ PORT: port })).toThrow('Invalid environment configuration');
  });

  it('rejects an unsupported node environment', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'staging' })).toThrow(
      'Invalid environment configuration',
    );
  });
});

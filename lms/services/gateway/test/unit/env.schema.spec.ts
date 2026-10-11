import { validateEnvironment } from '../../src/config/env.schema.js';

describe('Gateway dependency timeout configuration', () => {
  it('uses the canonical 5000 ms default', () => {
    expect(validateEnvironment({}).GATEWAY_UPSTREAM_TIMEOUT_MS).toBe(5_000);
  });

  it.each(['100', '60000'])('accepts the canonical boundary %s ms', (value) => {
    expect(() => validateEnvironment({ GATEWAY_UPSTREAM_TIMEOUT_MS: value })).not.toThrow();
  });

  it.each(['99', '60001'])('rejects an out-of-range timeout %s ms', (value) => {
    expect(() => validateEnvironment({ GATEWAY_UPSTREAM_TIMEOUT_MS: value })).toThrow(
      'Invalid environment',
    );
  });
});

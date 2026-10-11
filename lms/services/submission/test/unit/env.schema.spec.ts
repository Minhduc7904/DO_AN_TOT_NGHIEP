import { validateEnvironment } from '../../src/config/env.schema.js';

describe('Submission dependency timeout configuration', () => {
  it('uses the canonical 3000 ms default', () => {
    expect(validateEnvironment({}).SUBMISSION_DEPENDENCY_TIMEOUT_MS).toBe(3_000);
  });

  it.each(['100', '60000'])('accepts the canonical boundary %s ms', (value) => {
    expect(() => validateEnvironment({ SUBMISSION_DEPENDENCY_TIMEOUT_MS: value })).not.toThrow();
  });

  it.each(['99', '60001'])('rejects an out-of-range timeout %s ms', (value) => {
    expect(() => validateEnvironment({ SUBMISSION_DEPENDENCY_TIMEOUT_MS: value })).toThrow(
      'Invalid environment',
    );
  });
});

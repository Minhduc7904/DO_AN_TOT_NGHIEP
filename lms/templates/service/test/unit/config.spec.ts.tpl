import { validateEnvironment } from '../../src/config/env.schema.js';

describe('env.schema', () => {
  it('yêu cầu __UPPER___DATABASE_URL và dùng cổng mặc định', () => {
    expect(() => validateEnvironment({})).toThrow('__UPPER___DATABASE_URL');

    const environment = validateEnvironment({
      __UPPER___DATABASE_URL: 'postgresql://user:pw@localhost:5432/__NAME___db',
    });

    expect(environment.PORT).toBe(__PORT__);
  });
});

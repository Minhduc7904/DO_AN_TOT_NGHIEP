import { jest } from '@jest/globals';

import { PostgresGradeRepository } from '../../src/adapters/persistence/postgres-grade.repository.js';

describe('PostgresGradeRepository pool', () => {
  it('survives an idle client error without crashing or leaking credentials', async () => {
    const secret = 'unit-test-secret';
    const repository = new PostgresGradeRepository({
      getOrThrow: () => `postgresql://user:${secret}@127.0.0.1:1/grading_db`,
    } as never);
    const pool = (repository as unknown as { pool: import('node:events').EventEmitter }).pool;
    const warn = jest
      .spyOn((repository as unknown as { logger: { warn(m: string): void } }).logger, 'warn')
      .mockImplementation(() => undefined);
    try {
      expect(pool.listenerCount('error')).toBeGreaterThan(0);
      expect(() =>
        pool.emit('error', Object.assign(new Error(`boom ${secret}`), { code: '57P01' })),
      ).not.toThrow();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[0])).toContain('57P01');
      expect(String(warn.mock.calls[0]?.[0])).not.toContain(secret);
    } finally {
      await repository.onModuleDestroy();
    }
  });
});

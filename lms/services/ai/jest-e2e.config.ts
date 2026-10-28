import type { Config } from 'jest';

const config: Config = {
  clearMocks: true,
  // Hai spec dùng chung một DB (TRUNCATE đầu mỗi spec) và queue RabbitMQ nên chạy lần lượt.
  maxWorkers: 1,
  extensionsToTreatAsEsm: ['.ts'],
  moduleFileExtensions: ['js', 'json', 'ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['**/test/e2e/**/*.e2e-spec.ts'],
  testTimeout: 30_000,
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', useESM: true }],
  },
};

export default config;

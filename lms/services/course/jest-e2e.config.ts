import type { Config } from 'jest';

const config: Config = {
  clearMocks: true,
  extensionsToTreatAsEsm: ['.ts'],
  moduleFileExtensions: ['js', 'json', 'ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/e2e/**/*.e2e-spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', useESM: true }],
  },
};

export default config;

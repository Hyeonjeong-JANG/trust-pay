import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: 'test/.*\\.e2e-spec\\.ts$',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  testEnvironment: 'node',
  // Run sequentially to prevent jest.mock() pollution across suites
  maxWorkers: 1,
  moduleNameMapper: {
    '^@prepaid-shield/(.*)$': '<rootDir>/../../packages/$1/src',
  },
};

export default config;

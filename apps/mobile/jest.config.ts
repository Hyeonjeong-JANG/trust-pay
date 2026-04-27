import type { Config } from 'jest';

const config: Config = {
  preset: 'react-native',
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|expo|expo-router|expo-status-bar|@expo|@tanstack/react-query|zustand)/)',
  ],
  setupFiles: ['./jest.setup.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testRegex: '.*\\.spec\\.tsx?$',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@prepaid-shield/(.*)$': '<rootDir>/../../packages/$1/src',
  },
};

export default config;

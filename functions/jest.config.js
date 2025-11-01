module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/exportListToCsv.test.ts'],
  globals: { 'ts-jest': { diagnostics: false } },
  collectCoverageFrom: [
    '**/*.ts',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!jest.config.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html']
};
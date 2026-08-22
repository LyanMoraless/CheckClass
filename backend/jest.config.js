/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.module.ts', '!src/main.ts', '!src/scripts/**'],
  coverageDirectory: '<rootDir>/coverage',
  clearMocks: true,
  // Integration specs (test/integration/**) need a real local Postgres — see
  // backend/README.md. They're a separate testPathIgnorePatterns entry point
  // (npm run test:integration) so `npm test`/CI can run the fast unit suite
  // without requiring a database, and integration runs are an explicit,
  // separate step.
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '<rootDir>/test/integration/'],
};

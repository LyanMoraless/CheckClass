/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/test/integration'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  testRegex: '.*\\.integration\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
  // These hit a real local Postgres (docker-compose in backend/) — no
  // mocking. Slower and more setup-sensitive than unit specs, so kept in a
  // separate Jest project/script (npm run test:integration) rather than
  // mixed into the default `npm test` run.
  testTimeout: 20000,
};

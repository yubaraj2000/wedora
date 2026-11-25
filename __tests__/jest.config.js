/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  transform: {},          // plain JS only — no TS transform needed
  testMatch: ['**/__tests__/**/*.test.js'],
};

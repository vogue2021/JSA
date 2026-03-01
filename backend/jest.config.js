module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  setupFiles: [],
  // 测试前设置环境变量
  globalSetup: './__tests__/setup.js',
  globalTeardown: './__tests__/teardown.js',
  // 覆盖率配置
  collectCoverageFrom: [
    'routes/**/*.js',
    'middleware/**/*.js',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
  testTimeout: 15000,
};

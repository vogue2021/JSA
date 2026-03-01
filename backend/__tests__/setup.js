/**
 * Jest 全局 Setup
 * 在所有测试开始前设置测试环境变量
 */
module.exports = async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-for-unit-tests-only-32chars';
  process.env.SESSION_SECRET = 'test-session-secret-for-unit-tests-32chars';
};

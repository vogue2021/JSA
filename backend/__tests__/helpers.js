/**
 * 测试辅助工具
 * 提供测试数据库初始化、用户创建等公共方法
 */
const knex = require('knex');
const bcrypt = require('bcryptjs');
const dbConfig = require('../config/database');

// 创建测试专用内存数据库实例
const createTestDb = () => {
  return knex(dbConfig.test);
};

// 运行所有迁移（建表）
const runMigrations = async (db) => {
  await db.migrate.latest({ directory: './migrations' });
};

// 清空所有测试数据
const clearTables = async (db) => {
  await db('verification_codes').truncate().catch(() => {});
  await db('feedbacks').truncate().catch(() => {});
  await db('students').truncate().catch(() => {});
  await db('users').truncate().catch(() => {});
};

// 创建测试用户
const createTestUser = async (db, overrides = {}) => {
  const defaults = {
    email: `test_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`,
    password: await bcrypt.hash('Test@123456', 10),
    name: '测试用户',
    role: 'teacher',
  };
  // 移除 id 字段（users 表使用自增主键）
  const { id: _ignored, ...rest } = { ...defaults, ...overrides };
  const [insertedId] = await db('users').insert(rest);
  return { ...rest, id: insertedId };
};

// 创建测试管理员
const createTestAdmin = async (db, overrides = {}) => {
  return createTestUser(db, { role: 'admin', name: '测试管理员', ...overrides });
};

// 生成测试 JWT Token
const generateTestToken = (user) => {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET || 'test-jwt-secret-for-unit-tests-only-32chars',
    { expiresIn: '1h' }
  );
};

module.exports = {
  createTestDb,
  runMigrations,
  clearTables,
  createTestUser,
  createTestAdmin,
  generateTestToken,
};

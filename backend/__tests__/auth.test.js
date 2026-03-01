/**
 * Auth 路由集成测试
 * 覆盖：登录、登出、Token 验证、修改密码、验证码发送/验证
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-unit-tests-only-32chars';
process.env.SESSION_SECRET = 'test-session-secret-for-unit-tests-32chars';

const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../server');
const db = require('../config/db');
const { createTestUser, generateTestToken } = require('./helpers');

// ─── 测试前准备 ───────────────────────────────────────────────────────────────
beforeAll(async () => {
  // 确保测试表存在（内存 SQLite 每次都是空的）
  await db.migrate.latest({ directory: './migrations' });
});

afterAll(async () => {
  await db.destroy();
});

afterEach(async () => {
  // 每个测试后清理数据，保持隔离
  await db('verification_codes').truncate().catch(() => {});
  await db('users').truncate().catch(() => {});
  await db('students').truncate().catch(() => {});
});

// ─── 健康检查 ─────────────────────────────────────────────────────────────────
describe('GET /api/health', () => {
  it('应返回 200 和 OK 状态', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
    expect(res.body).toHaveProperty('timestamp');
  });
});

// ─── 登录接口 ─────────────────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  let testUser;

  beforeEach(async () => {
    testUser = await createTestUser(db, {
      email: 'teacher@test.com',
      password: await bcrypt.hash('Test@123456', 10),
      name: '王老师',
      role: 'teacher',
    });
  });

  it('正确凭据应返回 token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'teacher@test.com', password: 'Test@123456' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe('teacher@test.com');
    expect(res.body.user.role).toBe('teacher');
    // 不应返回密码字段
    expect(res.body.user).not.toHaveProperty('password');
  });

  it('错误密码应返回 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'teacher@test.com', password: 'WrongPassword' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('不存在的邮箱应返回 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'notexist@test.com', password: 'Test@123456' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('缺少邮箱字段应返回 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'Test@123456' });

    expect(res.status).toBe(400);
  });

  it('缺少密码字段应返回 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'teacher@test.com' });

    expect(res.status).toBe(400);
  });
});

// ─── Token 验证接口 ───────────────────────────────────────────────────────────
describe('GET /api/auth/verify', () => {
  let testUser;
  let validToken;

  beforeEach(async () => {
    testUser = await createTestUser(db, {
      email: 'verify@test.com',
      role: 'teacher',
    });
    validToken = generateTestToken(testUser);
  });

  it('有效 token 应返回用户信息', async () => {
    const res = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe('verify@test.com');
  });

  it('无 token 应返回 401', async () => {
    const res = await request(app).get('/api/auth/verify');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('无效 token 应返回 401', async () => {
    const res = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', 'Bearer invalid.token.here');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ─── 修改密码接口 ─────────────────────────────────────────────────────────────
describe('POST /api/auth/change-password', () => {
  let testUser;
  let validToken;

  beforeEach(async () => {
    testUser = await createTestUser(db, {
      email: 'changepwd@test.com',
      password: await bcrypt.hash('OldPass@123', 10),
      role: 'teacher',
    });
    validToken = generateTestToken(testUser);
  });

  it('正确旧密码应成功修改', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ oldPassword: 'OldPass@123', newPassword: 'NewPass@456' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('错误旧密码应返回 401', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ oldPassword: 'WrongOldPass', newPassword: 'NewPass@456' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('无 token 应返回 401（防止未授权修改密码）', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .send({ oldPassword: 'OldPass@123', newPassword: 'NewPass@456' });

    expect(res.status).toBe(401);
  });

  it('不应允许通过 body 中的 userId 越权修改他人密码', async () => {
    // 创建另一个用户
    const otherUser = await createTestUser(db, {
      email: 'other@test.com',
      password: await bcrypt.hash('OtherPass@123', 10),
      role: 'teacher',
    });

    // 用 testUser 的 token，但 body 中传入 otherUser 的 userId
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        userId: otherUser.id,  // 尝试越权
        oldPassword: 'OldPass@123',
        newPassword: 'NewPass@456',
      });

    // 应该成功修改的是 testUser 自己的密码（忽略 body 中的 userId）
    // 而不是修改 otherUser 的密码
    expect(res.status).toBe(200);

    // 验证 otherUser 的密码未被修改
    const otherUserInDb = await db('users').where({ id: otherUser.id }).first();
    const otherPasswordUnchanged = await bcrypt.compare('OtherPass@123', otherUserInDb.password);
    expect(otherPasswordUnchanged).toBe(true);
  });
});

// ─── 验证码发送接口 ───────────────────────────────────────────────────────────
describe('POST /api/auth/send-verification', () => {
  it('有效邮箱应成功发送验证码', async () => {
    const res = await request(app)
      .post('/api/auth/send-verification')
      .send({ email: 'newuser@test.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // 演示模式下应返回验证码
    expect(res.body).toHaveProperty('demoCode');
  });

  it('无效邮箱格式应返回 400', async () => {
    const res = await request(app)
      .post('/api/auth/send-verification')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('60 秒内重复发送应返回 429', async () => {
    const email = 'ratelimit@test.com';
    // 第一次发送
    await request(app)
      .post('/api/auth/send-verification')
      .send({ email });

    // 立即再次发送（应被频率限制）
    const res = await request(app)
      .post('/api/auth/send-verification')
      .send({ email });

    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
  });
});

// ─── 验证码验证接口 ───────────────────────────────────────────────────────────
describe('POST /api/auth/verify-code', () => {
  it('正确验证码应验证成功', async () => {
    const email = 'verifycode@test.com';
    // 先发送验证码
    const sendRes = await request(app)
      .post('/api/auth/send-verification')
      .send({ email });
    const { demoCode } = sendRes.body;

    // 验证
    const res = await request(app)
      .post('/api/auth/verify-code')
      .send({ email, code: demoCode });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('错误验证码应返回 400', async () => {
    const email = 'wrongcode@test.com';
    await request(app)
      .post('/api/auth/send-verification')
      .send({ email });

    const res = await request(app)
      .post('/api/auth/verify-code')
      .send({ email, code: '000000' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('未发送验证码直接验证应返回 400', async () => {
    const res = await request(app)
      .post('/api/auth/verify-code')
      .send({ email: 'nocode@test.com', code: '123456' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ─── 权限保护接口 ─────────────────────────────────────────────────────────────
describe('核心业务接口鉴权保护', () => {
  it('未携带 token 访问 /api/schools 应返回 401', async () => {
    const res = await request(app).get('/api/schools');
    expect(res.status).toBe(401);
  });

  it('未携带 token 访问 /api/events 应返回 401', async () => {
    const res = await request(app).get('/api/events');
    expect(res.status).toBe(401);
  });

  it('未携带 token 访问 /api/materials 应返回 401', async () => {
    const res = await request(app).get('/api/materials');
    expect(res.status).toBe(401);
  });

  it('未携带 token 访问 /api/students 应返回 401', async () => {
    const res = await request(app).get('/api/students');
    expect(res.status).toBe(401);
  });
});

/**
 * Feedback 路由集成测试
 * 覆盖：提交反馈（公开/匿名）、管理员查询、权限控制
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-unit-tests-only-32chars';
process.env.SESSION_SECRET = 'test-session-secret-for-unit-tests-32chars';

const request = require('supertest');
const app = require('../server');
const db = require('../config/db');
const { createTestUser, createTestAdmin, generateTestToken } = require('./helpers');

beforeAll(async () => {
  await db.migrate.latest({ directory: './migrations' });
});

afterAll(async () => {
  await db.destroy();
});

afterEach(async () => {
  await db('feedbacks').truncate().catch(() => {});
  await db('users').truncate().catch(() => {});
});

// ─── 提交反馈（公开接口） ─────────────────────────────────────────────────────
describe('POST /api/feedback', () => {
  it('匿名用户应能成功提交反馈', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .send({ type: 'suggestion', content: '希望增加批量导入功能' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('id');
  });

  it('登录用户提交反馈应记录用户信息', async () => {
    const user = await createTestUser(db, {
      email: 'fbuser@test.com',
      name: '张老师',
      role: 'teacher',
    });
    const token = generateTestToken(user);

    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'bug', content: '日历视图拖拽有问题', contact: 'fbuser@test.com' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    // 验证数据库中记录了用户信息
    const record = await db('feedbacks').where({ id: res.body.id }).first();
    expect(record.user_name).toBe('张老师');
    expect(record.type).toBe('bug');
  });

  it('空内容应返回 400', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .send({ type: 'suggestion', content: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('无效类型应自动归为 suggestion', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .send({ type: 'invalid_type', content: '测试内容' });

    expect(res.status).toBe(201);
    const record = await db('feedbacks').where({ id: res.body.id }).first();
    expect(record.type).toBe('suggestion');
  });
});

// ─── 管理员查询反馈列表 ───────────────────────────────────────────────────────
describe('GET /api/feedback', () => {
  let adminToken;
  let teacherToken;

  beforeEach(async () => {
    const admin = await createTestAdmin(db, {
      email: 'admin_fb@test.com',
    });
    adminToken = generateTestToken(admin);

    const teacher = await createTestUser(db, {
      email: 'teacher_fb@test.com',
      role: 'teacher',
    });
    teacherToken = generateTestToken(teacher);

    // 插入测试反馈数据
    await db('feedbacks').insert([
      { type: 'suggestion', content: '建议1', status: 'pending', user_name: '匿名' },
      { type: 'bug', content: '错误1', status: 'reviewed', user_name: '张老师' },
    ]);
  });

  it('管理员应能查询反馈列表', async () => {
    const res = await request(app)
      .get('/api/feedback')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination).toHaveProperty('total', 2);
  });

  it('管理员应能按 status 筛选', async () => {
    const res = await request(app)
      .get('/api/feedback?status=pending')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe('pending');
  });

  it('普通老师不应能查询反馈列表（403）', async () => {
    const res = await request(app)
      .get('/api/feedback')
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('未登录不应能查询反馈列表（401）', async () => {
    const res = await request(app).get('/api/feedback');
    expect(res.status).toBe(401);
  });
});

// ─── 管理员更新反馈状态 ───────────────────────────────────────────────────────
describe('PATCH /api/feedback/:id', () => {
  let adminToken;
  let feedbackId;

  beforeEach(async () => {
    const admin = await createTestAdmin(db, {
      email: 'admin_patch@test.com',
    });
    adminToken = generateTestToken(admin);

    [feedbackId] = await db('feedbacks').insert({
      type: 'suggestion',
      content: '待处理的反馈',
      status: 'pending',
      user_name: '匿名',
    });
  });

  it('管理员应能更新反馈状态', async () => {
    const res = await request(app)
      .patch(`/api/feedback/${feedbackId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'resolved', admin_note: '已处理，感谢反馈' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const updated = await db('feedbacks').where({ id: feedbackId }).first();
    expect(updated.status).toBe('resolved');
    expect(updated.admin_note).toBe('已处理，感谢反馈');
  });

  it('不存在的反馈 ID 应返回 404', async () => {
    const res = await request(app)
      .patch('/api/feedback/99999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'resolved' });

    expect(res.status).toBe(404);
  });
});

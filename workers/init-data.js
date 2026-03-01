#!/usr/bin/env node
// 初始化 D1 数据库测试数据
// 通过 Workers API 创建测试账号和学生数据
// 运行方式: node init-data.js

const API_BASE_URL = process.env.API_URL || 'https://jsa-api.jiangpeng527.workers.dev/api';

// 测试账号列表
const testUsers = [
  // 管理员
  { email: 'admin@jsa.com', password: 'admin123', role: 'admin', name: '系统管理员' },
  // 升学老师
  { email: 'wang@school.com', password: 'wang123', role: 'teacher', name: '王老师', teacherId: 'teacher_1' },
  { email: 'li@school.com', password: 'li123', role: 'teacher', name: '李老师', teacherId: 'teacher_2' },
  { email: 'zhang@school.com', password: 'zhang123', role: 'teacher', name: '张老师', teacherId: 'teacher_3' },
  { email: 'chen@school.com', password: 'chen123', role: 'teacher', name: '陈老师', teacherId: 'teacher_4' },
  { email: 'zhao@school.com', password: 'zhao123', role: 'teacher', name: '赵老师', teacherId: 'teacher_5' },
  // 学管老师
  { email: 'gao@school.com', password: 'gao123', role: 'teacher', name: '高老师（学管）', teacherId: 'teacher_6' },
  { email: 'lin@school.com', password: 'lin123', role: 'teacher', name: '林老师（学管）', teacherId: 'teacher_7' },
];

// 测试学生列表（先在 students 表创建，再注册账号）
const testStudents = [
  { studentId: '2024001', name: '张三', teacherId: 'teacher_1', email: 'zhangsan@student.jsa.com', password: 'stu2024001' },
  { studentId: '2024002', name: '李四', teacherId: 'teacher_1', email: 'lisi@student.jsa.com', password: 'stu2024002' },
  { studentId: '2024003', name: '王五', teacherId: 'teacher_2', email: 'wangwu@student.jsa.com', password: 'stu2024003' },
  { studentId: '2024004', name: '赵六', teacherId: 'teacher_2', email: 'zhaoliu@student.jsa.com', password: 'stu2024004' },
  { studentId: '2024005', name: '刘七', teacherId: 'teacher_3', email: 'liuqi@student.jsa.com', password: 'stu2024005' },
  { studentId: '2024006', name: '孙八', teacherId: 'teacher_1', email: 'sunba@student.jsa.com', password: 'stu2024006' },
  { studentId: '2024007', name: '周九', teacherId: 'teacher_4', email: 'zhoujiu@student.jsa.com', password: 'stu2024007' },
  { studentId: '2024008', name: '吴十', teacherId: 'teacher_4', email: 'wushi@student.jsa.com', password: 'stu2024008' },
  { studentId: '2024009', name: '郑十一', teacherId: 'teacher_2', email: 'zhengshiyi@student.jsa.com', password: 'stu2024009' },
  { studentId: '2024010', name: '冯十二', teacherId: 'teacher_5', email: 'fengshier@student.jsa.com', password: 'stu2024010' },
  { studentId: '2024011', name: '陈十三', teacherId: 'teacher_3', email: 'chenshisan@student.jsa.com', password: 'stu2024011' },
  { studentId: '2024012', name: '林十四', teacherId: '', email: 'linshisi@student.jsa.com', password: 'stu2024012' },
];

async function apiPost(endpoint, data, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const resp = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  return resp.json();
}

async function apiPut(endpoint, data, token) {
  const resp = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  return resp.json();
}

async function main() {
  console.log('🚀 开始初始化 JSA D1 数据库测试数据...\n');
  console.log(`📡 API 地址: ${API_BASE_URL}\n`);

  // 1. 先登录管理员（如果已存在）
  let adminToken = null;
  const loginResp = await apiPost('/auth/login', { email: 'admin@jsa.com', password: 'admin123' });
  if (loginResp.success) {
    adminToken = loginResp.token;
    console.log('✅ 管理员账号已存在，跳过创建');
  } else {
    console.log('⚠️  管理员账号不存在，需要通过 D1 控制台手动创建');
    console.log('   请参考 workers/init-admin.sql 文件');
  }

  // 2. 通过 API 注册学生账号（需要先在 students 表中有记录）
  // 注意：这里需要管理员 token 来直接插入 users 表
  // 实际上应该通过 wrangler d1 execute 来插入初始数据

  console.log('\n📋 测试账号信息：');
  console.log('管理员: admin@jsa.com / admin123');
  console.log('老师: wang@school.com / wang123 (王老师)');
  console.log('学生: zhangsan@student.jsa.com / stu2024001 (张三)');
  console.log('\n💡 提示：请使用 workers/seed.sql 文件通过 wrangler 插入初始数据');
}

main().catch(console.error);

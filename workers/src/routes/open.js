// 开放只读数据路由 —— 【开放只读 API】
//
// 用途：供**另一个系统**实时调取生产数据（只读）。
//   认证：X-API-Key（见 middleware/apiKey.js），不走 JWT。
//   数据范围：除管理员账号信息（users 表，含密码哈希）外的核心业务数据。
//   写操作一律不提供 —— 这个路由文件里不允许出现任何 INSERT/UPDATE/DELETE。
//
// 端点一览：
//   GET /api/open/students        学生列表（?student_id= 过滤；默认排除孤儿账号学生）
//   GET /api/open/teachers        老师列表（基础字段，不含联系方式等个人隐私）
//   GET /api/open/schools         志愿学校（?student_id= 过滤；extra_dates 已解析为对象）
//   GET /api/open/events          时间线事件（?days=90 窗口，?student_id= 过滤）
//   GET /api/open/materials       材料清单（?student_id= 过滤）
//   GET /api/open/school-database 学校信息库（招生参考数据）

import { Hono } from 'hono'

const open = new Hono()

// 【新需求105】与 todos.js 同款孤儿账号守卫：user_id 有值但 users 表查不到 → 已删账号的学生
const ORPHAN_GUARD =
  " AND (user_id IS NULL OR user_id = '' OR user_id IN (SELECT id FROM users))"

// ─── 学生 ────────────────────────────────────────────────────────────────────
open.get('/students', async (c) => {
  const db = c.env.DB
  const studentId = c.req.query('student_id')
  let sql = 'SELECT * FROM students WHERE 1=1' + ORPHAN_GUARD
  const params = []
  if (studentId) { sql += ' AND student_id = ?'; params.push(studentId) }
  sql += ' ORDER BY student_id ASC'
  const { results } = await db.prepare(sql).bind(...params).all()
  return c.json({ success: true, data: results || [], meta: { count: (results || []).length } })
})

// ─── 老师（基础字段；联系方式/住址/生日/照片属个人隐私，不对系统间同步开放）────
open.get('/teachers', async (c) => {
  const db = c.env.DB
  const { results } = await db.prepare(`
    SELECT t.teacher_id, u.name, u.is_active, t.department, t.subject, t.gender,
           t.education, t.hire_date, t.employment_type
    FROM teachers t LEFT JOIN users u ON t.user_id = u.id
    ORDER BY t.teacher_id ASC
  `).all()
  return c.json({ success: true, data: results || [], meta: { count: (results || []).length } })
})

// ─── 志愿学校 ─────────────────────────────────────────────────────────────────
open.get('/schools', async (c) => {
  const db = c.env.DB
  const studentId = c.req.query('student_id')
  let sql = 'SELECT * FROM schools WHERE 1=1'
  const params = []
  if (studentId) { sql += ' AND student_id = ?'; params.push(studentId) }
  sql += ' ORDER BY student_id ASC, id ASC'
  const { results } = await db.prepare(sql).bind(...params).all()
  // extra_dates 是 JSON 文本，解析后返回（与 todos.js 口径一致）
  ;(results || []).forEach(s => {
    if (s.extra_dates) {
      try { s.extra_dates = JSON.parse(s.extra_dates) } catch { s.extra_dates = {} }
    } else {
      s.extra_dates = {}
    }
  })
  return c.json({ success: true, data: results || [], meta: { count: (results || []).length } })
})

// ─── 时间线事件 ───────────────────────────────────────────────────────────────
// days 参数：向后看 N 天（含向前 30 天兜底逾期事项），默认 90，最大 365；days=0 表示全部
open.get('/events', async (c) => {
  const db = c.env.DB
  const rawDays = Number(c.req.query('days') ?? 90)
  const days = Number.isFinite(rawDays) ? Math.max(0, Math.min(rawDays, 365)) : 90
  const studentId = c.req.query('student_id')

  let sql = 'SELECT * FROM events WHERE 1=1'
  const params = []
  if (studentId) { sql += ' AND student_id = ?'; params.push(studentId) }
  if (days > 0) {
    const now = Date.now()
    const from = new Date(now - 30 * 86400000).toISOString().slice(0, 10)
    const to = new Date(now + days * 86400000).toISOString().slice(0, 10)
    sql += ' AND date >= ? AND date <= ?'
    params.push(from, to)
  }
  sql += ' ORDER BY date ASC'
  const { results } = await db.prepare(sql).bind(...params).all()
  return c.json({ success: true, data: results || [], meta: { count: (results || []).length } })
})

// ─── 材料清单 ─────────────────────────────────────────────────────────────────
open.get('/materials', async (c) => {
  const db = c.env.DB
  const studentId = c.req.query('student_id')
  let sql = 'SELECT * FROM materials WHERE 1=1'
  const params = []
  if (studentId) { sql += ' AND student_id = ?'; params.push(studentId) }
  sql += ' ORDER BY student_id ASC, deadline ASC'
  const { results } = await db.prepare(sql).bind(...params).all()
  return c.json({ success: true, data: results || [], meta: { count: (results || []).length } })
})

// ─── 学校信息库（招生参考数据）────────────────────────────────────────────────
open.get('/school-database', async (c) => {
  const db = c.env.DB
  const { results } = await db.prepare('SELECT * FROM school_database ORDER BY name ASC').all()
  return c.json({ success: true, data: results || [], meta: { count: (results || []).length } })
})

export default open

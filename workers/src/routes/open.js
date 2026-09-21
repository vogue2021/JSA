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

/** 列表端点统一响应：先过测试变换（仅 staging 生效），count 反映实际返回条数 */
function respondList(c, results) {
  const out = applyTestTransforms(c, results || [])
  return c.json({ success: true, data: out, meta: { count: out.length } })
}

// ─── 乱码测试开关（仅 staging 生效）─────────────────────────────────────────
// 用途：本团队自测下游系统的数据清洗/容错能力 —— 模拟真实世界最常见的乱码成因。
// ⚠️ 硬性保证：ENVIRONMENT 只在 staging 的 wrangler.toml 里是 'staging'，
//    生产部署该值为 'production'，此开关被直接忽略，永远不可能在生产触发。
const MOJIBAKE_MODES = {
  // UTF-8 被当成 Latin-1 解读（"学生" → "å­¦ç"）—— 最典型的接口乱码
  latin1: (s) => new TextDecoder('latin1').decode(new TextEncoder().encode(s)),
  // UTF-8 被当成 GBK 解读（"学生" → "瀛︾敓"）—— 国内系统对接常见
  gbk: (s) => new TextDecoder('gbk').decode(new TextEncoder().encode(s)),
}

function applyMojibake(value, transform) {
  if (typeof value === 'string') return transform(value)
  if (Array.isArray(value)) return value.map(v => applyMojibake(v, transform))
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = applyMojibake(v, transform)
    return out
  }
  return value
}

/** 请求带 ?mojibake=latin1|gbk 或 ?dirty=1 且当前是 staging 时，对响应做测试性污染 */
function applyTestTransforms(c, data) {
  if (c.env.ENVIRONMENT !== 'staging') return data
  // ?dirty=1 —— 真假混杂：部分记录正确，部分错乱（日期偏移/字段张冠李戴/状态翻转/混入虚构记录）
  if (c.req.query('dirty') === '1') return applyDirtyMix(data)
  const transform = MOJIBAKE_MODES[c.req.query('mojibake') || '']
  if (!transform) return data
  return applyMojibake(data, transform)
}

// ─── 脏数据混合（仅 staging 生效，经 applyTestTransforms 调用）──────────────
// 用途：自测下游系统的**校验/清洗能力**——不是所有数据都坏，而是好坏混在一起，
//   看下游能不能识别出异常记录。污染是**确定性**的（同一数据每次结果一致，便于复现比对）。
// ⚠️ 与 mojibake 同样被 ENVIRONMENT 硬守卫，生产环境永远返回真实数据。

/** FNV-1a 哈希：给每条记录算一个稳定的"命运值"（导出仅供测试脚本使用） */
export function fnv1a(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

const TEXT_FIELDS = ['name', 'student_name', 'item', 'title', 'program', 'name_ja']
const STATUS_VALUES = ['not_started', 'preparing', 'applied', 'submitted', 'admitted', 'rejected']

/** 把字符串里的 YYYY-MM-DD 日期偏移 N 天 */
function shiftDatesInString(s, offsetDays) {
  return s.replace(/(\d{4})-(\d{2})-(\d{2})/g, (_, y, m, d) => {
    const t = new Date(Number(y), Number(m) - 1, Number(d) + offsetDays)
    const pad = (n) => String(n).padStart(2, '0')
    return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`
  })
}

export function applyDirtyMix(data) {
  if (!Array.isArray(data) || data.length === 0) return data
  const out = []
  data.forEach((row, i) => {
    if (!row || typeof row !== 'object') { out.push(row); return }
    const fate = fnv1a(JSON.stringify(row) + `#${i}`) % 100
    if (fate < 50) {
      out.push(row) // 一半记录保持正确
    } else if (fate < 65) {
      // 日期偏移 ±1~7 天（deterministic）
      const offset = (fate % 7) - 3 || 7
      const r = { ...row }
      for (const [k, v] of Object.entries(r)) {
        if (typeof v === 'string' && /\d{4}-\d{2}-\d{2}/.test(v)) r[k] = shiftDatesInString(v, offset)
      }
      out.push(r)
    } else if (fate < 80 && data.length > 1) {
      // 张冠李戴：文本字段换成另一条记录的值（字段类型不变，内容错位）
      const donor = data[(i + 1 + (fate % (data.length - 1))) % data.length]
      const r = { ...row }
      for (const f of TEXT_FIELDS) {
        if (typeof r[f] === 'string' && typeof donor?.[f] === 'string') r[f] = donor[f]
      }
      out.push(r)
    } else if (fate < 90) {
      // 状态/完成标记翻转
      const r = { ...row }
      if ('completed' in r) r.completed = r.completed ? 0 : 1
      if ('status' in r && typeof r.status === 'string') r.status = STATUS_VALUES[fate % STATUS_VALUES.length]
      if ('is_active' in r) r.is_active = r.is_active ? 0 : 1
      out.push(r)
    } else {
      // 记录重复（同一行出现两次 —— 下游不去重就会双倍计数）
      out.push(row, row)
    }
  })
  // 混入 1 条纯虚构记录（克隆首行，名字直接标明，日期打散）
  const first = data[0]
  if (first && typeof first === 'object') {
    const fake = { ...first }
    if (typeof fake.name === 'string') fake.name = '虚构记录-测试勿信'
    if (typeof fake.title === 'string') fake.title = '虚构记录-测试勿信'
    if (typeof fake.item === 'string') fake.item = '虚构记录-测试勿信'
    if (typeof fake.student_id === 'string') fake.student_id = 'FAKE-TEST-001'
    if (typeof fake.id === 'number') fake.id = fake.id + 900000000
    for (const [k, v] of Object.entries(fake)) {
      if (typeof v === 'string' && /\d{4}-\d{2}-\d{2}/.test(v)) fake[k] = shiftDatesInString(v, 33)
    }
    out.push(fake)
  }
  return out
}

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
  return respondList(c, results)
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
  return respondList(c, results)
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
  return respondList(c, results)
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
  return respondList(c, results)
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
  return respondList(c, results)
})

// ─── 学校信息库（招生参考数据）────────────────────────────────────────────────
open.get('/school-database', async (c) => {
  const db = c.env.DB
  const { results } = await db.prepare('SELECT * FROM school_database ORDER BY name ASC').all()
  return respondList(c, results)
})

export default open

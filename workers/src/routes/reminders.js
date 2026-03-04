// 截止日提醒路由 - Cloudflare Workers 版本
// 对应 D1 表：deadline_reminders
import { Hono } from 'hono'

const reminders = new Hono()

// ─── 获取近期需要提醒的截止事项（学生端）───────────────────────────────────────
// 查询范围：今天 + 未来3天内截止的未完成事件
reminders.get('/today', async (c) => {
  const user = c.get('user')
  if (user.role !== 'student' || !user.studentId) {
    return c.json({ success: true, data: [] })
  }

  const db = c.env.DB
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  // 未来3天
  const future = new Date()
  future.setDate(future.getDate() + 3)
  const futureDate = future.toISOString().split('T')[0]

  // 查询今天到未来3天内截止的事件（未完成 + 未确认）
  const { results: events } = await db.prepare(`
    SELECT e.id, e.title, e.date, e.type, e.category, e.notes, e.school_id,
           s.name as school_name
    FROM events e
    LEFT JOIN schools s ON e.school_id = s.id
    WHERE e.student_id = ? AND e.date >= ? AND e.date <= ? AND e.completed = 0
    ORDER BY e.date ASC, e.type ASC
  `).bind(user.studentId, today, futureDate).all()

  if (events.length === 0) {
    return c.json({ success: true, data: [] })
  }

  // 检查哪些已经确认过了（按 event_id 查询，不限定日期）
  const eventIds = events.map(e => e.id)
  const placeholders = eventIds.map(() => '?').join(',')
  const { results: acknowledged } = await db.prepare(`
    SELECT event_id FROM deadline_reminders
    WHERE student_id = ? AND acknowledged = 1 AND event_id IN (${placeholders})
  `).bind(user.studentId, ...eventIds).all()

  const ackedIds = new Set(acknowledged.map(a => a.event_id))

  // 过滤出未确认的，附带剩余天数
  const todayMs = new Date(today).getTime()
  const unacknowledged = events.filter(e => !ackedIds.has(e.id)).map(e => {
    const eventMs = new Date(e.date).getTime()
    const daysLeft = Math.round((eventMs - todayMs) / (1000 * 60 * 60 * 24))
    return {
      id: e.id,
      title: e.title,
      date: e.date,
      type: e.type,
      category: e.category,
      notes: e.notes,
      schoolName: e.school_name || '',
      daysLeft, // 0=今天, 1=明天, 2=后天, 3=大后天
    }
  })

  return c.json({ success: true, data: unacknowledged })
})

// ─── 确认提醒（学生点击确认后调用）────────────────────────────────────────────
reminders.post('/acknowledge', async (c) => {
  const user = c.get('user')
  if (user.role !== 'student' || !user.studentId) {
    return c.json({ success: false, message: '仅学生可确认提醒' }, 403)
  }

  const body = await c.req.json()
  const { eventId, eventTitle } = body
  if (!eventId) {
    return c.json({ success: false, message: '缺少事件ID' }, 400)
  }

  const db = c.env.DB
  const today = new Date().toISOString().split('T')[0]

  await db.prepare(`
    INSERT INTO deadline_reminders (student_id, event_id, event_title, deadline_date, acknowledged, acknowledged_at)
    VALUES (?, ?, ?, ?, 1, datetime('now'))
  `).bind(user.studentId, eventId, eventTitle || '', today).run()

  return c.json({ success: true, message: '提醒已确认' })
})

// ─── 获取提醒确认历史（管理员/老师查看）──────────────────────────────────────
reminders.get('/history/:studentId', async (c) => {
  const user = c.get('user')
  if (user.role === 'student') {
    return c.json({ success: false, message: '权限不足' }, 403)
  }

  const { studentId } = c.req.param()
  const db = c.env.DB

  const { results } = await db.prepare(`
    SELECT * FROM deadline_reminders WHERE student_id = ? ORDER BY acknowledged_at DESC LIMIT 50
  `).bind(studentId).all()

  return c.json({ success: true, data: results })
})

export default reminders

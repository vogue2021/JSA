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

// ─── 获取事件的确认状态（用于时间线卡片显示"学生已确认"）─────────────────────
reminders.get('/acknowledged/:studentId', async (c) => {
  const { studentId } = c.req.param()
  const db = c.env.DB

  const { results } = await db.prepare(`
    SELECT event_id, acknowledged_at FROM deadline_reminders
    WHERE student_id = ? AND acknowledged = 1
  `).bind(studentId).all()

  // 返回 { eventId: acknowledgedAt } 的映射
  const map = {}
  results.forEach(r => { map[r.event_id] = r.acknowledged_at })

  return c.json({ success: true, data: map })
})

// ─── 获取提醒设置 ──────────────────────────────────────────────────────────
reminders.get('/settings', async (c) => {
  const user = c.get('user')
  const db = c.env.DB

  // 从 localStorage 方案改为用简单的 KV 存储（暂用 users 表的一个 JSON 列或独立表）
  // 这里我们用 deadline_reminders 表的特殊记录来存储设置
  const settings = await db.prepare(`
    SELECT event_title as settings_json FROM deadline_reminders
    WHERE student_id = ? AND event_id = -1
  `).bind(user.studentId || user.id).first()

  const defaultSettings = { reminderTime: '09:00', reminderCount: 1, reminderInterval: 60 }

  if (settings && settings.settings_json) {
    try {
      return c.json({ success: true, data: JSON.parse(settings.settings_json) })
    } catch { /* fall through */ }
  }

  return c.json({ success: true, data: defaultSettings })
})

// ─── 保存提醒设置 ──────────────────────────────────────────────────────────
reminders.post('/settings', async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const db = c.env.DB

  const settings = {
    reminderTime: body.reminderTime || '09:00',
    reminderCount: Math.min(Math.max(body.reminderCount || 1, 1), 5),
    reminderInterval: Math.min(Math.max(body.reminderInterval || 60, 15), 240),
  }

  const studentId = user.studentId || user.id
  const settingsJson = JSON.stringify(settings)

  // 使用 event_id = -1 作为设置记录的特殊标识
  const existing = await db.prepare(`
    SELECT id FROM deadline_reminders WHERE student_id = ? AND event_id = -1
  `).bind(studentId).first()

  if (existing) {
    await db.prepare(`
      UPDATE deadline_reminders SET event_title = ?, acknowledged_at = datetime('now') WHERE id = ?
    `).bind(settingsJson, existing.id).run()
  } else {
    await db.prepare(`
      INSERT INTO deadline_reminders (student_id, event_id, event_title, deadline_date, acknowledged, acknowledged_at)
      VALUES (?, -1, ?, '', 0, datetime('now'))
    `).bind(studentId, settingsJson).run()
  }

  return c.json({ success: true, message: '提醒设置已保存', data: settings })
})

export default reminders

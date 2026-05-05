// 截止日提醒路由 - Cloudflare Workers 版本
// 对应 D1 表：deadline_reminders
import { Hono } from 'hono'

const reminders = new Hono()

// ─── 工具函数：从查询参数或请求方推断"客户端本地日期 YYYY-MM-DD" ────────────
// 需求57：Worker 默认 UTC 时区，直接 new Date().toISOString() 在东八区的凌晨 0~8 点
// 会返回"昨天"的日期，导致今天截止的事件查不出来。因此由前端携带本地日期过来。
function resolveClientDate(c) {
  const q = c.req.query('clientDate')
  if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) return q
  // 降级：尝试 Header X-Client-Date
  const h = c.req.header('X-Client-Date')
  if (h && /^\d{4}-\d{2}-\d{2}$/.test(h)) return h
  // 最终降级：使用 UTC+8（大多数用户在中国/日本时区），避免 Worker UTC 日期偏差
  const now = new Date()
  const shifted = new Date(now.getTime() + 8 * 3600 * 1000)
  return shifted.toISOString().split('T')[0]
}

// ─── 获取近期需要提醒的截止事项（学生端）───────────────────────────────────────
// 查询范围：今天 + 未来 N 天内截止的未完成事件（N 读自学生的提醒设置 reminderDaysBefore，默认 3）
reminders.get('/today', async (c) => {
  const user = c.get('user')
  if (user.role !== 'student' || !user.studentId) {
    return c.json({ success: true, data: [] })
  }

  const db = c.env.DB
  // 需求57修复：使用客户端本地日期，避免 UTC 时区偏差
  const today = resolveClientDate(c)

  // 读取学生的提醒设置，取出 reminderDaysBefore（提前多少天开始提醒）
  let daysBefore = 3
  try {
    const settingsRow = await db.prepare(`
      SELECT event_title as settings_json FROM deadline_reminders
      WHERE student_id = ? AND event_id = -1
    `).bind(user.studentId).first()
    if (settingsRow && settingsRow.settings_json) {
      const s = JSON.parse(settingsRow.settings_json)
      const n = parseInt(s.reminderDaysBefore, 10)
      if (Number.isFinite(n) && n >= 1 && n <= 30) daysBefore = n
    }
  } catch { /* 保持默认 3 天 */ }

  // 未来 daysBefore 天（以 today 为基准加天数，避免再引入时区问题）
  const todayDt = new Date(today + 'T00:00:00Z')
  const future = new Date(todayDt.getTime() + daysBefore * 86400000)
  const futureDate = future.toISOString().split('T')[0]

  // 查询今天到未来 daysBefore 天内截止的事件（未完成 + 未确认）
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

  // 需求57修复：仅排除"今天已确认"的事件——过去日期的确认不该影响今天的提醒
  const eventIds = events.map(e => e.id)
  const placeholders = eventIds.map(() => '?').join(',')
  const { results: acknowledged } = await db.prepare(`
    SELECT event_id FROM deadline_reminders
    WHERE student_id = ? AND acknowledged = 1 AND event_id IN (${placeholders})
      AND deadline_date = ?
  `).bind(user.studentId, ...eventIds, today).all()

  const ackedIds = new Set(acknowledged.map(a => a.event_id))

  // 过滤出未确认的，附带剩余天数
  const todayMs = todayDt.getTime()
  const unacknowledged = events.filter(e => !ackedIds.has(e.id)).map(e => {
    const eventMs = new Date(e.date + 'T00:00:00Z').getTime()
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
  // 需求57修复：使用客户端本地日期
  const today = resolveClientDate(c)

  // 需求57修复：同 student + event + date 只保留一条记录（防止表膨胀）
  const existing = await db.prepare(`
    SELECT id FROM deadline_reminders
    WHERE student_id = ? AND event_id = ? AND deadline_date = ?
  `).bind(user.studentId, eventId, today).first()

  if (existing) {
    await db.prepare(`
      UPDATE deadline_reminders SET acknowledged = 1, acknowledged_at = datetime('now'),
             event_title = ? WHERE id = ?
    `).bind(eventTitle || '', existing.id).run()
  } else {
    await db.prepare(`
      INSERT INTO deadline_reminders (student_id, event_id, event_title, deadline_date, acknowledged, acknowledged_at)
      VALUES (?, ?, ?, ?, 1, datetime('now'))
    `).bind(user.studentId, eventId, eventTitle || '', today).run()
  }

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

  // 需求57修复：排除 event_id = -1（是设置行，不是真实事件）
  const { results } = await db.prepare(`
    SELECT event_id, acknowledged_at FROM deadline_reminders
    WHERE student_id = ? AND acknowledged = 1 AND event_id <> -1
  `).bind(studentId).all()

  // 返回 { eventId: acknowledgedAt } 的映射
  const map = {}
  results.forEach(r => { map[r.event_id] = r.acknowledged_at })

  return c.json({ success: true, data: map })
})

// ─── 获取提醒设置 ──────────────────────────────────────────────────────────
// 需求56：老师/管理员可通过 ?studentId=xxx 读取指定学生的设置（用于在老师端展示/编辑该学生的提醒时间）
reminders.get('/settings', async (c) => {
  const user = c.get('user')
  const db = c.env.DB

  const defaultSettings = { reminderTime: '09:00', reminderCount: 1, reminderInterval: 60, reminderDaysBefore: 3 }

  // 解析要读取哪个学生的设置
  let targetStudentId = null
  if (user.role === 'student' && user.studentId) {
    // 学生：只能读自己的
    targetStudentId = user.studentId
  } else if ((user.role === 'teacher' || user.role === 'admin')) {
    // 老师/管理员：可通过 query 参数指定
    const qsId = c.req.query('studentId')
    if (qsId) targetStudentId = qsId
  }

  if (!targetStudentId) {
    return c.json({ success: true, data: defaultSettings })
  }

  // 从 deadline_reminders 表的特殊记录（event_id = -1）中读取设置
  const settings = await db.prepare(`
    SELECT event_title as settings_json FROM deadline_reminders
    WHERE student_id = ? AND event_id = -1
  `).bind(targetStudentId).first()

  if (settings && settings.settings_json) {
    try {
      return c.json({ success: true, data: JSON.parse(settings.settings_json) })
    } catch { /* fall through */ }
  }

  return c.json({ success: true, data: defaultSettings })
})

// ─── 保存提醒设置 ──────────────────────────────────────────────────────────
// 需求56修复：
// - 学生角色：仅能为自己保存（维持原行为）
// - 老师/管理员：必须传 targetStudentIds: number[]（一个或多个学生），
//   否则无法持久化到学生记录中——这样学生登录时才能读到老师为他设置的参数。
reminders.post('/settings', async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const db = c.env.DB

  // 需求57修复：严格校验 reminderTime 格式 HH:MM（0-23:0-59）
  let reminderTime = body.reminderTime || '09:00'
  const m = /^(\d{1,2}):(\d{2})$/.exec(reminderTime)
  if (!m) {
    return c.json({ success: false, message: 'reminderTime 格式错误，应为 HH:MM' }, 400)
  }
  const hh = parseInt(m[1], 10)
  const mm = parseInt(m[2], 10)
  if (!(hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59)) {
    return c.json({ success: false, message: 'reminderTime 范围错误（时0-23，分0-59）' }, 400)
  }
  reminderTime = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`

  const settings = {
    reminderTime,
    reminderCount: Math.min(Math.max(parseInt(body.reminderCount, 10) || 1, 1), 5),
    reminderInterval: Math.min(Math.max(parseInt(body.reminderInterval, 10) || 60, 15), 240),
    reminderDaysBefore: Math.min(Math.max(parseInt(body.reminderDaysBefore, 10) || 3, 1), 30),
  }
  const settingsJson = JSON.stringify(settings)

  // 决定要写入哪些学生 ID
  let targetIds = []
  if (user.role === 'student' && user.studentId) {
    targetIds = [user.studentId]
  } else if (user.role === 'teacher' || user.role === 'admin') {
    // 优先用请求体中指定的 targetStudentIds
    if (Array.isArray(body.targetStudentIds) && body.targetStudentIds.length > 0) {
      targetIds = body.targetStudentIds.filter(Boolean)
    }
    // 可选：applyToAllMyStudents=true 时，老师把设置应用给自己名下所有学生
    else if (body.applyToAllMyStudents === true && user.role === 'teacher' && user.teacherId) {
      try {
        const { results } = await db.prepare(`
          SELECT student_id FROM students WHERE teacher_id = ?
        `).bind(user.teacherId).all()
        targetIds = (results || []).map(r => r.student_id).filter(Boolean)
      } catch (err) {
        console.error('查询老师名下学生失败:', err)
      }
    }
  }

  if (!targetIds || targetIds.length === 0) {
    // 没有目标学生时仍返回成功但不落库——前端 localStorage 自行保留
    return c.json({
      success: true,
      message: '提醒设置已保存（本地，未关联学生）',
      data: { ...settings, savedStudentIds: [], failedStudentIds: [] },
    })
  }

  const saved = []
  const failed = []
  for (const sid of targetIds) {
    try {
      const existing = await db.prepare(`
        SELECT id FROM deadline_reminders WHERE student_id = ? AND event_id = -1
      `).bind(sid).first()

      if (existing) {
        await db.prepare(`
          UPDATE deadline_reminders SET event_title = ?, acknowledged_at = datetime('now') WHERE id = ?
        `).bind(settingsJson, existing.id).run()
      } else {
        await db.prepare(`
          INSERT INTO deadline_reminders (student_id, event_id, event_title, deadline_date, acknowledged, acknowledged_at)
          VALUES (?, -1, ?, '', 0, datetime('now'))
        `).bind(sid, settingsJson).run()
      }
      saved.push(sid)
    } catch (err) {
      console.error('保存提醒设置到DB失败 (studentId=' + sid + '):', err)
      failed.push(sid)
    }
  }

  return c.json({
    success: true,
    message: `提醒设置已保存到 ${saved.length} 个学生账号${failed.length ? `（${failed.length} 个失败）` : ''}`,
    data: {
      ...settings,
      savedStudentIds: saved,
      failedStudentIds: failed,
    },
  })
})

export default reminders

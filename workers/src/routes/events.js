// 事件路由 - Cloudflare Workers 版本
import { Hono } from 'hono'

const events = new Hono()

const isAdmin = (user) => user?.role === 'admin'
const isTeacher = (user) => user?.role === 'teacher'
const isStudent = (user) => user?.role === 'student'

const calculateDaysLeft = (dateString) => {
  const diffTime = new Date(dateString) - new Date()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

// 通过 student_id 或 user.id 查找学生
const getStudentByIdentifier = async (db, identifier) => {
  return db.prepare(
    'SELECT * FROM students WHERE student_id = ? OR user_id = ? LIMIT 1'
  ).bind(identifier, identifier).first()
}

const canAccessStudent = (user, student) => {
  if (!user || !student) return false
  if (isAdmin(user)) return true
  if (isTeacher(user)) return student.teacher_id === user.teacherId
  if (isStudent(user)) {
    return String(student.student_id) === String(user.studentId) ||
           String(student.user_id) === String(user.id)
  }
  return false
}

// ─── 获取学生的所有事件 ───────────────────────────────────────────────────────
events.get('/student/:studentId', async (c) => {
  const user = c.get('user')
  const { studentId } = c.req.param()
  const db = c.env.DB

  const student = await getStudentByIdentifier(db, studentId)
  if (!student) return c.json({ success: false, message: '学生不存在' }, 404)
  if (!canAccessStudent(user, student)) return c.json({ success: false, message: '无权访问该学生数据' }, 403)

  const { results } = await db.prepare(
    'SELECT * FROM events WHERE student_id = ? ORDER BY date ASC'
  ).bind(student.student_id).all()

  results.forEach(event => {
    event.days_left = calculateDaysLeft(event.date)
    event.urgent = event.days_left <= 7 && event.days_left >= 0
  })

  return c.json({ success: true, data: results })
})

// ─── 获取单个事件 ─────────────────────────────────────────────────────────────
events.get('/:id', async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()
  const db = c.env.DB

  const event = await db.prepare('SELECT * FROM events WHERE id = ?').bind(id).first()
  if (!event) return c.json({ success: false, message: '事件不存在' }, 404)

  // 权限校验
  if (isStudent(user) && String(event.student_id) !== String(user.studentId)) {
    return c.json({ success: false, message: '无权访问该事件' }, 403)
  }
  if (isTeacher(user)) {
    const stu = await db.prepare('SELECT teacher_id FROM students WHERE student_id = ?').bind(event.student_id).first()
    if (stu?.teacher_id !== user.teacherId) {
      return c.json({ success: false, message: '无权访问该事件' }, 403)
    }
  }

  event.days_left = calculateDaysLeft(event.date)
  event.urgent = event.days_left <= 7 && event.days_left >= 0

  return c.json({ success: true, data: event })
})

// ─── 创建事件 ─────────────────────────────────────────────────────────────────
events.post('/', async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const { student_id, school_id, type, title, date, category, urgent, notes, completed } = body

  if (!student_id || !type || !title || !date || !category) {
    return c.json({ success: false, message: '缺少必填字段' }, 400)
  }

  const db = c.env.DB
  const student = await getStudentByIdentifier(db, student_id)
  if (!student) return c.json({ success: false, message: '学生不存在' }, 404)
  if (!canAccessStudent(user, student)) return c.json({ success: false, message: '无权为该学生创建事件' }, 403)

  const days_left = calculateDaysLeft(date)

  const result = await db.prepare(`
    INSERT INTO events (student_id, school_id, type, title, date, days_left, category, urgent, notes, completed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    student.student_id, school_id || null, type, title, date, days_left, category,
    urgent !== undefined ? (urgent ? 1 : 0) : (days_left <= 7 && days_left >= 0 ? 1 : 0),
    notes || null, completed ? 1 : 0
  ).run()

  const newId = result.meta?.last_row_id
  const event = newId
    ? await db.prepare('SELECT * FROM events WHERE id = ?').bind(newId).first()
    : await db.prepare('SELECT * FROM events WHERE student_id = ? ORDER BY id DESC LIMIT 1').bind(student.student_id).first()
  return c.json({ success: true, message: '事件添加成功', data: event }, 201)
})

// ─── 更新事件 ─────────────────────────────────────────────────────────────────
events.put('/:id', async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()
  const db = c.env.DB

  const event = await db.prepare('SELECT * FROM events WHERE id = ?').bind(id).first()
  if (!event) return c.json({ success: false, message: '事件不存在' }, 404)

  // 权限校验
  if (isStudent(user) && String(event.student_id) !== String(user.studentId)) {
    return c.json({ success: false, message: '无权修改该事件' }, 403)
  }
  if (isTeacher(user)) {
    const stu = await db.prepare('SELECT teacher_id FROM students WHERE student_id = ?').bind(event.student_id).first()
    if (stu?.teacher_id !== user.teacherId) return c.json({ success: false, message: '无权修改该事件' }, 403)
  }

  const body = await c.req.json()
  const newDate = body.date || event.date
  const days_left = calculateDaysLeft(newDate)

  await db.prepare(`
    UPDATE events SET
      type = ?, title = ?, date = ?, days_left = ?, category = ?,
      urgent = ?, notes = ?, completed = ?
    WHERE id = ?
  `).bind(
    body.type || event.type,
    body.title || event.title,
    newDate,
    days_left,
    body.category || event.category,
    body.urgent !== undefined ? (body.urgent ? 1 : 0) : (days_left <= 7 && days_left >= 0 ? 1 : 0),
    body.notes !== undefined ? body.notes : event.notes,
    body.completed !== undefined ? (body.completed ? 1 : 0) : event.completed,
    id
  ).run()

  const updatedEvent = await db.prepare('SELECT * FROM events WHERE id = ?').bind(id).first()
  return c.json({ success: true, message: '事件更新成功', data: updatedEvent })
})

// ─── 删除事件 ─────────────────────────────────────────────────────────────────
events.delete('/:id', async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()
  const db = c.env.DB

  const event = await db.prepare('SELECT * FROM events WHERE id = ?').bind(id).first()
  if (!event) return c.json({ success: false, message: '事件不存在' }, 404)

  if (isStudent(user) && String(event.student_id) !== String(user.studentId)) {
    return c.json({ success: false, message: '无权删除该事件' }, 403)
  }
  if (isTeacher(user)) {
    const stu = await db.prepare('SELECT teacher_id FROM students WHERE student_id = ?').bind(event.student_id).first()
    if (stu?.teacher_id !== user.teacherId) return c.json({ success: false, message: '无权删除该事件' }, 403)
  }

  if (event.school_id) {
    return c.json({ success: false, message: '学校关联事件不能单独删除，请通过学校管理删除' }, 400)
  }

  await db.prepare('DELETE FROM events WHERE id = ?').bind(id).run()
  return c.json({ success: true, message: '事件删除成功' })
})

// ─── 切换事件完成状态 ─────────────────────────────────────────────────────────
events.patch('/:id/toggle', async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()
  const db = c.env.DB

  const event = await db.prepare('SELECT * FROM events WHERE id = ?').bind(id).first()
  if (!event) return c.json({ success: false, message: '事件不存在' }, 404)

  if (isStudent(user) && String(event.student_id) !== String(user.studentId)) {
    return c.json({ success: false, message: '无权操作该事件' }, 403)
  }
  if (isTeacher(user)) {
    const stu = await db.prepare('SELECT teacher_id FROM students WHERE student_id = ?').bind(event.student_id).first()
    if (stu?.teacher_id !== user.teacherId) return c.json({ success: false, message: '无权操作该事件' }, 403)
  }

  const newCompleted = event.completed ? 0 : 1
  await db.prepare('UPDATE events SET completed = ? WHERE id = ?').bind(newCompleted, id).run()
  const updatedEvent = await db.prepare('SELECT * FROM events WHERE id = ?').bind(id).first()

  return c.json({ success: true, message: '事件状态更新成功', data: updatedEvent })
})

export default events

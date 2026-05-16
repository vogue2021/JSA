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

// 【新需求68】老师访问学生权限：升学老师(teacher_id) / 学管老师(academic_advisor_id) / 顾问老师(consultant_id)
//   三个身份任一匹配即可访问。之前这里只检查了 teacher_id 实际上是 BUG ——
//   导致学管老师不能为自己负责学生创建事件。本次一并修复。
// 【新需求70】老师拥有 view_all_students 权限时，可访问任何学生数据（让权限真正生效）
const canAccessStudent = (user, student) => {
  if (!user || !student) return false
  if (isAdmin(user)) return true
  if (isTeacher(user)) {
    if (student.teacher_id === user.teacherId
        || student.academic_advisor_id === user.teacherId
        || student.consultant_id === user.teacherId) return true
    // 【新需求70】不是自己负责的学生 → 看 view_all_students 权限
    if (Array.isArray(user.permissions) && user.permissions.includes('view_all_students')) return true
    return false
  }
  if (isStudent(user)) {
    return String(student.student_id) === String(user.studentId) ||
           String(student.user_id) === String(user.id)
  }
  return false
}

// 【新需求68】以 student_id 查学生三身份后检查老师访问权限的辅助函数
// 【新需求70】老师拥有 view_all_students 权限时，可访问任何学生数据（让权限真正生效）
async function teacherCanAccessByStudentId(db, user, studentId) {
  if (!isTeacher(user)) return true
  const stu = await db.prepare(
    'SELECT teacher_id, academic_advisor_id, consultant_id FROM students WHERE student_id = ?'
  ).bind(studentId).first()
  if (!stu) return false
  if (stu.teacher_id === user.teacherId
      || stu.academic_advisor_id === user.teacherId
      || stu.consultant_id === user.teacherId) return true
  // 不是自己负责的学生 → 看 view_all_students 权限
  if (Array.isArray(user.permissions) && user.permissions.includes('view_all_students')) return true
  return false
}

// 【新需求70】老师拥有 edit_all_students 时，可编辑任何学生关联数据
//   返回 true 表示放行；用于事件/材料的 PUT/DELETE/toggle 等写接口。
async function teacherCanEditByStudentId(db, user, studentId) {
  if (!isTeacher(user)) return true
  const stu = await db.prepare(
    'SELECT teacher_id, academic_advisor_id, consultant_id FROM students WHERE student_id = ?'
  ).bind(studentId).first()
  if (!stu) return false
  if (stu.teacher_id === user.teacherId
      || stu.academic_advisor_id === user.teacherId
      || stu.consultant_id === user.teacherId) return true
  // 不是自己负责的学生 → 看 edit_all_students 权限
  if (Array.isArray(user.permissions) && user.permissions.includes('edit_all_students')) return true
  return false
}

// 【新需求69】老师“页面内编辑权限”后端兜底校验（与 materials.js 保持一致风格）。
//   读取 teachers 表的 permissions JSON，判断是否包含指定 permId（如 'edit_events'）。
//   admin / 学生 不走此校验（admin 全权；学生由各路由自行限定到自己数据）。
//   防止前端禁用/闸门被绕过（如手构 curl）。
async function teacherHasEditPerm(db, user, permId) {
  if (!isTeacher(user)) return true
  if (!user.teacherId) return false
  const t = await db.prepare(
    'SELECT permissions FROM teachers WHERE teacher_id = ?'
  ).bind(user.teacherId).first()
  if (!t) return false
  let perms = []
  try { perms = JSON.parse(t.permissions || '[]') } catch { perms = [] }
  if (!Array.isArray(perms)) perms = []
  return perms.includes(permId)
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
  if (isTeacher(user) && !(await teacherCanAccessByStudentId(db, user, event.student_id))) {
    return c.json({ success: false, message: '无权访问该事件' }, 403)
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
  // 【新需求69】后端兜底：老师需有 edit_events 权限
  if (isTeacher(user) && !(await teacherHasEditPerm(db, user, 'edit_events'))) {
    return c.json({ success: false, code: 'PERMISSION_DENIED', message: '您没有时间线的编辑权限，请联系管理员开通' }, 403)
  }
  // 【新需求70】为别人负责的学生创建事件需要 edit_all_students 权限
  if (isTeacher(user) && !(await teacherCanEditByStudentId(db, user, student.student_id))) {
    return c.json({ success: false, code: 'PERMISSION_DENIED', message: '您只能为自己负责的学生创建事件，要跨学生操作请联系管理员开通“编辑所有学生”权限' }, 403)
  }

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
  if (isTeacher(user) && !(await teacherCanEditByStudentId(db, user, event.student_id))) {
    return c.json({ success: false, code: 'PERMISSION_DENIED', message: '无权修改该事件（需 edit_all_students 权限才能修改他人学生的事件）' }, 403)
  }
  // 【新需求69】后端兜底：老师需有 edit_events 权限
  if (isTeacher(user) && !(await teacherHasEditPerm(db, user, 'edit_events'))) {
    return c.json({ success: false, code: 'PERMISSION_DENIED', message: '您没有时间线的编辑权限，请联系管理员开通' }, 403)
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
  if (isTeacher(user) && !(await teacherCanEditByStudentId(db, user, event.student_id))) {
    return c.json({ success: false, code: 'PERMISSION_DENIED', message: '无权删除该事件（需 edit_all_students 权限才能删除他人学生的事件）' }, 403)
  }
  // 【新需求69】后端兜底：老师需有 edit_events 权限
  if (isTeacher(user) && !(await teacherHasEditPerm(db, user, 'edit_events'))) {
    return c.json({ success: false, code: 'PERMISSION_DENIED', message: '您没有时间线的编辑权限，请联系管理员开通' }, 403)
  }

  if (event.school_id) {
    return c.json({ success: false, message: '学校关联事件不能单独删除，请通过学校管理删除' }, 400)
  }

  await db.prepare('DELETE FROM events WHERE id = ?').bind(id).run()
  return c.json({ success: true, message: '事件删除成功' })
})

// ─── 切换事件完成状态 ─────────────────────────────────────────────────────────
// 需求58：同时支持 PATCH 和 PUT。原因：Cloudflare Pages 的 _redirects 200 代理
// 在 CDN 层对 OPTIONS 预检自行代答，默认 Access-Control-Allow-Methods 不包含 PATCH，
// 导致浏览器判定 PATCH 被拒而不发真实请求。PUT 在默认允许列表内，可绕开该限制。
events.on(['PATCH', 'PUT'], '/:id/toggle', async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()
  const db = c.env.DB

  const event = await db.prepare('SELECT * FROM events WHERE id = ?').bind(id).first()
  if (!event) return c.json({ success: false, message: '事件不存在' }, 404)

  if (isStudent(user) && String(event.student_id) !== String(user.studentId)) {
    return c.json({ success: false, message: '无权操作该事件' }, 403)
  }
  if (isTeacher(user) && !(await teacherCanEditByStudentId(db, user, event.student_id))) {
    return c.json({ success: false, code: 'PERMISSION_DENIED', message: '无权操作该事件（需 edit_all_students 权限才能操作他人学生的事件）' }, 403)
  }
  // 【新需求69】后端兜底：完成状态划动也是编辑行为，需 edit_events 权限
  if (isTeacher(user) && !(await teacherHasEditPerm(db, user, 'edit_events'))) {
    return c.json({ success: false, code: 'PERMISSION_DENIED', message: '您没有时间线的编辑权限，请联系管理员开通' }, 403)
  }

  const newCompleted = event.completed ? 0 : 1
  await db.prepare('UPDATE events SET completed = ? WHERE id = ?').bind(newCompleted, id).run()
  const updatedEvent = await db.prepare('SELECT * FROM events WHERE id = ?').bind(id).first()

  return c.json({ success: true, message: '事件状态更新成功', data: updatedEvent })
})

export default events

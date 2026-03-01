// 学生路由 - Cloudflare Workers 版本
import { Hono } from 'hono'

const students = new Hono()

const isAdmin = (user) => user?.role === 'admin'
const isTeacher = (user) => user?.role === 'teacher'
const isStudent = (user) => user?.role === 'student'

// ─── 搜索接口（放在 /:id 前面避免被参数路由遮蔽）─────────────────────────────
students.get('/search/query', async (c) => {
  const user = c.get('user')
  if (!isAdmin(user) && !isTeacher(user)) {
    return c.json({ success: false, message: '权限不足' }, 403)
  }

  const { q, teacher_id } = c.req.query()
  const db = c.env.DB

  let sql = 'SELECT * FROM users WHERE role = \'student\''
  const params = []

  if (isTeacher(user)) {
    sql += ' AND teacher_id = ?'
    params.push(user.teacherId || '__none__')
  }
  if (q) {
    sql += ' AND (name LIKE ? OR email LIKE ? OR student_id LIKE ?)'
    params.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }
  if (teacher_id && isAdmin(user)) {
    sql += ' AND teacher_id = ?'
    params.push(teacher_id)
  }

  const { results } = await db.prepare(sql).bind(...params).all()
  return c.json({ success: true, data: results })
})

// ─── 获取学生列表 ─────────────────────────────────────────────────────────────
students.get('/', async (c) => {
  const user = c.get('user')
  const db = c.env.DB

  let sql = 'SELECT * FROM users WHERE role = \'student\''
  const params = []

  if (isAdmin(user)) {
    // 全部可见
  } else if (isTeacher(user)) {
    sql += ' AND teacher_id = ?'
    params.push(user.teacherId || '__none__')
  } else if (isStudent(user)) {
    sql += ' AND id = ?'
    params.push(user.id)
  } else {
    return c.json({ success: false, message: '权限不足' }, 403)
  }

  const { results } = await db.prepare(sql).bind(...params).all()
  return c.json({ success: true, data: results })
})

// ─── 按老师获取学生 ───────────────────────────────────────────────────────────
students.get('/teacher/:teacherId', async (c) => {
  const user = c.get('user')
  const { teacherId } = c.req.param()

  if (!isAdmin(user) && !(isTeacher(user) && user.teacherId === teacherId)) {
    return c.json({ success: false, message: '无权查看该老师的学生' }, 403)
  }

  const db = c.env.DB
  const { results } = await db.prepare(
    'SELECT * FROM users WHERE role = \'student\' AND teacher_id = ?'
  ).bind(teacherId).all()

  return c.json({ success: true, data: results })
})

// ─── 获取单个学生（含统计）────────────────────────────────────────────────────
students.get('/:id', async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()
  const db = c.env.DB

  const student = await db.prepare(
    'SELECT * FROM users WHERE id = ? AND role = \'student\''
  ).bind(id).first()

  if (!student) return c.json({ success: false, message: '学生不存在' }, 404)

  if (isStudent(user) && user.id !== id) {
    return c.json({ success: false, message: '无权查看该学生信息' }, 403)
  }
  if (isTeacher(user) && student.teacher_id !== user.teacherId) {
    return c.json({ success: false, message: '无权查看该学生信息' }, 403)
  }

  const studentId = student.student_id
  const [schoolCount, eventCount, materials] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM schools WHERE student_id = ?').bind(studentId).first(),
    db.prepare('SELECT COUNT(*) as count FROM events WHERE student_id = ? AND completed = 0').bind(studentId).first(),
    db.prepare('SELECT completed FROM materials WHERE student_id = ?').bind(studentId).all()
  ])

  const totalMaterials = materials.results.length
  const completedMaterials = materials.results.filter(m => m.completed).length

  return c.json({
    success: true,
    data: {
      ...student,
      stats: {
        schoolCount: schoolCount?.count || 0,
        pendingEvents: eventCount?.count || 0,
        totalMaterials,
        completedMaterials,
        materialProgress: totalMaterials > 0 ? Math.round(completedMaterials / totalMaterials * 100) : 0
      }
    }
  })
})

// ─── 更新学生信息 ─────────────────────────────────────────────────────────────
students.put('/:id', async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()
  const body = await c.req.json()
  const db = c.env.DB

  const student = await db.prepare(
    'SELECT * FROM users WHERE id = ? AND role = \'student\''
  ).bind(id).first()

  if (!student) return c.json({ success: false, message: '学生不存在' }, 404)

  if (isStudent(user) && user.id !== id) {
    return c.json({ success: false, message: '无权修改该学生信息' }, 403)
  }
  if (isTeacher(user) && student.teacher_id !== user.teacherId) {
    return c.json({ success: false, message: '无权修改该学生信息' }, 403)
  }

  const fields = []
  const params = []

  if (body.name !== undefined) { fields.push('name = ?'); params.push(body.name) }
  if (body.email !== undefined) { fields.push('email = ?'); params.push(body.email) }

  if (isAdmin(user)) {
    if (body.student_id !== undefined) { fields.push('student_id = ?'); params.push(body.student_id) }
    if (body.teacher_id !== undefined) { fields.push('teacher_id = ?'); params.push(body.teacher_id) }
    if (body.is_active !== undefined) { fields.push('is_active = ?'); params.push(body.is_active) }
  }

  if (fields.length === 0) return c.json({ success: false, message: '没有可更新的字段' }, 400)

  fields.push('updated_at = datetime(\'now\')')
  params.push(id)

  await db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).bind(...params).run()
  const updated = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first()

  return c.json({ success: true, data: updated, message: '学生信息更新成功' })
})

// ─── 删除学生（仅管理员）─────────────────────────────────────────────────────
students.delete('/:id', async (c) => {
  const user = c.get('user')
  if (!isAdmin(user)) return c.json({ success: false, message: '仅管理员可删除学生' }, 403)

  const { id } = c.req.param()
  const db = c.env.DB

  const student = await db.prepare(
    'SELECT id FROM users WHERE id = ? AND role = \'student\''
  ).bind(id).first()

  if (!student) return c.json({ success: false, message: '学生不存在' }, 404)

  await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run()
  return c.json({ success: true, message: '学生已删除' })
})

// ─── 转移学生（仅管理员）─────────────────────────────────────────────────────
students.put('/:id/transfer', async (c) => {
  const user = c.get('user')
  if (!isAdmin(user)) return c.json({ success: false, message: '仅管理员可转移学生' }, 403)

  const { id } = c.req.param()
  const { teacher_id } = await c.req.json()

  if (!teacher_id) return c.json({ success: false, message: '请指定目标老师ID' }, 400)

  const db = c.env.DB
  const student = await db.prepare(
    'SELECT id FROM users WHERE id = ? AND role = \'student\''
  ).bind(id).first()

  if (!student) return c.json({ success: false, message: '学生不存在' }, 404)

  await db.prepare(
    'UPDATE users SET teacher_id = ?, updated_at = datetime(\'now\') WHERE id = ?'
  ).bind(teacher_id, id).run()

  return c.json({ success: true, message: `学生已转移到教师 ${teacher_id}` })
})

export default students

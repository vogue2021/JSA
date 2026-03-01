// 老师路由 - Cloudflare Workers 版本
import { Hono } from 'hono'

const teachers = new Hono()

const isAdmin = (user) => user?.role === 'admin'
const isTeacher = (user) => user?.role === 'teacher'

// ─── 获取所有老师 ─────────────────────────────────────────────────────────────
teachers.get('/', async (c) => {
  const user = c.get('user')
  if (!isAdmin(user) && !isTeacher(user)) {
    return c.json({ success: false, message: '权限不足' }, 403)
  }

  const db = c.env.DB
  const { results } = await db.prepare(
    'SELECT id, name, email, teacher_id, is_active, created_at FROM users WHERE role = \'teacher\''
  ).all()

  return c.json({ success: true, data: results })
})

// ─── 获取老师的学生列表（含统计）─────────────────────────────────────────────
teachers.get('/:id/students', async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()

  if (!isAdmin(user) && !(isTeacher(user) && user.id === id)) {
    return c.json({ success: false, message: '无权查看该老师的学生' }, 403)
  }

  const db = c.env.DB
  const teacher = await db.prepare(
    'SELECT * FROM users WHERE id = ? AND role = \'teacher\''
  ).bind(id).first()

  if (!teacher) return c.json({ success: false, message: '老师不存在' }, 404)

  const { results: studentList } = await db.prepare(
    'SELECT * FROM users WHERE role = \'student\' AND teacher_id = ?'
  ).bind(teacher.teacher_id).all()

  // 为每个学生附加统计信息
  const studentsWithStats = await Promise.all(studentList.map(async (student) => {
    const studentId = student.student_id
    const [schoolCount, eventCount, materials] = await Promise.all([
      db.prepare('SELECT COUNT(*) as count FROM schools WHERE student_id = ?').bind(studentId).first(),
      db.prepare('SELECT COUNT(*) as count FROM events WHERE student_id = ? AND completed = 0').bind(studentId).first(),
      db.prepare('SELECT completed FROM materials WHERE student_id = ?').bind(studentId).all()
    ])

    const totalMaterials = materials.results.length
    const completedMaterials = materials.results.filter(m => m.completed).length

    return {
      ...student,
      stats: {
        schoolCount: schoolCount?.count || 0,
        pendingEvents: eventCount?.count || 0,
        totalMaterials,
        completedMaterials,
        materialProgress: totalMaterials > 0 ? Math.round(completedMaterials / totalMaterials * 100) : 0
      }
    }
  }))

  return c.json({ success: true, data: studentsWithStats })
})

// ─── 获取单个老师（含学生数）─────────────────────────────────────────────────
teachers.get('/:id', async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()

  if (!isAdmin(user) && !(isTeacher(user) && user.id === id)) {
    return c.json({ success: false, message: '无权查看该老师信息' }, 403)
  }

  const db = c.env.DB
  const teacher = await db.prepare(
    'SELECT id, name, email, teacher_id, is_active, created_at FROM users WHERE id = ? AND role = \'teacher\''
  ).bind(id).first()

  if (!teacher) return c.json({ success: false, message: '老师不存在' }, 404)

  const studentCount = await db.prepare(
    'SELECT COUNT(*) as count FROM users WHERE role = \'student\' AND teacher_id = ?'
  ).bind(teacher.teacher_id).first()

  return c.json({
    success: true,
    data: { ...teacher, studentCount: studentCount?.count || 0 }
  })
})

// ─── 更新老师信息 ─────────────────────────────────────────────────────────────
teachers.put('/:id', async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()

  if (!isAdmin(user) && !(isTeacher(user) && user.id === id)) {
    return c.json({ success: false, message: '无权修改该老师信息' }, 403)
  }

  const db = c.env.DB
  const teacher = await db.prepare(
    'SELECT id FROM users WHERE id = ? AND role = \'teacher\''
  ).bind(id).first()

  if (!teacher) return c.json({ success: false, message: '老师不存在' }, 404)

  const body = await c.req.json()
  const fields = []
  const params = []

  if (body.name !== undefined) { fields.push('name = ?'); params.push(body.name) }
  if (body.email !== undefined) { fields.push('email = ?'); params.push(body.email) }
  if (body.is_active !== undefined && isAdmin(user)) {
    fields.push('is_active = ?'); params.push(body.is_active)
  }

  if (fields.length === 0) return c.json({ success: false, message: '没有可更新的字段' }, 400)

  fields.push('updated_at = datetime(\'now\')')
  params.push(id)

  await db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).bind(...params).run()
  const updated = await db.prepare(
    'SELECT id, name, email, teacher_id, is_active, created_at FROM users WHERE id = ?'
  ).bind(id).first()

  return c.json({ success: true, data: updated, message: '老师信息更新成功' })
})

// ─── 删除老师（仅管理员）─────────────────────────────────────────────────────
teachers.delete('/:id', async (c) => {
  const user = c.get('user')
  if (!isAdmin(user)) return c.json({ success: false, message: '仅管理员可删除老师账号' }, 403)

  const { id } = c.req.param()
  const db = c.env.DB

  const teacher = await db.prepare(
    'SELECT * FROM users WHERE id = ? AND role = \'teacher\''
  ).bind(id).first()

  if (!teacher) return c.json({ success: false, message: '老师不存在' }, 404)

  const studentCount = await db.prepare(
    'SELECT COUNT(*) as count FROM users WHERE role = \'student\' AND teacher_id = ?'
  ).bind(teacher.teacher_id).first()

  if (studentCount?.count > 0) {
    return c.json({
      success: false,
      message: `该老师还有 ${studentCount.count} 个学生，请先转移学生后再删除`
    }, 400)
  }

  await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run()
  return c.json({ success: true, message: '老师账号已删除' })
})

export default teachers

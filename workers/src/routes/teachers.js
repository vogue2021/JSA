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
    `SELECT u.id, u.name, u.email, u.teacher_id, u.is_active, u.created_at,
            t.department, t.subject, t.permissions, t.gender, t.birthday, t.phone,
            t.email_contact, t.address, t.education, t.hire_date, t.employment_type, t.photo
     FROM users u
     LEFT JOIN teachers t ON u.teacher_id = t.teacher_id
     WHERE u.role = 'teacher'`
  ).all()

  // 解析 JSON 字段
  const data = results.map(r => ({
    ...r,
    permissions: (() => { try { return JSON.parse(r.permissions || '[]') } catch { return [] } })(),
  }))

  return c.json({ success: true, data })
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
    "SELECT * FROM users WHERE id = ? AND role = 'teacher'"
  ).bind(id).first()

  if (!teacher) return c.json({ success: false, message: '老师不存在' }, 404)

  const { results: studentList } = await db.prepare(
    'SELECT * FROM students WHERE teacher_id = ? AND is_active = 1'
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
    `SELECT u.id, u.name, u.email, u.teacher_id, u.is_active, u.created_at,
            t.department, t.subject, t.permissions, t.gender, t.birthday, t.phone,
            t.email_contact, t.address, t.education, t.hire_date, t.employment_type, t.photo
     FROM users u
     LEFT JOIN teachers t ON u.teacher_id = t.teacher_id
     WHERE u.id = ? AND u.role = 'teacher'`
  ).bind(id).first()

  if (!teacher) return c.json({ success: false, message: '老师不存在' }, 404)

  // 解析 JSON 字段
  teacher.permissions = (() => { try { return JSON.parse(teacher.permissions || '[]') } catch { return [] } })()

  const studentCount = await db.prepare(
    'SELECT COUNT(*) as count FROM students WHERE teacher_id = ?'
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
  const teacherUser = await db.prepare(
    "SELECT id, teacher_id FROM users WHERE id = ? AND role = 'teacher'"
  ).bind(id).first()

  if (!teacherUser) return c.json({ success: false, message: '老师不存在' }, 404)

  const body = await c.req.json()

  // 更新 users 表基本字段
  const userFields = []
  const userParams = []
  if (body.name !== undefined) { userFields.push('name = ?'); userParams.push(body.name) }
  if (body.email !== undefined) { userFields.push('email = ?'); userParams.push(body.email) }
  if (body.is_active !== undefined && isAdmin(user)) {
    userFields.push('is_active = ?'); userParams.push(body.is_active)
  }
  if (userFields.length > 0) {
    userFields.push("updated_at = datetime('now')")
    userParams.push(id)
    await db.prepare(`UPDATE users SET ${userFields.join(', ')} WHERE id = ?`).bind(...userParams).run()
  }

  // 更新 teachers 表扩展字段
  const teacherDetailFields = ['department', 'subject', 'gender', 'birthday', 'phone',
    'email_contact', 'address', 'education', 'hire_date', 'employment_type', 'photo']
  const hasTeacherFields = teacherDetailFields.some(f => body[f] !== undefined) || body.permissions !== undefined

  if (hasTeacherFields && teacherUser.teacher_id) {
    // 检查 teachers 表是否有记录
    const existing = await db.prepare('SELECT teacher_id FROM teachers WHERE teacher_id = ?').bind(teacherUser.teacher_id).first()

    if (existing) {
      // 更新
      const tFields = []
      const tParams = []
      teacherDetailFields.forEach(f => {
        if (body[f] !== undefined) { tFields.push(`${f} = ?`); tParams.push(body[f]) }
      })
      if (body.permissions !== undefined) {
        tFields.push('permissions = ?')
        tParams.push(JSON.stringify(body.permissions))
      }
      if (tFields.length > 0) {
        tParams.push(teacherUser.teacher_id)
        await db.prepare(`UPDATE teachers SET ${tFields.join(', ')} WHERE teacher_id = ?`).bind(...tParams).run()
      }
    } else {
      // 插入新记录
      await db.prepare(
        `INSERT INTO teachers (teacher_id, user_id, department, subject, permissions, gender, birthday, phone, email_contact, address, education, hire_date, employment_type, photo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        teacherUser.teacher_id, id,
        body.department || '', body.subject || '', JSON.stringify(body.permissions || []),
        body.gender || '', body.birthday || '', body.phone || '',
        body.email_contact || '', body.address || '', body.education || '',
        body.hire_date || '', body.employment_type || '', body.photo || ''
      ).run()
    }
  }

  // 返回更新后的完整数据
  const updated = await db.prepare(
    `SELECT u.id, u.name, u.email, u.teacher_id, u.is_active, u.created_at,
            t.department, t.subject, t.permissions, t.gender, t.birthday, t.phone,
            t.email_contact, t.address, t.education, t.hire_date, t.employment_type, t.photo
     FROM users u
     LEFT JOIN teachers t ON u.teacher_id = t.teacher_id
     WHERE u.id = ?`
  ).bind(id).first()

  if (updated) {
    updated.permissions = (() => { try { return JSON.parse(updated.permissions || '[]') } catch { return [] } })()
  }

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
    'SELECT COUNT(*) as count FROM students WHERE teacher_id = ?'
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

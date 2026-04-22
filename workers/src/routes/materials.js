// 材料路由 - Cloudflare Workers 版本
import { Hono } from 'hono'

const materials = new Hono()

const isAdmin = (user) => user?.role === 'admin'
const isTeacher = (user) => user?.role === 'teacher'
const isStudent = (user) => user?.role === 'student'

const getStudentByIdentifier = async (db, identifier) => {
  // 查询 students 表（支持 student_id 或 user_id 匹配）
  return db.prepare(
    'SELECT * FROM students WHERE student_id = ? OR user_id = ? LIMIT 1'
  ).bind(identifier, identifier).first()
}

const canAccessStudent = (user, student) => {
  if (!user || !student) return false
  if (isAdmin(user)) return true
  if (isTeacher(user)) {
    // 升学老师 或 学管老师 都可访问自己负责的学生
    return student.teacher_id === user.teacherId || student.academic_advisor_id === user.teacherId
  }
  // 学生只能访问自己的数据（通过 student_id 或 user_id 匹配）
  if (isStudent(user)) {
    return String(student.student_id) === String(user.studentId) ||
           String(student.user_id) === String(user.id)
  }
  return false
}

// ─── 获取学生的所有材料（分组）────────────────────────────────────────────────
materials.get('/student/:studentId', async (c) => {
  const user = c.get('user')
  const { studentId } = c.req.param()
  const { type, school_id } = c.req.query()
  const db = c.env.DB

  const student = await getStudentByIdentifier(db, studentId)
  if (!student) return c.json({ success: false, message: '学生不存在' }, 404)
  if (!canAccessStudent(user, student)) return c.json({ success: false, message: '无权访问该学生数据' }, 403)

  let sql = 'SELECT * FROM materials WHERE student_id = ?'
  const params = [student.student_id]
  if (type) { sql += ' AND type = ?'; params.push(type) }
  if (school_id) { sql += ' AND school_id = ?'; params.push(school_id) }
  sql += ' ORDER BY deadline ASC'

  const { results: matList } = await db.prepare(sql).bind(...params).all()

  // 分组
  const groupedMaterials = {
    general: matList.filter(m => m.type === 'general'),
    schoolSpecific: {}
  }

  const schoolMaterials = matList.filter(m => m.type === 'school' && m.school_id)
  if (schoolMaterials.length > 0) {
    const schoolIds = [...new Set(schoolMaterials.map(m => m.school_id))]
    const { results: schoolList } = await db.prepare(
      `SELECT id, name FROM schools WHERE id IN (${schoolIds.map(() => '?').join(',')})`
    ).bind(...schoolIds).all()

    const schoolMap = {}
    schoolList.forEach(s => { schoolMap[s.id] = s.name })

    schoolMaterials.forEach(mat => {
      const schoolName = schoolMap[mat.school_id]
      if (schoolName) {
        if (!groupedMaterials.schoolSpecific[schoolName]) {
          groupedMaterials.schoolSpecific[schoolName] = []
        }
        groupedMaterials.schoolSpecific[schoolName].push(mat)
      }
    })
  }

  return c.json({ success: true, data: groupedMaterials })
})

// ─── 获取材料统计 ─────────────────────────────────────────────────────────────
materials.get('/student/:studentId/stats', async (c) => {
  const user = c.get('user')
  const { studentId } = c.req.param()
  const db = c.env.DB

  const student = await getStudentByIdentifier(db, studentId)
  if (!student) return c.json({ success: false, message: '学生不存在' }, 404)
  if (!canAccessStudent(user, student)) return c.json({ success: false, message: '无权访问该学生数据' }, 403)

  const { results: matList } = await db.prepare(
    'SELECT type, completed FROM materials WHERE student_id = ?'
  ).bind(student.student_id).all()

  const stats = {
    total: matList.length,
    completed: matList.filter(m => m.completed).length,
    general: {
      total: matList.filter(m => m.type === 'general').length,
      completed: matList.filter(m => m.type === 'general' && m.completed).length
    },
    school: {
      total: matList.filter(m => m.type === 'school').length,
      completed: matList.filter(m => m.type === 'school' && m.completed).length
    }
  }
  stats.percentage = stats.total > 0 ? Math.round(stats.completed / stats.total * 100) : 0
  stats.general.percentage = stats.general.total > 0 ? Math.round(stats.general.completed / stats.general.total * 100) : 0
  stats.school.percentage = stats.school.total > 0 ? Math.round(stats.school.completed / stats.school.total * 100) : 0

  return c.json({ success: true, data: stats })
})

// ─── 获取单个材料 ─────────────────────────────────────────────────────────────
materials.get('/:id', async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()
  const db = c.env.DB

  const material = await db.prepare('SELECT * FROM materials WHERE id = ?').bind(id).first()
  if (!material) return c.json({ success: false, message: '材料不存在' }, 404)

  if (isStudent(user) && String(material.student_id) !== String(user.studentId)) {
    return c.json({ success: false, message: '无权访问该材料' }, 403)
  }
  if (isTeacher(user)) {
    const student = await db.prepare('SELECT teacher_id, academic_advisor_id FROM students WHERE student_id = ?').bind(material.student_id).first()
    if (student?.teacher_id !== user.teacherId && student?.academic_advisor_id !== user.teacherId) return c.json({ success: false, message: '无权访问该材料' }, 403)
  }

  return c.json({ success: true, data: material })
})

// ─── 创建材料 ─────────────────────────────────────────────────────────────────
materials.post('/', async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const { student_id, school_id, item, type, deadline, url, completed, checked_by, checked_at } = body

  if (!student_id || !item || !type || !deadline) {
    return c.json({ success: false, message: '缺少必填字段' }, 400)
  }
  if (type === 'school' && !school_id) {
    return c.json({ success: false, message: '学校专用材料必须关联学校' }, 400)
  }

  const db = c.env.DB
  const student = await getStudentByIdentifier(db, student_id)
  if (!student) return c.json({ success: false, message: '学生不存在' }, 404)
  if (!canAccessStudent(user, student)) return c.json({ success: false, message: '无权为该学生创建材料' }, 403)

  const result = await db.prepare(`
    INSERT INTO materials (student_id, school_id, item, type, deadline, url, completed, checked_by, checked_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    student.student_id, school_id || null, item, type, deadline,
    url || null, completed ? 1 : 0, checked_by || null, checked_at || null
  ).run()

  const newId = result.meta?.last_row_id
  const material = newId
    ? await db.prepare('SELECT * FROM materials WHERE id = ?').bind(newId).first()
    : await db.prepare('SELECT * FROM materials WHERE student_id = ? ORDER BY id DESC LIMIT 1').bind(student.student_id).first()
  return c.json({ success: true, message: '材料添加成功', data: material }, 201)
})

// ─── 更新材料 ─────────────────────────────────────────────────────────────────
materials.put('/:id', async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()
  const db = c.env.DB

  const material = await db.prepare('SELECT * FROM materials WHERE id = ?').bind(id).first()
  if (!material) return c.json({ success: false, message: '材料不存在' }, 404)

  if (isStudent(user) && String(material.student_id) !== String(user.studentId)) {
    return c.json({ success: false, message: '无权修改该材料' }, 403)
  }
  if (isTeacher(user)) {
    const student = await db.prepare('SELECT teacher_id, academic_advisor_id FROM students WHERE student_id = ?').bind(material.student_id).first()
    if (student?.teacher_id !== user.teacherId && student?.academic_advisor_id !== user.teacherId) return c.json({ success: false, message: '无权修改该材料' }, 403)
  }

  const body = await c.req.json()
  await db.prepare(`
    UPDATE materials SET
      item = ?, deadline = ?, url = ?, completed = ?, checked_by = ?, checked_at = ?
    WHERE id = ?
  `).bind(
    body.item || material.item,
    body.deadline || material.deadline,
    body.url !== undefined ? body.url : material.url,
    body.completed !== undefined ? (body.completed ? 1 : 0) : material.completed,
    body.checked_by !== undefined ? body.checked_by : material.checked_by,
    body.checked_at !== undefined ? body.checked_at : material.checked_at,
    id
  ).run()

  const updatedMaterial = await db.prepare('SELECT * FROM materials WHERE id = ?').bind(id).first()
  return c.json({ success: true, message: '材料更新成功', data: updatedMaterial })
})

// ─── 删除材料 ─────────────────────────────────────────────────────────────────
materials.delete('/:id', async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()
  const db = c.env.DB

  const material = await db.prepare('SELECT * FROM materials WHERE id = ?').bind(id).first()
  if (!material) return c.json({ success: false, message: '材料不存在' }, 404)

  if (isStudent(user) && String(material.student_id) !== String(user.studentId)) {
    return c.json({ success: false, message: '无权删除该材料' }, 403)
  }
  if (isTeacher(user)) {
    const student = await db.prepare('SELECT teacher_id, academic_advisor_id FROM students WHERE student_id = ?').bind(material.student_id).first()
    if (student?.teacher_id !== user.teacherId && student?.academic_advisor_id !== user.teacherId) return c.json({ success: false, message: '无权删除该材料' }, 403)
  }

  await db.prepare('DELETE FROM materials WHERE id = ?').bind(id).run()
  return c.json({ success: true, message: '材料删除成功' })
})

// ─── 更新材料完成状态（前端 updateStatus 调用）─────────────────────────────────
materials.put('/:id/status', async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()
  const db = c.env.DB

  const material = await db.prepare('SELECT * FROM materials WHERE id = ?').bind(id).first()
  if (!material) return c.json({ success: false, message: '材料不存在' }, 404)

  if (isStudent(user) && String(material.student_id) !== String(user.studentId)) {
    return c.json({ success: false, message: '无权操作该材料' }, 403)
  }
  if (isTeacher(user)) {
    const student = await db.prepare('SELECT teacher_id, academic_advisor_id FROM students WHERE student_id = ?').bind(material.student_id).first()
    if (student?.teacher_id !== user.teacherId && student?.academic_advisor_id !== user.teacherId) return c.json({ success: false, message: '无权操作该材料' }, 403)
  }

  const { completed, checked_by } = await c.req.json().catch(() => ({}))
  const newCompleted = completed ? 1 : 0

  await db.prepare(`
    UPDATE materials SET completed = ?, checked_by = ?, checked_at = ? WHERE id = ?
  `).bind(
    newCompleted,
    newCompleted ? (checked_by || null) : null,
    newCompleted ? new Date().toISOString().split('T')[0] : null,
    id
  ).run()

  const updatedMaterial = await db.prepare('SELECT * FROM materials WHERE id = ?').bind(id).first()
  return c.json({ success: true, message: '材料状态更新成功', data: updatedMaterial })
})

// ─── 切换材料完成状态 ─────────────────────────────────────────────────────────
materials.patch('/:id/toggle', async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()
  const db = c.env.DB

  const material = await db.prepare('SELECT * FROM materials WHERE id = ?').bind(id).first()
  if (!material) return c.json({ success: false, message: '材料不存在' }, 404)

  if (isStudent(user) && String(material.student_id) !== String(user.studentId)) {
    return c.json({ success: false, message: '无权操作该材料' }, 403)
  }
  if (isTeacher(user)) {
    const student = await db.prepare('SELECT teacher_id, academic_advisor_id FROM students WHERE student_id = ?').bind(material.student_id).first()
    if (student?.teacher_id !== user.teacherId && student?.academic_advisor_id !== user.teacherId) return c.json({ success: false, message: '无权操作该材料' }, 403)
  }

  const { checked_by } = await c.req.json().catch(() => ({}))
  const newCompleted = material.completed ? 0 : 1

  await db.prepare(`
    UPDATE materials SET completed = ?, checked_by = ?, checked_at = ? WHERE id = ?
  `).bind(
    newCompleted,
    newCompleted ? (checked_by || null) : null,
    newCompleted ? new Date().toISOString().split('T')[0] : null,
    id
  ).run()

  const updatedMaterial = await db.prepare('SELECT * FROM materials WHERE id = ?').bind(id).first()
  return c.json({ success: true, message: '材料状态更新成功', data: updatedMaterial })
})

export default materials

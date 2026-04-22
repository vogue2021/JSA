// 学校路由 - Cloudflare Workers 版本
import { Hono } from 'hono'

const schools = new Hono()

// ─── 统计接口 ────────────────────────────────────────────────────────────────

// GET /api/schools/stats - 全局学校报考统计（仪表盘）
schools.get('/stats', async (c) => {
  const { teacher_id } = c.req.query()
  const db = c.env.DB

  let sql = `
    SELECT s.name, s.type, s.program, s.status, COUNT(*) as count
    FROM schools s
    JOIN students st ON s.student_id = st.student_id
  `
  const params = []
  if (teacher_id) {
    sql += ' WHERE (st.teacher_id = ? OR st.academic_advisor_id = ?)'
    params.push(teacher_id, teacher_id)
  }
  sql += ' GROUP BY s.name, s.type, s.program, s.status'

  const { results: rows } = await db.prepare(sql).bind(...params).all()

  // 聚合：按学校名汇总各状态数量
  const schoolMap = {}
  rows.forEach(row => {
    const name = row.name
    if (!schoolMap[name]) {
      schoolMap[name] = { name, type: row.type || '', total: 0, not_started: 0, preparing: 0, applied: 0, submitted: 0, admitted: 0, rejected: 0 }
    }
    const status = row.status || 'preparing'
    const cnt = Number(row.count) || 0
    schoolMap[name].total += cnt
    if (schoolMap[name][status] !== undefined) schoolMap[name][status] += cnt
  })

  const sortedSchools = Object.values(schoolMap).sort((a, b) => b.total - a.total)
  const statusCounts = { not_started: 0, preparing: 0, applied: 0, submitted: 0, admitted: 0, rejected: 0 }
  const schoolTypeMap = {}
  sortedSchools.forEach(s => {
    Object.keys(statusCounts).forEach(k => { statusCounts[k] += s[k] || 0 })
    if (s.type) schoolTypeMap[s.type] = (schoolTypeMap[s.type] || 0) + s.total
  })

  return c.json({
    success: true,
    data: {
      sortedSchools,
      statusCounts,
      schoolTypeMap,
      totalApplications: sortedSchools.reduce((sum, s) => sum + s.total, 0)
    }
  })
})

// GET /api/schools/stats/events - 全局事件统计（仪表盘）
schools.get('/stats/events', async (c) => {
  const { teacher_id } = c.req.query()
  const db = c.env.DB
  const today = new Date().toISOString().split('T')[0]
  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  let sql = `
    SELECT e.*, st.name as student_name
    FROM events e
    JOIN students st ON e.student_id = st.student_id
    WHERE e.completed = 0
  `
  const params = []
  if (teacher_id) {
    sql += ' AND (st.teacher_id = ? OR st.academic_advisor_id = ?)'
    params.push(teacher_id, teacher_id)
  }

  const { results: allEvents } = await db.prepare(sql).bind(...params).all()

  const urgentEvents = allEvents.filter(e => e.urgent).length
  const upcomingEvents = allEvents.filter(e => e.date >= today && e.date <= sevenDaysLater).length

  return c.json({
    success: true,
    data: { totalEvents: allEvents.length, urgentEvents, upcomingEvents }
  })
})

// ─── 学生维度接口 ─────────────────────────────────────────────────────────────

// GET /api/schools/student/:studentId
schools.get('/student/:studentId', async (c) => {
  const { studentId } = c.req.param()
  const db = c.env.DB

  const { results: schoolList } = await db.prepare(
    'SELECT * FROM schools WHERE student_id = ? ORDER BY created_at DESC'
  ).bind(studentId).all()

  // 解析 materials JSON（兼容旧数据）
  schoolList.forEach(school => {
    if (school.materials) {
      try { school.materials = JSON.parse(school.materials) } catch { school.materials = [] }
    } else {
      school.materials = []
    }
  })

  return c.json({ success: true, data: schoolList })
})

// GET /api/schools/:id
schools.get('/:id', async (c) => {
  const { id } = c.req.param()
  const db = c.env.DB

  const school = await db.prepare('SELECT * FROM schools WHERE id = ?').bind(id).first()
  if (!school) return c.json({ success: false, message: '学校不存在' }, 404)

  if (school.materials) {
    try { school.materials = JSON.parse(school.materials) } catch { school.materials = [] }
  } else {
    school.materials = []
  }

  return c.json({ success: true, data: school })
})

// POST /api/schools - 添加学校
schools.post('/', async (c) => {
  const body = await c.req.json()
  const {
    student_id, name, name_ja, type, program, status,
    application_start_date, application_end_date,
    exam_date, result_date, requirements_url, requirements, teacher_notes,
    difficulty, ranking, location, website, xuexin_cert, overseas_cert,
    materials
  } = body

  if (!student_id || !name || !type) {
    return c.json({ success: false, message: '缺少必填字段（student_id、name、type）' }, 400)
  }

  const db = c.env.DB

  // 验证学生是否存在
  const studentExists = await db.prepare(
    'SELECT student_id FROM students WHERE student_id = ? LIMIT 1'
  ).bind(student_id).first()
  if (!studentExists) {
    return c.json({ success: false, message: '学生不存在' }, 404)
  }

  // 先插入学校获取 ID（需要先获取 ID 才能关联事件/材料）
  await db.prepare(`
    INSERT INTO schools (student_id, name, name_ja, type, program, status,
      application_start_date, application_end_date, exam_date, result_date,
      requirements_url, requirements, teacher_notes, difficulty, ranking, location, website,
      xuexin_cert, overseas_cert)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    student_id, name, name_ja || '', type, program || '', status || 'not_started',
    application_start_date || null, application_end_date || null,
    exam_date || null, result_date || null,
    requirements_url || '', requirements || '', teacher_notes || '',
    difficulty || '', ranking || 0, location || '', website || '',
    xuexin_cert || '不确定', overseas_cert || '不确定'
  ).run()

  const newSchool = await db.prepare(
    'SELECT * FROM schools WHERE student_id = ? ORDER BY id DESC LIMIT 1'
  ).bind(student_id).first()
  const schoolId = newSchool?.id

  // 使用 db.batch 原子写入所有关联的事件和材料
  const batchInserts = []
  const makeEvent = (title, date, category, urgent = false, notes = '') => ({
    student_id, school_id: schoolId, type: 'deadline',
    title, date, category, urgent: urgent ? 1 : 0, notes, completed: 0,
    days_left: Math.ceil((new Date(date) - new Date()) / 86400000)
  })

  const eventInserts = []
  if (application_start_date) eventInserts.push(makeEvent(`${name} 出愿开始`, application_start_date, '出愿', false, `${program} 出愿开始，请准备材料`))
  if (application_end_date) eventInserts.push(makeEvent(`${name} 出愿截止`, application_end_date, '出愿', true, `${program} 出愿截止，务必在此之前提交`))
  if (exam_date) eventInserts.push(makeEvent(`${name} 入学考试`, exam_date, '考试', false, `${program} 入学考试`))
  if (result_date) eventInserts.push(makeEvent(`${name} 合格发表`, result_date, '合格发表', false, `${program} 合格发表日`))

  eventInserts.forEach(e => {
    batchInserts.push(
      db.prepare(`INSERT INTO events (student_id, school_id, type, title, date, days_left, category, urgent, notes, completed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(e.student_id, e.school_id, e.type, e.title, e.date, e.days_left, e.category, e.urgent, e.notes, e.completed)
    )
  })

  if (materials && materials.length > 0) {
    materials.forEach(mat => {
      batchInserts.push(
        db.prepare(`INSERT INTO materials (student_id, school_id, item, type, deadline, url, completed)
          VALUES (?, ?, ?, ?, ?, ?, 0)`)
          .bind(
            student_id, schoolId, mat.name, 'school',
            mat.deadline || application_end_date, mat.url || null
          )
      )
    })
  }

  // 一次性原子写入所有关联记录
  if (batchInserts.length > 0) {
    await db.batch(batchInserts)
  }

  const school = await db.prepare('SELECT * FROM schools WHERE id = ?').bind(schoolId).first()

  return c.json({ success: true, message: '学校添加成功', data: school }, 201)
})

// PUT /api/schools/:id - 更新学校
schools.put('/:id', async (c) => {
  const { id } = c.req.param()
  const db = c.env.DB

  const school = await db.prepare('SELECT * FROM schools WHERE id = ?').bind(id).first()
  if (!school) return c.json({ success: false, message: '学校不存在' }, 404)

  const body = await c.req.json()
  const updated = {
    name: body.name || school.name,
    name_ja: body.name_ja !== undefined ? body.name_ja : (school.name_ja || ''),
    type: body.type || school.type,
    program: body.program !== undefined ? body.program : (school.program || ''),
    status: body.status || school.status,
    application_start_date: body.application_start_date !== undefined ? body.application_start_date : school.application_start_date,
    application_end_date: body.application_end_date !== undefined ? body.application_end_date : school.application_end_date,
    exam_date: body.exam_date !== undefined ? body.exam_date : school.exam_date,
    result_date: body.result_date !== undefined ? body.result_date : school.result_date,
    requirements_url: body.requirements_url !== undefined ? body.requirements_url : (school.requirements_url || ''),
    requirements: body.requirements !== undefined ? body.requirements : (school.requirements || ''),
    teacher_notes: body.teacher_notes !== undefined ? body.teacher_notes : (school.teacher_notes || ''),
    difficulty: body.difficulty !== undefined ? body.difficulty : (school.difficulty || ''),
    ranking: body.ranking !== undefined ? body.ranking : (school.ranking || 0),
    location: body.location !== undefined ? body.location : (school.location || ''),
    website: body.website !== undefined ? body.website : (school.website || ''),
    xuexin_cert: body.xuexin_cert !== undefined ? body.xuexin_cert : (school.xuexin_cert || '不确定'),
    overseas_cert: body.overseas_cert !== undefined ? body.overseas_cert : (school.overseas_cert || '不确定'),
  }

  // 使用 db.batch 原子性执行：更新学校主表 + 删除旧事件 + 重建新事件 + 处理材料
  const student_id = school.student_id
  const makeEvent = (title, date, category, urgent = false, notes = '') => ({
    student_id, school_id: id, type: 'deadline',
    title, date, category, urgent: urgent ? 1 : 0, notes, completed: 0,
    days_left: Math.ceil((new Date(date) - new Date()) / 86400000)
  })

  const eventInserts = []
  if (updated.application_start_date) eventInserts.push(makeEvent(`${updated.name} 出愿开始`, updated.application_start_date, '出愿', false, `${updated.program} 出愿开始，请准备材料`))
  if (updated.application_end_date) eventInserts.push(makeEvent(`${updated.name} 出愿截止`, updated.application_end_date, '出愿', true, `${updated.program} 出愿截止，务必在此之前提交`))
  if (updated.exam_date) eventInserts.push(makeEvent(`${updated.name} 入学考试`, updated.exam_date, '考试', false, `${updated.program} 入学考试`))
  if (updated.result_date) eventInserts.push(makeEvent(`${updated.name} 合格发表`, updated.result_date, '合格发表', false, `${updated.program} 合格发表日`))

  const batchStatements = [
    // 更新学校主表
    db.prepare(`
      UPDATE schools SET name=?, name_ja=?, type=?, program=?, status=?,
        application_start_date=?, application_end_date=?, exam_date=?, result_date=?,
        requirements_url=?, requirements=?, teacher_notes=?, difficulty=?, ranking=?, location=?,
        website=?, xuexin_cert=?, overseas_cert=?,
        updated_at=datetime('now')
      WHERE id=?
    `).bind(
      updated.name, updated.name_ja, updated.type, updated.program, updated.status,
      updated.application_start_date, updated.application_end_date,
      updated.exam_date, updated.result_date,
      updated.requirements_url, updated.requirements, updated.teacher_notes,
      updated.difficulty, updated.ranking, updated.location,
      updated.website, updated.xuexin_cert, updated.overseas_cert, id
    ),
    // 删除旧事件
    db.prepare('DELETE FROM events WHERE school_id = ?').bind(id),
  ]
  // 重建新事件
  eventInserts.forEach(e => {
    batchStatements.push(
      db.prepare(`INSERT INTO events (student_id, school_id, type, title, date, days_left, category, urgent, notes, completed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(e.student_id, e.school_id, e.type, e.title, e.date, e.days_left, e.category, e.urgent, e.notes, e.completed)
    )
  })

  // 处理材料：删除旧材料 + 新增材料（如果前端传了 materials 字段）
  const bodyMaterials = body.materials
  if (Array.isArray(bodyMaterials)) {
    // 先删除该学校关联的所有材料
    batchStatements.push(
      db.prepare('DELETE FROM materials WHERE school_id = ?').bind(id)
    )
    // 再插入新材料
    bodyMaterials.forEach(mat => {
      batchStatements.push(
        db.prepare(`INSERT INTO materials (student_id, school_id, item, type, deadline, url, completed)
          VALUES (?, ?, ?, ?, ?, ?, 0)`)
          .bind(
            student_id, id, mat.name || mat.item, 'school',
            mat.deadline || updated.application_end_date, mat.url || null
          )
      )
    })
  }

  await db.batch(batchStatements)

  const updatedSchool = await db.prepare('SELECT * FROM schools WHERE id = ?').bind(id).first()

  return c.json({ success: true, message: '学校信息更新成功', data: updatedSchool })
})

// DELETE /api/schools/:id
schools.delete('/:id', async (c) => {
  const { id } = c.req.param()
  const db = c.env.DB

  const school = await db.prepare('SELECT id FROM schools WHERE id = ?').bind(id).first()
  if (!school) return c.json({ success: false, message: '学校不存在' }, 404)

  // 级联删除：学校 + 关联事件 + 关联材料，原子执行
  await db.batch([
    db.prepare('DELETE FROM events WHERE school_id = ?').bind(id),
    db.prepare('DELETE FROM materials WHERE school_id = ?').bind(id),
    db.prepare('DELETE FROM schools WHERE id = ?').bind(id),
  ])
  return c.json({ success: true, message: '学校及关联数据已删除' })
})

export default schools

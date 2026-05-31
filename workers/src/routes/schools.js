// 学校路由 - Cloudflare Workers 版本
import { Hono } from 'hono'

const schools = new Hono()

// 【新需求69 + 70】角色与归属判断 helpers
const isAdmin = (user) => user?.role === 'admin'
const isTeacher = (user) => user?.role === 'teacher'
const isStudent = (user) => user?.role === 'student'

// 【新需求70】老师是否拥有指定权限（从 authMiddleware 注入的 user.permissions 同步读取）
const teacherHas = (user, permId) => {
  if (!user) return false
  if (user.role === 'admin') return true
  if (user.role !== 'teacher') return false
  return Array.isArray(user.permissions) && user.permissions.includes(permId)
}

// 【新需求70】老师是否可以"看到"指定学生的学校：负责该学生 OR 拥有 view_all_students
async function teacherCanViewStudent(db, user, studentId) {
  if (!isTeacher(user)) return true
  if (!user.teacherId || !studentId) return false
  const stu = await db.prepare(
    'SELECT teacher_id, academic_advisor_id, consultant_id FROM students WHERE student_id = ?'
  ).bind(studentId).first()
  if (!stu) return false
  if (stu.teacher_id === user.teacherId
      || stu.academic_advisor_id === user.teacherId
      || stu.consultant_id === user.teacherId) return true
  return teacherHas(user, 'view_all_students')
}

// 【新需求70】老师是否可以"编辑"指定学生的学校：负责该学生 OR 拥有 edit_all_students
async function teacherCanEditStudent(db, user, studentId) {
  if (!isTeacher(user)) return true
  if (!user.teacherId || !studentId) return false
  const stu = await db.prepare(
    'SELECT teacher_id, academic_advisor_id, consultant_id FROM students WHERE student_id = ?'
  ).bind(studentId).first()
  if (!stu) return false
  if (stu.teacher_id === user.teacherId
      || stu.academic_advisor_id === user.teacherId
      || stu.consultant_id === user.teacherId) return true
  return teacherHas(user, 'edit_all_students')
}

// 【新需求69】老师“页面内编辑权限”后端兜底校验（与 events.js / materials.js 风格一致）。
//   读取 teachers 表的 permissions JSON 检查是否包含指定 permId。
//   admin 全权；非 teacher 不走此校验（返回 true，由路由自身限定访问范围）。
async function teacherHasEditPerm(db, user, permId) {
  if (!user || user.role !== 'teacher') return true
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

// ─── 自动迁移工具 ────────────────────────────────────────────────────────────
// 【新需求48】自动确保 schools 表有 extra_dates 列
// 背景：需求45 引入 extra_dates 列用于存储一审/二审/自定义日期，
// 需要手动执行 migration-needs45.sql 才会生效；
// 为避免用户忘记执行导致保存失败，这里在 POST/PUT 入口自动检测并补列。
// D1 / SQLite 使用 PRAGMA table_info 判断列是否存在。
// 使用 Symbol/全局缓存避免每次请求都查询 PRAGMA：同一个 worker 实例只检查一次。
let _extraDatesEnsured = false
async function ensureExtraDatesColumn(db) {
  if (_extraDatesEnsured) return
  try {
    const { results } = await db.prepare(`PRAGMA table_info(schools)`).all()
    const hasColumn = Array.isArray(results) && results.some(r => r && r.name === 'extra_dates')
    if (!hasColumn) {
      console.log('[schools] 自动迁移：schools 表缺少 extra_dates 列，正在 ALTER TABLE 添加...')
      await db.prepare(`ALTER TABLE schools ADD COLUMN extra_dates TEXT NOT NULL DEFAULT '{}'`).run()
      console.log('[schools] 自动迁移完成：extra_dates 列已添加')
    }
    _extraDatesEnsured = true
  } catch (err) {
    // ALTER 可能因并发重复执行抛 "duplicate column" 错误，视为成功
    const msg = String(err && err.message || '')
    if (/duplicate column name|already exists/i.test(msg)) {
      _extraDatesEnsured = true
      return
    }
    // 其它错误：打日志但不阻塞请求，后续的降级 SQL 会兜底
    console.warn('[schools] ensureExtraDatesColumn 失败，将依赖降级逻辑：', msg)
  }
}

// ─── 统计接口 ────────────────────────────────────────────────────────────────

// GET /api/schools/_debug/schema - 【新需求49】数据库 schema 诊断端点
// 返回 schools 表的所有列名，方便前端/用户确认 extra_dates 列是否存在
// 使用场景：用户反馈一审/二审日期保存失败时，访问此端点即可定位是后端列缺失还是前端字段名错误
schools.get('/_debug/schema', async (c) => {
  const db = c.env.DB
  try {
    // 主动触发一次自动迁移（即使 _extraDatesEnsured=true，也再做一次保障）
    await ensureExtraDatesColumn(db)
    const { results } = await db.prepare(`PRAGMA table_info(schools)`).all()
    const columns = Array.isArray(results) ? results.map(r => r.name) : []
    return c.json({
      success: true,
      data: {
        table: 'schools',
        columns,
        hasExtraDates: columns.includes('extra_dates'),
        ensuredInThisInstance: _extraDatesEnsured,
      }
    })
  } catch (err) {
    return c.json({ success: false, message: String(err && err.message || err) }, 500)
  }
})

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
    // 【新需求68】加入顾问老师维度
    sql += ' WHERE (st.teacher_id = ? OR st.academic_advisor_id = ? OR st.consultant_id = ?)'
    params.push(teacher_id, teacher_id, teacher_id)
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
    // 【新需求68】加入顾问老师维度
    sql += ' AND (st.teacher_id = ? OR st.academic_advisor_id = ? OR st.consultant_id = ?)'
    params.push(teacher_id, teacher_id, teacher_id)
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
  const user = c.get('user')
  const { studentId } = c.req.param()
  const db = c.env.DB

  // 【新需求70】老师只能查看自己负责学生的学校。拥有 view_all_students 可查任意学生。
  if (isStudent(user) && String(user.studentId) !== String(studentId)) {
    return c.json({ success: false, message: '无权查看该学生的学校' }, 403)
  }
  if (isTeacher(user) && !(await teacherCanViewStudent(db, user, studentId))) {
    return c.json({ success: false, code: 'PERMISSION_DENIED', message: '无权查看该学生的学校（需 view_all_students 权限）' }, 403)
  }

  // 【新需求49】用户打开学校页面就会触发该 GET，此时立即自动迁移，
  // 避免要等到下一次 POST/PUT 才补列（之前只在写路由触发，首次查询仍读不到列）
  await ensureExtraDatesColumn(db)

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
    // 【新需求45】解析 extra_dates JSON（一审/二审/自定义日期）
    if (school.extra_dates) {
      try { school.extra_dates = JSON.parse(school.extra_dates) } catch { school.extra_dates = {} }
    } else {
      school.extra_dates = {}
    }
  })

  return c.json({ success: true, data: schoolList })
})

// GET /api/schools/:id
schools.get('/:id', async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()
  const db = c.env.DB

  const school = await db.prepare('SELECT * FROM schools WHERE id = ?').bind(id).first()
  if (!school) return c.json({ success: false, message: '学校不存在' }, 404)

  // 【新需求70】学生/老师需验证归属
  if (isStudent(user) && String(user.studentId) !== String(school.student_id)) {
    return c.json({ success: false, message: '无权查看该学校' }, 403)
  }
  if (isTeacher(user) && !(await teacherCanViewStudent(db, user, school.student_id))) {
    return c.json({ success: false, code: 'PERMISSION_DENIED', message: '无权查看该学校（需 view_all_students 权限）' }, 403)
  }

  if (school.materials) {
    try { school.materials = JSON.parse(school.materials) } catch { school.materials = [] }
  } else {
    school.materials = []
  }
  // 【新需求45】解析 extra_dates JSON
  if (school.extra_dates) {
    try { school.extra_dates = JSON.parse(school.extra_dates) } catch { school.extra_dates = {} }
  } else {
    school.extra_dates = {}
  }

  return c.json({ success: true, data: school })
})

// POST /api/schools - 添加学校
schools.post('/', async (c) => {
  // 【新需求69】后端兜底：老师需有 edit_schools 权限
  const user = c.get('user')
  const db = c.env.DB
  if (user && user.role === 'teacher' && !(await teacherHasEditPerm(db, user, 'edit_schools'))) {
    return c.json({ success: false, code: 'PERMISSION_DENIED', message: '您没有学校的编辑权限，请联系管理员开通' }, 403)
  }

  const body = await c.req.json()
  const {
    student_id, name, name_ja, type, program, status,
    application_start_date, application_end_date,
    exam_date, result_date, requirements_url, requirements, teacher_notes,
    difficulty, ranking, location, website, xuexin_cert, overseas_cert,
    materials, extra_dates
  } = body

  if (!student_id || !name || !type) {
    return c.json({ success: false, message: '缺少必填字段（student_id、name、type）' }, 400)
  }

  // 【新需求70】老师只能为自己负责的学生创建学校（拥有 edit_all_students 除外）
  if (isTeacher(user) && !(await teacherCanEditStudent(db, user, student_id))) {
    return c.json({ success: false, code: 'PERMISSION_DENIED', message: '您只能为自己负责的学生添加学校，要跨学生操作请联系管理员开通“编辑所有学生”权限' }, 403)
  }
  // 学生不能为自己/别人创建学校（原本也没限制，顺手补上）
  if (isStudent(user)) {
    return c.json({ success: false, message: '学生无权创建学校' }, 403)
  }

  // 【新需求48】自动迁移：确保 schools 表有 extra_dates 列
  await ensureExtraDatesColumn(db)

  // 验证学生是否存在
  const studentExists = await db.prepare(
    'SELECT student_id FROM students WHERE student_id = ? LIMIT 1'
  ).bind(student_id).first()
  if (!studentExists) {
    return c.json({ success: false, message: '学生不存在' }, 404)
  }

  // 【新需求45】extra_dates 序列化（兼容字符串/对象两种输入）
  let extraDatesJson = '{}'
  if (extra_dates !== undefined && extra_dates !== null) {
    if (typeof extra_dates === 'string') {
      try { JSON.parse(extra_dates); extraDatesJson = extra_dates } catch { extraDatesJson = '{}' }
    } else if (typeof extra_dates === 'object') {
      try { extraDatesJson = JSON.stringify(extra_dates) } catch { extraDatesJson = '{}' }
    }
  }

  // 先插入学校获取 ID（需要先获取 ID 才能关联事件/材料）
  // 【新需求47】防御性 try/catch：若 extra_dates 列尚未迁移，则回退到不含该列的 INSERT
  try {
    await db.prepare(`
      INSERT INTO schools (student_id, name, name_ja, type, program, status,
        application_start_date, application_end_date, exam_date, result_date,
        requirements_url, requirements, teacher_notes, difficulty, ranking, location, website,
        xuexin_cert, overseas_cert, extra_dates)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      student_id, name, name_ja || '', type, program || '', status || 'not_started',
      application_start_date || null, application_end_date || null,
      exam_date || null, result_date || null,
      requirements_url || '', requirements || '', teacher_notes || '',
      difficulty || '', ranking || 0, location || '', website || '',
      xuexin_cert || '不确定', overseas_cert || '不确定',
      extraDatesJson
    ).run()
  } catch (err) {
    const msg = String(err && err.message || '')
    if (/no column named extra_dates|has no column named extra_dates/i.test(msg)) {
      // 列不存在：回退到旧表结构 INSERT（迁移脚本未执行场景）
      console.warn('[schools POST] extra_dates 列不存在，回退到旧表结构 INSERT。请执行 migration-needs45.sql')
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
    } else {
      throw err
    }
  }

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

  // 【新需求90】出愿截止类型从 extra_dates 取出，拼接到事件 title/notes（全链路贯通场景）
  let deadlineTypeForTitle = ''
  try {
    const extraObjForDl = typeof extraDatesJson === 'string' ? JSON.parse(extraDatesJson || '{}') : (extraDatesJson || {})
    if (extraObjForDl && typeof extraObjForDl.deadlineType === 'string' && extraObjForDl.deadlineType.trim()) {
      deadlineTypeForTitle = extraObjForDl.deadlineType.trim()
    }
  } catch (e) { /* ignore */ }
  const dlSuffix = deadlineTypeForTitle ? `（${deadlineTypeForTitle}）` : ''

  const eventInserts = []
  if (application_start_date) eventInserts.push(makeEvent(`${name} 出愿开始`, application_start_date, '出愿', false, `${program} 出愿开始，请准备材料`))
  if (application_end_date) eventInserts.push(makeEvent(`${name} 出愿截止${dlSuffix}`, application_end_date, '出愿', true, `${program} 出愿截止${dlSuffix}，务必在此之前提交`))
  if (exam_date) eventInserts.push(makeEvent(`${name} 入学考试`, exam_date, '考试', false, `${program} 入学考试`))
  if (result_date) eventInserts.push(makeEvent(`${name} 合格发表`, result_date, '合格发表', false, `${program} 合格发表日`))

  // 【新需求46】为 extra_dates 中的一审/二审考试/发表 & 自定义日期生成时间线事件
  try {
    const extraObj = typeof extraDatesJson === 'string' ? JSON.parse(extraDatesJson || '{}') : (extraDatesJson || {})
    if (extraObj.firstExamDate) eventInserts.push(makeEvent(`${name} 一审考试`, extraObj.firstExamDate, '考试', false, `${program} 一审考试`))
    if (extraObj.firstResultDate) eventInserts.push(makeEvent(`${name} 一审发表`, extraObj.firstResultDate, '合格发表', false, `${program} 一审合格发表`))
    if (extraObj.secondExamDate) eventInserts.push(makeEvent(`${name} 二审考试`, extraObj.secondExamDate, '考试', false, `${program} 二审考试`))
    if (extraObj.secondResultDate) eventInserts.push(makeEvent(`${name} 二审发表`, extraObj.secondResultDate, '合格发表', false, `${program} 二审合格发表`))
    if (Array.isArray(extraObj.customDates)) {
      extraObj.customDates.forEach(cd => {
        if (cd && cd.label && cd.date) {
          eventInserts.push(makeEvent(`${name} ${cd.label}`, cd.date, '自定义', false, `${program} ${cd.label}`))
        }
      })
    }
  } catch (e) { /* extra_dates 解析失败时忽略事件生成 */ }

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
  // 【新需求69】后端兜底：老师需有 edit_schools 权限
  const user = c.get('user')
  const id = c.req.param('id')
  const db = c.env.DB
  if (user && user.role === 'teacher' && !(await teacherHasEditPerm(db, user, 'edit_schools'))) {
    return c.json({ success: false, code: 'PERMISSION_DENIED', message: '您没有学校的编辑权限，请联系管理员开通' }, 403)
  }

  // 【新需求48】自动迁移：确保 schools 表有 extra_dates 列
  await ensureExtraDatesColumn(db)

  const school = await db.prepare('SELECT * FROM schools WHERE id = ?').bind(id).first()
  if (!school) return c.json({ success: false, message: '学校不存在' }, 404)
  // 【新需求70】老师只能修改自己负责学生的学校（拥有 edit_all_students 除外）
  if (isTeacher(user) && !(await teacherCanEditStudent(db, user, school.student_id))) {
    return c.json({ success: false, code: 'PERMISSION_DENIED', message: '无权修改该学校（需 edit_all_students 权限才能修改他人学生的学校）' }, 403)
  }
  if (isStudent(user)) {
    return c.json({ success: false, message: '学生无权修改学校' }, 403)
  }

  const body = await c.req.json()
  // 【新需求45】处理 extra_dates（JSON 字段）
  let extraDatesJson = (school.extra_dates || '{}')
  if (body.extra_dates !== undefined && body.extra_dates !== null) {
    if (typeof body.extra_dates === 'string') {
      try { JSON.parse(body.extra_dates); extraDatesJson = body.extra_dates } catch { /* 保持原值 */ }
    } else if (typeof body.extra_dates === 'object') {
      try { extraDatesJson = JSON.stringify(body.extra_dates) } catch { /* 保持原值 */ }
    }
  }
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
    extra_dates: extraDatesJson,
  }

  // 使用 db.batch 原子性执行：更新学校主表 + 删除旧事件 + 重建新事件 + 处理材料
  const student_id = school.student_id
  const makeEvent = (title, date, category, urgent = false, notes = '') => ({
    student_id, school_id: id, type: 'deadline',
    title, date, category, urgent: urgent ? 1 : 0, notes, completed: 0,
    days_left: Math.ceil((new Date(date) - new Date()) / 86400000)
  })

  // 【新需求90】同步处理 PUT 路径下的出愿截止类型拼接
  let deadlineTypeForTitleU = ''
  try {
    const extraObjU = typeof updated.extra_dates === 'string' ? JSON.parse(updated.extra_dates || '{}') : (updated.extra_dates || {})
    if (extraObjU && typeof extraObjU.deadlineType === 'string' && extraObjU.deadlineType.trim()) {
      deadlineTypeForTitleU = extraObjU.deadlineType.trim()
    }
  } catch (e) { /* ignore */ }
  const dlSuffixU = deadlineTypeForTitleU ? `（${deadlineTypeForTitleU}）` : ''

  const eventInserts = []
  if (updated.application_start_date) eventInserts.push(makeEvent(`${updated.name} 出愿开始`, updated.application_start_date, '出愿', false, `${updated.program} 出愿开始，请准备材料`))
  if (updated.application_end_date) eventInserts.push(makeEvent(`${updated.name} 出愿截止${dlSuffixU}`, updated.application_end_date, '出愿', true, `${updated.program} 出愿截止${dlSuffixU}，务必在此之前提交`))
  if (updated.exam_date) eventInserts.push(makeEvent(`${updated.name} 入学考试`, updated.exam_date, '考试', false, `${updated.program} 入学考试`))
  if (updated.result_date) eventInserts.push(makeEvent(`${updated.name} 合格发表`, updated.result_date, '合格发表', false, `${updated.program} 合格发表日`))

  // 【新需求46】extra_dates 中的一审/二审/自定义日期也重建为事件
  try {
    const extraObj = typeof updated.extra_dates === 'string' ? JSON.parse(updated.extra_dates || '{}') : (updated.extra_dates || {})
    if (extraObj.firstExamDate) eventInserts.push(makeEvent(`${updated.name} 一审考试`, extraObj.firstExamDate, '考试', false, `${updated.program} 一审考试`))
    if (extraObj.firstResultDate) eventInserts.push(makeEvent(`${updated.name} 一审发表`, extraObj.firstResultDate, '合格发表', false, `${updated.program} 一审合格发表`))
    if (extraObj.secondExamDate) eventInserts.push(makeEvent(`${updated.name} 二审考试`, extraObj.secondExamDate, '考试', false, `${updated.program} 二审考试`))
    if (extraObj.secondResultDate) eventInserts.push(makeEvent(`${updated.name} 二审发表`, extraObj.secondResultDate, '合格发表', false, `${updated.program} 二审合格发表`))
    if (Array.isArray(extraObj.customDates)) {
      extraObj.customDates.forEach(cd => {
        if (cd && cd.label && cd.date) {
          eventInserts.push(makeEvent(`${updated.name} ${cd.label}`, cd.date, '自定义', false, `${updated.program} ${cd.label}`))
        }
      })
    }
  } catch (e) { /* extra_dates 解析失败时忽略事件生成 */ }

  // 【新需求47】先独立执行主表 UPDATE，并在 extra_dates 列不存在时降级
  // 原因：db.batch 原子失败会导致事件/材料也回滚，影响用户。拆分后仅主表更新列差异不影响其它操作。
  try {
    await db.prepare(`
      UPDATE schools SET name=?, name_ja=?, type=?, program=?, status=?,
        application_start_date=?, application_end_date=?, exam_date=?, result_date=?,
        requirements_url=?, requirements=?, teacher_notes=?, difficulty=?, ranking=?, location=?,
        website=?, xuexin_cert=?, overseas_cert=?, extra_dates=?,
        updated_at=datetime('now')
      WHERE id=?
    `).bind(
      updated.name, updated.name_ja, updated.type, updated.program, updated.status,
      updated.application_start_date, updated.application_end_date,
      updated.exam_date, updated.result_date,
      updated.requirements_url, updated.requirements, updated.teacher_notes,
      updated.difficulty, updated.ranking, updated.location,
      updated.website, updated.xuexin_cert, updated.overseas_cert, updated.extra_dates, id
    ).run()
  } catch (err) {
    const msg = String(err && err.message || '')
    if (/no column named extra_dates|has no column named extra_dates/i.test(msg)) {
      console.warn('[schools PUT] extra_dates 列不存在，回退到旧表结构 UPDATE。请执行 migration-needs45.sql')
      await db.prepare(`
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
      ).run()
    } else {
      throw err
    }
  }

  const batchStatements = [
    // 删除旧事件（主表 UPDATE 已独立完成）
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
  // 【新需求69】后端兜底：老师需有 edit_schools 权限
  const user = c.get('user')
  const { id } = c.req.param()
  const db = c.env.DB
  if (user && user.role === 'teacher' && !(await teacherHasEditPerm(db, user, 'edit_schools'))) {
    return c.json({ success: false, code: 'PERMISSION_DENIED', message: '您没有学校的编辑权限，请联系管理员开通' }, 403)
  }

  const school = await db.prepare('SELECT id, student_id FROM schools WHERE id = ?').bind(id).first()
  if (!school) return c.json({ success: false, message: '学校不存在' }, 404)
  // 【新需求70】老师只能删除自己负责学生的学校（拥有 edit_all_students 除外）
  if (isTeacher(user) && !(await teacherCanEditStudent(db, user, school.student_id))) {
    return c.json({ success: false, code: 'PERMISSION_DENIED', message: '无权删除该学校（需 edit_all_students 权限才能删除他人学生的学校）' }, 403)
  }
  if (isStudent(user)) {
    return c.json({ success: false, message: '学生无权删除学校' }, 403)
  }

  // 级联删除：学校 + 关联事件 + 关联材料，原子执行
  await db.batch([
    db.prepare('DELETE FROM events WHERE school_id = ?').bind(id),
    db.prepare('DELETE FROM materials WHERE school_id = ?').bind(id),
    db.prepare('DELETE FROM schools WHERE id = ?').bind(id),
  ])
  return c.json({ success: true, message: '学校及关联数据已删除' })
})

export default schools

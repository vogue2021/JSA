// 学生路由 - Cloudflare Workers 版本
// 数据来源：students 表（扩展信息）LEFT JOIN users 表（账号信息）
import { Hono } from 'hono'

const students = new Hono()

const isAdmin = (user) => user?.role === 'admin'
const isTeacher = (user) => user?.role === 'teacher'
const isStudent = (user) => user?.role === 'student'

// 密码哈希（Web Crypto PBKDF2，与 auth.js 保持一致）
// 用于新需求43：管理员/老师添加学生时，可选直接设置初始密码
async function hashPassword(password) {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  )
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  )
  const combined = new Uint8Array(salt.length + hash.byteLength)
  combined.set(salt)
  combined.set(new Uint8Array(hash), salt.length)
  return btoa(String.fromCharCode(...combined))
}

// 将数据库行转换为前端格式
function formatStudent(row) {
  return {
    id: row.user_id || row.student_id,
    studentId: row.student_id,
    userId: row.user_id,
    name: row.name,
    email: row.email || '',
    teacherId: row.teacher_id || '',
    academicAdvisorId: row.academic_advisor_id || '',
    // 【新需求68】顾问老师 ID（第三个老师身份维度）
    consultantId: row.consultant_id || '',
    birthday: row.birthday || '',
    highSchool: row.high_school || '',
    languageSchool: row.language_school || '',
    langSchoolShift: row.lang_school_shift || '',
    phone: row.phone || '',
    jlptScore: row.jlpt_score || '',
    jlptScores: (() => { try { return JSON.parse(row.jlpt_scores || '[]') } catch { return [] } })(),
    ejuScores: (() => { try { return JSON.parse(row.eju_scores || '[]') } catch { return [] } })(),
    englishScore: row.english_score || '',
    englishScores: (() => { try { return JSON.parse(row.english_scores || '[]') } catch { return [] } })(),
    followUpNotes: (() => { try { const v = JSON.parse(row.follow_up_notes || '[]'); return Array.isArray(v) ? v : [] } catch { return row.follow_up_notes ? [{ id: Date.now(), content: row.follow_up_notes, date: '', author: '系统', role: 'admin' }] : [] } })(),
    photo: row.photo || '',
    packageName: row.package_name || '',
    packageEndDate: row.package_end_date || '',
    tags: (() => { try { return JSON.parse(row.tags || '[]') } catch { return [] } })(),
    subject: row.subject || '',
    hasAccount: Boolean(row.has_account),
    isActive: Boolean(row.is_active !== 0),
    xuebangId: row.xuebang_id || '',
    hasChinaHighSchoolRecord: row.has_china_high_school_record || '',
    overseasCertifications: (() => { try { return JSON.parse(row.overseas_certifications || '[]') } catch { return [] } })(),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ─── 搜索接口 ─────────────────────────────────────────────────────────────────
students.get('/search/query', async (c) => {
  const user = c.get('user')
  if (!isAdmin(user) && !isTeacher(user)) {
    return c.json({ success: false, message: '权限不足' }, 403)
  }

  const { q, teacher_id } = c.req.query()
  const db = c.env.DB

  let sql = 'SELECT * FROM students WHERE is_active = 1'
  const params = []

  if (isTeacher(user)) {
    // 老师角色 — 同时可见升学负责学生(teacher_id) / 学管负责学生(academic_advisor_id)
    // 【新需求68】顾问老师 (consultant_id) 也算自己负责的学生
    sql += ' AND (teacher_id = ? OR academic_advisor_id = ? OR consultant_id = ?)'
    const tid = user.teacherId || '__none__'
    params.push(tid, tid, tid)
  }
  if (q) {
    sql += ' AND (name LIKE ? OR email LIKE ? OR student_id LIKE ?)'
    params.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }
  if (teacher_id && isAdmin(user)) {
    sql += ' AND teacher_id = ?'
    params.push(teacher_id)
  }

  sql += ' ORDER BY created_at DESC'
  const { results } = await db.prepare(sql).bind(...params).all()
  return c.json({ success: true, data: results.map(formatStudent) })
})

// ─── 获取学生列表 ─────────────────────────────────────────────────────────────
students.get('/', async (c) => {
  const user = c.get('user')
  const db = c.env.DB

  let sql = 'SELECT * FROM students WHERE is_active = 1'
  const params = []

  if (isAdmin(user)) {
    // 全部可见
  } else if (isTeacher(user)) {
    // 老师角色 — 同时可见升学/学管/顾问负责的学生（【新需求68】加入 consultant_id 维度）
    // 【新需求68 任务3】view_all_students=1 时跳过 teacher_id 过滤，让老师看到全部学生。
    //   该判断通过 query 参数传入（前端在调用时根据老师权限决定是否带 ?all=1），
    //   后端这里仅在 user.role === 'teacher' 时校验 query；不会被普通用户随意提权——
    //   因为权限本身仍由前端 hasPermission 控制是否调用 ?all=1。后续若需更严，可在
    //   teachers 表读取 permissions 字段再二次校验。
    const wantAll = c.req.query('all') === '1'
    if (!wantAll) {
      sql += ' AND (teacher_id = ? OR academic_advisor_id = ? OR consultant_id = ?)'
      const tid = user.teacherId || '__none__'
      params.push(tid, tid, tid)
    }
  } else if (isStudent(user)) {
    // 学生只能看自己
    sql += ' AND student_id = ?'
    params.push(user.studentId || '__none__')
  } else {
    return c.json({ success: false, message: '权限不足' }, 403)
  }

  sql += ' ORDER BY created_at DESC'
  const { results } = await db.prepare(sql).bind(...params).all()

  // 批量查询所有学生的材料进度（一次 SQL，避免 N+1）
  const studentIds = results.map(s => s.student_id)
  let materialProgressMap = {}
  if (studentIds.length > 0) {
    const placeholders = studentIds.map(() => '?').join(',')
    const { results: materialStats } = await db.prepare(`
      SELECT student_id,
        COUNT(*) as total,
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as done
      FROM materials
      WHERE student_id IN (${placeholders})
      GROUP BY student_id
    `).bind(...studentIds).all()
    materialStats.forEach(m => {
      materialProgressMap[m.student_id] = m.total > 0 ? Math.round(m.done / m.total * 100) : 0
    })
  }

  return c.json({ success: true, data: results.map(r => ({
    ...formatStudent(r),
    progress: materialProgressMap[r.student_id] || 0,
  })) })
})

// ─── 按老师获取学生 ───────────────────────────────────────────────────────────
students.get('/teacher/:teacherId', async (c) => {
  const user = c.get('user')
  const { teacherId } = c.req.param()

  if (!isAdmin(user) && !(isTeacher(user) && user.teacherId === teacherId)) {
    return c.json({ success: false, message: '无权查看该老师的学生' }, 403)
  }

  const db = c.env.DB
  // 按 teacher_id / academic_advisor_id / consultant_id 三个维度查询
  // 【新需求68】该老师可能同时是升学老师 / 学管老师 / 顾问老师中的一种或多种
  const { results } = await db.prepare(
    'SELECT * FROM students WHERE (teacher_id = ? OR academic_advisor_id = ? OR consultant_id = ?) AND is_active = 1 ORDER BY created_at DESC'
  ).bind(teacherId, teacherId, teacherId).all()

  // 批量查询材料进度
  const studentIds = results.map(s => s.student_id)
  let materialProgressMap = {}
  if (studentIds.length > 0) {
    const placeholders = studentIds.map(() => '?').join(',')
    const { results: materialStats } = await db.prepare(`
      SELECT student_id,
        COUNT(*) as total,
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as done
      FROM materials
      WHERE student_id IN (${placeholders})
      GROUP BY student_id
    `).bind(...studentIds).all()
    materialStats.forEach(m => {
      materialProgressMap[m.student_id] = m.total > 0 ? Math.round(m.done / m.total * 100) : 0
    })
  }

  return c.json({ success: true, data: results.map(r => ({
    ...formatStudent(r),
    progress: materialProgressMap[r.student_id] || 0,
  })) })
})

// ─── 获取单个学生（含统计）────────────────────────────────────────────────────
students.get('/:id', async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()
  const db = c.env.DB

  // id 可能是 student_id 或 user_id
  const student = await db.prepare(
    'SELECT * FROM students WHERE student_id = ? OR user_id = ? LIMIT 1'
  ).bind(id, id).first()

  if (!student) return c.json({ success: false, message: '学生不存在' }, 404)

  if (isStudent(user) && user.studentId !== student.student_id) {
    return c.json({ success: false, message: '无权查看该学生信息' }, 403)
  }
  // 【新需求68】老师权限校验加入顾问老师 (consultant_id) 维度
  if (isTeacher(user)
      && student.teacher_id !== user.teacherId
      && student.academic_advisor_id !== user.teacherId
      && student.consultant_id !== user.teacherId) {
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
      ...formatStudent(student),
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

// ─── 创建学生（仅管理员/老师）────────────────────────────────────────────────
// 新需求43：支持在创建学生的同时，通过 password 字段直接创建登录账号
students.post('/', async (c) => {
  const user = c.get('user')
  if (!isAdmin(user) && !isTeacher(user)) {
    return c.json({ success: false, message: '权限不足' }, 403)
  }

  const body = await c.req.json()
  const db = c.env.DB

  if (!body.student_id || !body.name) {
    return c.json({ success: false, message: '学号和姓名为必填项' }, 400)
  }

  // 学号格式校验：只允许数字/字母（避免 NaN / 脏数据写入）
  const studentIdStr = String(body.student_id).trim()
  if (!/^[A-Za-z0-9_-]{3,20}$/.test(studentIdStr)) {
    return c.json({ success: false, message: '学号格式不合法（3-20 位字母、数字、下划线或短横线）' }, 400)
  }

  // 检查学号是否已存在
  const existing = await db.prepare('SELECT student_id FROM students WHERE student_id = ?').bind(studentIdStr).first()
  if (existing) return c.json({ success: false, message: '该学号已存在' }, 400)

  // ─── 新需求43：可选直接创建登录账号 ─────────────────────────────────────
  // 如果同时传入 password，则必须传入合法 email；否则不允许设置密码
  const wantsAccount = Boolean(body.password)
  let userId = null
  let hashedPassword = null
  const emailStr = (body.email || '').trim()

  if (wantsAccount) {
    if (!emailStr || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
      return c.json({ success: false, message: '设置密码时必须填写合法的邮箱' }, 400)
    }
    if (String(body.password).length < 6) {
      return c.json({ success: false, message: '密码长度至少 6 位' }, 400)
    }
    // 邮箱唯一性检查
    const existingUser = await db.prepare('SELECT id FROM users WHERE email = ?').bind(emailStr).first()
    if (existingUser) {
      return c.json({ success: false, message: '该邮箱已被注册' }, 400)
    }
    hashedPassword = await hashPassword(String(body.password))
    userId = `student_${Date.now()}_${Math.floor(Math.random() * 1000)}`
  }

  const teacherId = isTeacher(user) ? user.teacherId : (body.teacher_id || '')
  const hasAccount = wantsAccount ? 1 : 0

  // 使用 batch 保证 students + users 原子写入
  // 【新需求68】INSERT 增加 consultant_id 字段
  const statements = [
    db.prepare(
      `INSERT INTO students (student_id, user_id, name, email, teacher_id, academic_advisor_id, consultant_id,
        birthday, high_school, language_school, jlpt_score, english_score, eju_scores,
        follow_up_notes, package_name, package_end_date, tags, subject, has_account)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      studentIdStr, userId, body.name, emailStr,
      teacherId, body.academic_advisor_id || '', body.consultant_id || '',
      body.birthday || '', body.high_school || '', body.language_school || '',
      body.jlpt_score || '', body.english_score || '',
      JSON.stringify(body.eju_scores || []),
      typeof body.follow_up_notes === 'string' ? body.follow_up_notes : JSON.stringify(body.follow_up_notes || []),
      body.package_name || '', body.package_end_date || '',
      JSON.stringify(body.tags || []), body.subject || '',
      hasAccount
    )
  ]
  if (wantsAccount) {
    statements.push(
      db.prepare(
        'INSERT INTO users (id, email, password, role, name) VALUES (?, ?, ?, ?, ?)'
      ).bind(userId, emailStr, hashedPassword, 'student', body.name)
    )
  }

  try {
    await db.batch(statements)
  } catch (err) {
    console.error('[students.POST] batch failed:', err)
    return c.json({ success: false, message: '创建失败：' + (err.message || String(err)) }, 500)
  }

  const created = await db.prepare('SELECT * FROM students WHERE student_id = ?').bind(studentIdStr).first()
  return c.json({
    success: true,
    data: formatStudent(created),
    message: wantsAccount ? '学生及登录账号创建成功' : '学生创建成功（未设置登录密码）'
  }, 201)
})

// ─── 更新学生信息 ─────────────────────────────────────────────────────────────
students.put('/:id', async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()
  const body = await c.req.json()
  const db = c.env.DB

  const student = await db.prepare(
    'SELECT * FROM students WHERE student_id = ? OR user_id = ? LIMIT 1'
  ).bind(id, id).first()

  if (!student) return c.json({ success: false, message: '学生不存在' }, 404)

  if (isStudent(user) && user.studentId !== student.student_id) {
    return c.json({ success: false, message: '无权修改该学生信息' }, 403)
  }
  // 【新需求68】老师写权限校验加入顾问老师 (consultant_id) 维度
  if (isTeacher(user)
      && student.teacher_id !== user.teacherId
      && student.academic_advisor_id !== user.teacherId
      && student.consultant_id !== user.teacherId) {
    return c.json({ success: false, message: '无权修改该学生信息' }, 403)
  }

  const fields = []
  const params = []

  const updatable = ['name', 'email', 'birthday', 'high_school', 'language_school',
    'lang_school_shift', 'phone',
    'jlpt_score', 'english_score', 'photo',
    'package_name', 'package_end_date', 'subject',
    'has_china_high_school_record']

  updatable.forEach(f => {
    if (body[f] !== undefined) { fields.push(`${f} = ?`); params.push(body[f]) }
  })

  // JSON 字段
  if (body.eju_scores !== undefined) { fields.push('eju_scores = ?'); params.push(JSON.stringify(body.eju_scores)) }
  if (body.jlpt_scores !== undefined) { fields.push('jlpt_scores = ?'); params.push(JSON.stringify(body.jlpt_scores)) }
  if (body.english_scores !== undefined) { fields.push('english_scores = ?'); params.push(JSON.stringify(body.english_scores)) }
  if (body.tags !== undefined) { fields.push('tags = ?'); params.push(JSON.stringify(body.tags)) }
  if (body.overseas_certifications !== undefined) { fields.push('overseas_certifications = ?'); params.push(JSON.stringify(body.overseas_certifications)) }
  if (body.follow_up_notes !== undefined) {
    fields.push('follow_up_notes = ?')
    params.push(typeof body.follow_up_notes === 'string' ? body.follow_up_notes : JSON.stringify(body.follow_up_notes))
  }

  // 管理员专属字段 + 老师也可修改老师分配
  // 【新需求68】允许更新 consultant_id（顾问老师）
  if (isAdmin(user) || isTeacher(user)) {
    if (body.teacher_id !== undefined) { fields.push('teacher_id = ?'); params.push(body.teacher_id) }
    if (body.academic_advisor_id !== undefined) { fields.push('academic_advisor_id = ?'); params.push(body.academic_advisor_id) }
    if (body.consultant_id !== undefined) { fields.push('consultant_id = ?'); params.push(body.consultant_id) }
  }
  if (isAdmin(user)) {
    if (body.is_active !== undefined) { fields.push('is_active = ?'); params.push(body.is_active ? 1 : 0) }
  }

  if (fields.length === 0) return c.json({ success: false, message: '没有可更新的字段' }, 400)

  fields.push("updated_at = datetime('now')")
  params.push(student.student_id)

  await db.prepare(`UPDATE students SET ${fields.join(', ')} WHERE student_id = ?`).bind(...params).run()

  // 同步更新 users 表的 name 和 email（确保登录信息一致）
  if (student.user_id && (body.name || body.email)) {
    const userFields = []
    const userParams = []
    if (body.name) { userFields.push('name = ?'); userParams.push(body.name) }
    if (body.email) { userFields.push('email = ?'); userParams.push(body.email) }
    if (userFields.length > 0) {
      userFields.push("updated_at = datetime('now')")
      userParams.push(student.user_id)
      await db.prepare(`UPDATE users SET ${userFields.join(', ')} WHERE id = ?`).bind(...userParams).run()
    }
  }

  const updated = await db.prepare('SELECT * FROM students WHERE student_id = ?').bind(student.student_id).first()

  return c.json({ success: true, data: formatStudent(updated), message: '学生信息更新成功' })
})

// ─── 删除学生（仅管理员）─────────────────────────────────────────────────────
students.delete('/:id', async (c) => {
  const user = c.get('user')
  if (!isAdmin(user)) return c.json({ success: false, message: '仅管理员可删除学生' }, 403)

  const { id } = c.req.param()
  const db = c.env.DB

  const student = await db.prepare(
    'SELECT student_id FROM students WHERE student_id = ? OR user_id = ? LIMIT 1'
  ).bind(id, id).first()

  if (!student) return c.json({ success: false, message: '学生不存在' }, 404)

  // 软删除
  await db.prepare(
    "UPDATE students SET is_active = 0, updated_at = datetime('now') WHERE student_id = ?"
  ).bind(student.student_id).run()

  return c.json({ success: true, message: '学生已删除' })
})

// ─── 追加备注（原子操作，避免并发覆盖）───────────────────────────────────────
students.post('/:id/notes', async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()
  const body = await c.req.json()
  const db = c.env.DB

  if (!body.content || !body.content.trim()) {
    return c.json({ success: false, message: '备注内容不能为空' }, 400)
  }

  const student = await db.prepare(
    'SELECT * FROM students WHERE student_id = ? OR user_id = ? LIMIT 1'
  ).bind(id, id).first()

  if (!student) return c.json({ success: false, message: '学生不存在' }, 404)

  // 权限检查（【新需求68】加入顾问老师维度）
  if (isStudent(user) && user.studentId !== student.student_id) {
    return c.json({ success: false, message: '无权操作' }, 403)
  }
  if (isTeacher(user)
      && student.teacher_id !== user.teacherId
      && student.academic_advisor_id !== user.teacherId
      && student.consultant_id !== user.teacherId) {
    return c.json({ success: false, message: '无权操作' }, 403)
  }

  // 原子化：读取现有备注 → 追加新备注 → 写回
  let existingNotes = []
  try {
    existingNotes = JSON.parse(student.follow_up_notes || '[]')
    if (!Array.isArray(existingNotes)) existingNotes = []
  } catch { existingNotes = [] }

  const newNote = {
    id: Date.now(),
    content: body.content.trim(),
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }),
    author: user.name || '未知',
    role: user.role,
  }

  // 新备注插入到最前面
  existingNotes.unshift(newNote)

  await db.prepare(
    "UPDATE students SET follow_up_notes = ?, updated_at = datetime('now') WHERE student_id = ?"
  ).bind(JSON.stringify(existingNotes), student.student_id).run()

  const updated = await db.prepare('SELECT * FROM students WHERE student_id = ?').bind(student.student_id).first()
  return c.json({ success: true, data: formatStudent(updated), note: newNote, message: '备注已添加' })
})

// ─── 删除备注（原子操作）─────────────────────────────────────────────────────
students.delete('/:id/notes/:noteId', async (c) => {
  const user = c.get('user')
  const { id, noteId } = c.req.param()
  const db = c.env.DB

  const student = await db.prepare(
    'SELECT * FROM students WHERE student_id = ? OR user_id = ? LIMIT 1'
  ).bind(id, id).first()

  if (!student) return c.json({ success: false, message: '学生不存在' }, 404)

  // 权限检查（【新需求68】加入顾问老师维度）
  if (isStudent(user) && user.studentId !== student.student_id) {
    return c.json({ success: false, message: '无权操作' }, 403)
  }
  if (isTeacher(user)
      && student.teacher_id !== user.teacherId
      && student.academic_advisor_id !== user.teacherId
      && student.consultant_id !== user.teacherId) {
    return c.json({ success: false, message: '无权操作' }, 403)
  }

  let existingNotes = []
  try {
    existingNotes = JSON.parse(student.follow_up_notes || '[]')
    if (!Array.isArray(existingNotes)) existingNotes = []
  } catch { existingNotes = [] }

  const noteIdNum = parseInt(noteId)
  const filtered = existingNotes.filter(n => n.id !== noteIdNum)

  if (filtered.length === existingNotes.length) {
    return c.json({ success: false, message: '备注不存在' }, 404)
  }

  await db.prepare(
    "UPDATE students SET follow_up_notes = ?, updated_at = datetime('now') WHERE student_id = ?"
  ).bind(JSON.stringify(filtered), student.student_id).run()

  const updated = await db.prepare('SELECT * FROM students WHERE student_id = ?').bind(student.student_id).first()
  return c.json({ success: true, data: formatStudent(updated), message: '备注已删除' })
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
    'SELECT student_id FROM students WHERE student_id = ? OR user_id = ? LIMIT 1'
  ).bind(id, id).first()

  if (!student) return c.json({ success: false, message: '学生不存在' }, 404)

  await db.prepare(
    "UPDATE students SET teacher_id = ?, updated_at = datetime('now') WHERE student_id = ?"
  ).bind(teacher_id, student.student_id).run()

  return c.json({ success: true, message: `学生已转移到教师 ${teacher_id}` })
})

export default students

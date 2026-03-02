// 认证路由 - Cloudflare Workers 版本
// 使用 jose 替代 jsonwebtoken，使用 Web Crypto API 替代 bcryptjs
import { Hono } from 'hono'
import { SignJWT } from 'jose'

const auth = new Hono()

// ─── 密码工具函数（Web Crypto PBKDF2，替代 bcryptjs）────────────────────────

// 哈希密码
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

// 验证密码（支持 PBKDF2 格式）
async function verifyPassword(password, stored) {
  try {
    const combined = Uint8Array.from(atob(stored), c => c.charCodeAt(0))
    const salt = combined.slice(0, 16)
    const storedHash = combined.slice(16)
    const encoder = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey(
      'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
    )
    const hash = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial, 256
    )
    const newHash = new Uint8Array(hash)
    return storedHash.length === newHash.length && storedHash.every((b, i) => b === newHash[i])
  } catch {
    return false
  }
}

// 生成 JWT
async function signJWT(payload, secret, expiresIn = '7d') {
  const secretKey = new TextEncoder().encode(secret)
  const expSeconds = expiresIn === '7d' ? 7 * 24 * 3600 : 24 * 3600
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expSeconds)
    .sign(secretKey)
}

// ─── 发送验证码 ──────────────────────────────────────────────────────────────
auth.post('/send-verification', async (c) => {
  try {
    const { email } = await c.req.json()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return c.json({ success: false, message: '请提供有效的邮箱地址' }, 400)
    }

    const db = c.env.DB

    // 频率限制：60 秒内只能发送一次
    const existing = await db.prepare(
      'SELECT * FROM verification_codes WHERE email = ? ORDER BY created_at DESC LIMIT 1'
    ).bind(email).first()

    if (existing && existing.last_sent_at && Date.now() - existing.last_sent_at < 60 * 1000) {
      const waitSec = Math.ceil((60 * 1000 - (Date.now() - existing.last_sent_at)) / 1000)
      return c.json({ success: false, message: `发送过于频繁，请 ${waitSec} 秒后重试` }, 429)
    }

    const code = String(Math.floor(100000 + Math.random() * 900000))
    const expiresAt = Date.now() + 10 * 60 * 1000

    // 删除旧记录，插入新记录
    await db.prepare('DELETE FROM verification_codes WHERE email = ?').bind(email).run()
    await db.prepare(
      'INSERT INTO verification_codes (email, code, expires_at, attempts, verified, last_sent_at) VALUES (?, ?, ?, 0, 0, ?)'
    ).bind(email, code, expiresAt, Date.now()).run()

    // 尝试发送邮件（通过 Cloudflare Email Workers 或 MailChannels）
    if (c.env.SMTP_HOST && c.env.SMTP_USER && c.env.SMTP_PASSWORD) {
      // 使用 MailChannels（Cloudflare Workers 免费邮件服务）
      try {
        await fetch('https://api.mailchannels.net/tx/v1/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            personalizations: [{ to: [{ email }] }],
            from: { email: c.env.SMTP_USER, name: 'JSA 留学助手' },
            subject: 'JSA 日本留学助手 - 邮箱验证码',
            content: [{
              type: 'text/html',
              value: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
                <h2 style="color:#4f46e5">🎓 JSA 日本留学助手</h2>
                <p>您好，您正在注册 JSA 账号，以下是您的邮箱验证码：</p>
                <div style="background:#f3f4f6;border-radius:8px;padding:16px;text-align:center;margin:16px 0">
                  <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#4f46e5">${code}</span>
                </div>
                <p style="color:#6b7280;font-size:14px">验证码 10 分钟内有效，请勿泄露给他人。</p>
              </div>`
            }]
          })
        })
        return c.json({ success: true, message: '验证码已发送到您的邮箱', mode: 'email' })
      } catch (_) { /* 邮件发送失败，降级为演示模式 */ }
    }

    // 演示模式
    console.log(`📧 [演示模式] 邮箱 ${email} 的验证码: ${code}`)
    return c.json({ success: true, message: '演示模式：验证码已生成', mode: 'demo', demoCode: code })
  } catch (error) {
    console.error('Send verification error:', error)
    return c.json({ success: false, message: '发送验证码失败，请稍后重试' }, 500)
  }
})

// ─── 验证验证码 ──────────────────────────────────────────────────────────────
auth.post('/verify-code', async (c) => {
  try {
    const { email, code } = await c.req.json()
    const db = c.env.DB

    const record = await db.prepare(
      'SELECT * FROM verification_codes WHERE email = ?'
    ).bind(email).first()

    if (!record) {
      return c.json({ success: false, message: '请先获取验证码' }, 400)
    }
    if (Date.now() > record.expires_at) {
      await db.prepare('DELETE FROM verification_codes WHERE email = ?').bind(email).run()
      return c.json({ success: false, message: '验证码已过期，请重新获取' }, 400)
    }
    if (record.attempts >= 5) {
      await db.prepare('DELETE FROM verification_codes WHERE email = ?').bind(email).run()
      return c.json({ success: false, message: '验证尝试次数过多，请重新获取验证码' }, 400)
    }

    await db.prepare(
      'UPDATE verification_codes SET attempts = ? WHERE email = ?'
    ).bind(record.attempts + 1, email).run()

    if (record.code !== String(code)) {
      return c.json({ success: false, message: '验证码错误' }, 400)
    }

    await db.prepare(
      'UPDATE verification_codes SET verified = 1 WHERE email = ?'
    ).bind(email).run()

    return c.json({ success: true, message: '邮箱验证成功' })
  } catch (error) {
    console.error('Verify code error:', error)
    return c.json({ success: false, message: '验证失败' }, 500)
  }
})

// ─── 登录 ────────────────────────────────────────────────────────────────────
auth.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json()

    if (!email || !password) {
      return c.json({ success: false, message: '请提供邮箱和密码' }, 400)
    }

    const db = c.env.DB
    const user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first()

    if (!user) {
      return c.json({ success: false, message: '邮箱或密码错误' }, 401)
    }

    const isValid = await verifyPassword(password, user.password)
    if (!isValid) {
      return c.json({ success: false, message: '邮箱或密码错误' }, 401)
    }

    // 获取角色附加信息（直接从 users 表读取，不再查 teachers 表）
    let additionalData = {}
    if (user.role === 'student') {
      // 优先用 users.student_id，再查 students 表
      let studentId = user.student_id
      if (!studentId) {
        const student = await db.prepare(
          'SELECT student_id FROM students WHERE user_id = ?'
        ).bind(user.id).first()
        studentId = student?.student_id
      }
      additionalData = { studentId }
    } else if (user.role === 'teacher') {
      // 直接用 users.teacher_id
      additionalData = { teacherId: user.teacher_id }
    }

    const jwtSecret = c.env.JWT_SECRET || 'dev-jwt-secret-do-not-use-in-production'
    const token = await signJWT(
      { id: user.id, email: user.email, role: user.role, name: user.name, ...additionalData },
      jwtSecret
    )

    return c.json({
      success: true,
      message: '登录成功',
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, ...additionalData }
    })
  } catch (error) {
    console.error('Login error:', error)
    return c.json({ success: false, message: '登录失败，请稍后再试' }, 500)
  }
})

// ─── 学生注册 ────────────────────────────────────────────────────────────────
auth.post('/register', async (c) => {
  try {
    const { studentId, email, password, name, verificationCode } = await c.req.json()

    if (!studentId || !email || !password) {
      return c.json({ success: false, message: '请提供学号、邮箱和密码' }, 400)
    }

    const db = c.env.DB

    // 验证邮箱验证码
    const codeRecord = await db.prepare(
      'SELECT * FROM verification_codes WHERE email = ?'
    ).bind(email).first()

    if (codeRecord) {
      if (!codeRecord.verified) {
        if (!verificationCode || codeRecord.code !== String(verificationCode)) {
          return c.json({ success: false, message: '邮箱验证码错误或未验证' }, 400)
        }
      }
      await db.prepare('DELETE FROM verification_codes WHERE email = ?').bind(email).run()
    }

    // 检查学号是否存在
    const student = await db.prepare(
      'SELECT * FROM students WHERE student_id = ?'
    ).bind(studentId).first()

    if (!student) {
      return c.json({ success: false, message: '学号不存在，请联系管理员' }, 400)
    }
    if (student.has_account) {
      return c.json({ success: false, message: '该学号已被注册' }, 400)
    }

    // 检查邮箱是否已存在
    const existingUser = await db.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first()

    if (existingUser) {
      return c.json({ success: false, message: '该邮箱已被使用' }, 400)
    }

    const hashedPassword = await hashPassword(password)
    const userId = `student_${Date.now()}`

    // 事务：创建用户 + 更新学生记录
    await db.batch([
      db.prepare(
        'INSERT INTO users (id, email, password, role, name) VALUES (?, ?, ?, ?, ?)'
      ).bind(userId, email, hashedPassword, 'student', name || student.name),
      db.prepare(
        'UPDATE students SET user_id = ?, email = ?, has_account = 1, updated_at = datetime(\'now\') WHERE student_id = ?'
      ).bind(userId, email, studentId)
    ])

    return c.json({ success: true, message: '注册成功' })
  } catch (error) {
    console.error('Registration error:', error)
    return c.json({ success: false, message: '注册失败，请稍后再试' }, 500)
  }
})

// ─── 验证令牌 ────────────────────────────────────────────────────────────────
auth.get('/verify', async (c) => {
  const token = c.req.header('Authorization')?.split(' ')[1]
  if (!token) {
    return c.json({ success: false, message: '未提供认证令牌' }, 401)
  }
  try {
    const { jwtVerify } = await import('jose')
    const secret = new TextEncoder().encode(
      c.env.JWT_SECRET || 'dev-jwt-secret-do-not-use-in-production'
    )
    const { payload } = await jwtVerify(token, secret)
    return c.json({ success: true, user: payload })
  } catch {
    return c.json({ success: false, message: '令牌无效或已过期' }, 401)
  }
})

// ─── 登出（无状态 JWT，前端清除 token 即可）──────────────────────────────────
auth.post('/logout', (c) => {
  return c.json({ success: true, message: '登出成功' })
})

// ─── 修改密码（需要 JWT 鉴权）────────────────────────────────────────────────
auth.post('/change-password', async (c) => {
  const user = c.get('user')
  if (!user) return c.json({ success: false, message: '未授权' }, 401)

  try {
    const { oldPassword, newPassword } = await c.req.json()
    const db = c.env.DB

    const dbUser = await db.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first()
    if (!dbUser) return c.json({ success: false, message: '用户不存在' }, 404)

    const isValid = await verifyPassword(oldPassword, dbUser.password)
    if (!isValid) return c.json({ success: false, message: '原密码错误' }, 401)

    const hashedPassword = await hashPassword(newPassword)
    await db.prepare(
      'UPDATE users SET password = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).bind(hashedPassword, user.id).run()

    return c.json({ success: true, message: '密码修改成功' })
  } catch (error) {
    console.error('Change password error:', error)
    return c.json({ success: false, message: '密码修改失败' }, 500)
  }
})

// ─── 初始化测试数据（支持 force=true 强制重置）──────────
auth.post('/init-seed', async (c) => {
  const db = c.env.DB
  try {
    const body = await c.req.json().catch(() => ({}))
    const force = body.force === true

    // 安全检查：只有 users 表为空或 force 模式时才允许初始化
    const count = await db.prepare('SELECT COUNT(*) as cnt FROM users').first()
    if (count && count.cnt > 0 && !force) {
      return c.json({ success: false, message: `数据库已有 ${count.cnt} 条用户记录，传入 { "force": true } 可强制重置` }, 403)
    }

    // force 模式：先清空所有相关表
    if (force) {
      await db.batch([
        db.prepare('DELETE FROM materials'),
        db.prepare('DELETE FROM events'),
        db.prepare('DELETE FROM schools'),
        db.prepare('DELETE FROM teachers'),
        db.prepare('DELETE FROM verification_codes'),
        db.prepare('DELETE FROM students'),
        db.prepare('DELETE FROM users'),
      ])
    }

    // 测试账号列表
    const usersToCreate = [
      { id: 'admin1', email: 'admin@jsa.com', password: 'admin123', role: 'admin', name: '系统管理员', teacherId: null, studentId: null },
      { id: 'teacher1', email: 'wang@school.com', password: 'wang123', role: 'teacher', name: '王老师', teacherId: 'teacher_1', studentId: null },
      { id: 'teacher2', email: 'li@school.com', password: 'li123', role: 'teacher', name: '李老师', teacherId: 'teacher_2', studentId: null },
      { id: 'teacher3', email: 'zhang@school.com', password: 'zhang123', role: 'teacher', name: '张老师', teacherId: 'teacher_3', studentId: null },
      { id: 'teacher4', email: 'chen@school.com', password: 'chen123', role: 'teacher', name: '陈老师', teacherId: 'teacher_4', studentId: null },
      { id: 'teacher5', email: 'zhao@school.com', password: 'zhao123', role: 'teacher', name: '赵老师', teacherId: 'teacher_5', studentId: null },
      { id: 'teacher6', email: 'gao@school.com', password: 'gao123', role: 'teacher', name: '高老师（学管）', teacherId: 'teacher_6', studentId: null },
      { id: 'teacher7', email: 'lin@school.com', password: 'lin123', role: 'teacher', name: '林老师（学管）', teacherId: 'teacher_7', studentId: null },
      { id: 'student1', email: 'zhangsan@student.jsa.com', password: 'stu2024001', role: 'student', name: '张三', teacherId: null, studentId: '2024001' },
      { id: 'student2', email: 'lisi@student.jsa.com', password: 'stu2024002', role: 'student', name: '李四', teacherId: null, studentId: '2024002' },
      { id: 'student3', email: 'wangwu@student.jsa.com', password: 'stu2024003', role: 'student', name: '王五', teacherId: null, studentId: '2024003' },
    ]

    // 测试学生列表
    const studentsToCreate = [
      { studentId: '2024001', userId: 'student1', name: '张三', email: 'zhangsan@student.jsa.com', teacherId: 'teacher_1', advisorId: 'teacher_6', birthday: '2001-05-12', highSchool: '北京十一中学', langSchool: '东京日本语学院', jlpt: 'N1-142', eju: '[{"date":"2025-06","japanese":310,"math":170,"science":145,"total":625}]', english: 'TOEFL 85', pkg: '私塾', pkgEnd: '2026-06-30', tags: '["理科","重点关注"]', subject: '理科', hasAccount: 1 },
      { studentId: '2024002', userId: 'student2', name: '李四', email: 'lisi@student.jsa.com', teacherId: 'teacher_1', advisorId: 'teacher_6', birthday: '2002-01-20', highSchool: '上海外国语学校', langSchool: '大阪日本语学校', jlpt: 'N2-120', eju: '[]', english: '', pkg: '校内考专家 1+2', pkgEnd: '2026-03-31', tags: '["文科"]', subject: '文科', hasAccount: 1 },
      { studentId: '2024003', userId: 'student3', name: '王五', email: 'wangwu@student.jsa.com', teacherId: 'teacher_2', advisorId: 'teacher_7', birthday: '2000-11-03', highSchool: '广州执信中学', langSchool: '京都国际学院', jlpt: 'N1-158', eju: '[{"date":"2025-06","japanese":340,"math":190,"science":160,"total":690}]', english: 'TOEIC 780', pkg: '丁老师规划 1+2+3', pkgEnd: '2027-03-31', tags: '["理科","优秀学生"]', subject: '理科', hasAccount: 1 },
      { studentId: '2024004', userId: null, name: '赵六', email: '', teacherId: 'teacher_2', advisorId: 'teacher_7', birthday: '2001-08-15', highSchool: '成都七中', langSchool: '名古屋日本语学院', jlpt: 'N2-105', eju: '[{"date":"2025-06","japanese":280,"math":120,"science":0,"total":400}]', english: '', pkg: '校内考专家 1+2+3', pkgEnd: '2026-09-30', tags: '["文科","需加强"]', subject: '文科', hasAccount: 0 },
      { studentId: '2024005', userId: null, name: '刘七', email: '', teacherId: 'teacher_3', advisorId: 'teacher_6', birthday: '2000-03-28', highSchool: '杭州学军中学', langSchool: '早稻田日本语学校', jlpt: 'N1-170', eju: '[{"date":"2025-06","japanese":355,"math":195,"science":170,"total":720}]', english: 'TOEFL 95', pkg: '丁老师规划 1+2', pkgEnd: '2026-08-31', tags: '["理科","优秀学生","即将毕业"]', subject: '理科', hasAccount: 0 },
      { studentId: '2024006', userId: null, name: '孙八', email: '', teacherId: 'teacher_1', advisorId: '', birthday: '2003-06-10', highSchool: '武汉外国语学校', langSchool: '横滨国际学院', jlpt: 'N3', eju: '[]', english: '', pkg: '', pkgEnd: '', tags: '["文科","新生"]', subject: '文科', hasAccount: 0 },
      { studentId: '2024007', userId: null, name: '周九', email: '', teacherId: 'teacher_4', advisorId: 'teacher_7', birthday: '2001-12-25', highSchool: '深圳实验学校', langSchool: '东京外语学院', jlpt: 'N1-135', eju: '[{"date":"2025-06","japanese":320,"math":165,"science":140,"total":625}]', english: 'IELTS 6.5', pkg: '私塾', pkgEnd: '2026-05-31', tags: '["理科"]', subject: '理科', hasAccount: 0 },
      { studentId: '2024008', userId: null, name: '吴十', email: '', teacherId: 'teacher_4', advisorId: '', birthday: '2003-09-01', highSchool: '南京外国语学校', langSchool: '神户日本语学校', jlpt: '', eju: '[]', english: '', pkg: '校内考专家 1+2', pkgEnd: '2026-12-31', tags: '["文科","新生","需加强"]', subject: '文科', hasAccount: 0 },
      { studentId: '2024009', userId: null, name: '郑十一', email: '', teacherId: 'teacher_2', advisorId: 'teacher_6', birthday: '1999-07-14', highSchool: '重庆南开中学', langSchool: '大阪国际学院', jlpt: 'N1-165', eju: '[{"date":"2025-06","japanese":350,"math":185,"science":165,"total":700}]', english: 'TOEFL 100', pkg: '丁老师规划 1+2+3', pkgEnd: '2025-12-31', tags: '["理科","已合格"]', subject: '理科', hasAccount: 0 },
      { studentId: '2024010', userId: null, name: '冯十二', email: '', teacherId: 'teacher_5', advisorId: 'teacher_7', birthday: '2002-04-22', highSchool: '天津南开中学', langSchool: '东京中央日本语学校', jlpt: 'N2-115', eju: '[{"date":"2025-06","japanese":290,"math":0,"science":0,"total":290}]', english: 'TOEIC 650', pkg: '私塾', pkgEnd: '2026-04-30', tags: '["文科"]', subject: '文科', hasAccount: 0 },
      { studentId: '2024011', userId: null, name: '陈十三', email: '', teacherId: 'teacher_3', advisorId: '', birthday: '2002-10-08', highSchool: '西安高新一中', langSchool: '京都文化日本语学校', jlpt: 'N2-98', eju: '[]', english: '', pkg: '', pkgEnd: '', tags: '["理科","新生"]', subject: '理科', hasAccount: 0 },
      { studentId: '2024012', userId: null, name: '林十四', email: '', teacherId: '', advisorId: '', birthday: '2003-02-14', highSchool: '厦门外国语学校', langSchool: '', jlpt: '', eju: '[]', english: '', pkg: '', pkgEnd: '', tags: '[]', subject: '', hasAccount: 0 },
    ]

    // 批量哈希密码并插入用户
    const userInserts = []
    for (const u of usersToCreate) {
      const hashed = await hashPassword(u.password)
      userInserts.push(
        db.prepare(
          'INSERT OR IGNORE INTO users (id, email, password, role, name, teacher_id, student_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(u.id, u.email, hashed, u.role, u.name, u.teacherId, u.studentId)
      )
    }

    // 批量插入学生
    const studentInserts = studentsToCreate.map(s =>
      db.prepare(
        `INSERT OR IGNORE INTO students
          (student_id, user_id, name, email, teacher_id, academic_advisor_id, birthday,
           high_school, language_school, jlpt_score, eju_scores, english_score,
           package_name, package_end_date, tags, subject, has_account)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        s.studentId, s.userId, s.name, s.email, s.teacherId, s.advisorId, s.birthday,
        s.highSchool, s.langSchool, s.jlpt, s.eju, s.english,
        s.pkg, s.pkgEnd, s.tags, s.subject, s.hasAccount
      )
    )

    // 老师详情表（含部门信息，用于区分升学老师和学管老师）
    const teachersToCreate = [
      { teacherId: 'teacher_1', userId: 'teacher1', department: '学部升学组', subject: '理科', permissions: '["manage_students","manage_events","manage_schools","manage_materials"]' },
      { teacherId: 'teacher_2', userId: 'teacher2', department: '学部升学组', subject: '文科', permissions: '["manage_students","manage_events","manage_schools","manage_materials"]' },
      { teacherId: 'teacher_3', userId: 'teacher3', department: '学部升学组', subject: '理科', permissions: '["manage_students","manage_events","manage_schools","manage_materials"]' },
      { teacherId: 'teacher_4', userId: 'teacher4', department: '教务', subject: '', permissions: '["manage_students","manage_events"]' },
      { teacherId: 'teacher_5', userId: 'teacher5', department: '学部升学组', subject: '文科', permissions: '["manage_students","manage_events","manage_schools","manage_materials"]' },
      { teacherId: 'teacher_6', userId: 'teacher6', department: '学管', subject: '', permissions: '["manage_students","manage_events"]' },
      { teacherId: 'teacher_7', userId: 'teacher7', department: '学管', subject: '', permissions: '["manage_students","manage_events"]' },
    ]

    const teacherInserts = teachersToCreate.map(t =>
      db.prepare(
        `INSERT OR IGNORE INTO teachers
          (teacher_id, user_id, department, subject, permissions, gender, birthday, phone, email_contact, address, education, hire_date, employment_type, photo)
         VALUES (?, ?, ?, ?, ?, '', '', '', '', '', '', '', '', '')`
      ).bind(t.teacherId, t.userId, t.department, t.subject, t.permissions)
    )

    await db.batch([...userInserts, ...studentInserts, ...teacherInserts])

    return c.json({
      success: true,
      message: `初始化完成：创建了 ${usersToCreate.length} 个用户，${studentsToCreate.length} 个学生记录`,
      accounts: {
        admin: 'admin@jsa.com / admin123',
        teachers: ['wang@school.com / wang123', 'li@school.com / li123', 'zhang@school.com / zhang123'],
        students: ['zhangsan@student.jsa.com / stu2024001', 'lisi@student.jsa.com / stu2024002', 'wangwu@student.jsa.com / stu2024003'],
      }
    })
  } catch (error) {
    console.error('Init seed error:', error)
    return c.json({ success: false, message: '初始化失败: ' + error.message }, 500)
  }
})

export default auth

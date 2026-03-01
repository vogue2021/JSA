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

    // 获取角色附加信息
    let additionalData = {}
    if (user.role === 'student') {
      const student = await db.prepare(
        'SELECT student_id FROM students WHERE user_id = ?'
      ).bind(user.id).first()
      additionalData = { studentId: student?.student_id }
    } else if (user.role === 'teacher') {
      const teacher = await db.prepare(
        'SELECT teacher_id FROM teachers WHERE user_id = ?'
      ).bind(user.id).first()
      additionalData = { teacherId: teacher?.teacher_id }
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

export default auth

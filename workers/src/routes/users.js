// 用户管理路由 - 仅管理员可用
import { Hono } from 'hono'

const users = new Hono()

// ─── 获取所有用户列表（仅管理员）─────────────────────────────────────────────
users.get('/', async (c) => {
  const user = c.get('user')
  if (user?.role !== 'admin') {
    return c.json({ success: false, message: '仅管理员可查看所有用户' }, 403)
  }

  const db = c.env.DB
  const { results } = await db.prepare(
    `SELECT id, email, role, name, teacher_id, student_id, is_active, created_at
     FROM users ORDER BY created_at DESC`
  ).all()

  return c.json({ success: true, data: results })
})

// ─── 删除用户（仅管理员）─────────────────────────────────────────────────────
users.delete('/:id', async (c) => {
  const user = c.get('user')
  if (user?.role !== 'admin') {
    return c.json({ success: false, message: '仅管理员可删除用户' }, 403)
  }

  const { id } = c.req.param()
  const db = c.env.DB

  // 不允许删除自己
  if (user.id === id) {
    return c.json({ success: false, message: '不能删除自己的账号' }, 400)
  }

  const target = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first()
  if (!target) return c.json({ success: false, message: '用户不存在' }, 404)

  // 如果是老师，检查是否有学生
  if (target.role === 'teacher' && target.teacher_id) {
    const studentCount = await db.prepare(
      'SELECT COUNT(*) as count FROM students WHERE teacher_id = ?'
    ).bind(target.teacher_id).first()
    if (studentCount?.count > 0) {
      return c.json({ success: false, message: `该老师还有 ${studentCount.count} 个学生，请先转移学生` }, 400)
    }
  }

  const batch = [db.prepare('DELETE FROM users WHERE id = ?').bind(id)]
  // 级联清理老师/学生关联
  if (target.teacher_id) {
    batch.push(db.prepare('DELETE FROM teachers WHERE teacher_id = ?').bind(target.teacher_id))
  }
  if (target.student_id) {
    batch.push(db.prepare('UPDATE students SET has_account = 0, user_id = NULL WHERE student_id = ?').bind(target.student_id))
  }

  await db.batch(batch)
  return c.json({ success: true, message: '用户已删除' })
})

// ─── 禁用/启用用户（仅管理员）─────────────────────────────────────────────
users.put('/:id/toggle-active', async (c) => {
  const user = c.get('user')
  if (user?.role !== 'admin') {
    return c.json({ success: false, message: '仅管理员可操作' }, 403)
  }

  const { id } = c.req.param()
  const db = c.env.DB

  if (user.id === id) {
    return c.json({ success: false, message: '不能禁用自己的账号' }, 400)
  }

  const target = await db.prepare('SELECT id, is_active FROM users WHERE id = ?').bind(id).first()
  if (!target) return c.json({ success: false, message: '用户不存在' }, 404)

  const newStatus = target.is_active ? 0 : 1
  await db.prepare("UPDATE users SET is_active = ?, updated_at = datetime('now') WHERE id = ?").bind(newStatus, id).run()

  return c.json({ success: true, message: newStatus ? '账号已启用' : '账号已禁用', data: { isActive: Boolean(newStatus) } })
})

// ─── 创建管理员账号（仅管理员）─────────────────────────────────────────────
users.post('/create-admin', async (c) => {
  const user = c.get('user')
  if (user?.role !== 'admin') {
    return c.json({ success: false, message: '仅管理员可创建管理员账号' }, 403)
  }

  const body = await c.req.json()
  const { email, name, password } = body

  if (!email || !name || !password) {
    return c.json({ success: false, message: '邮箱、姓名、密码不能为空' }, 400)
  }

  if (password.length < 6) {
    return c.json({ success: false, message: '密码至少6位' }, 400)
  }

  const db = c.env.DB

  // 检查邮箱是否已存在
  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
  if (existing) {
    return c.json({ success: false, message: '该邮箱已被注册' }, 409)
  }

  // PBKDF2 哈希密码（与 auth.js 中一致）
  const enc = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256)
  const hash = btoa(String.fromCharCode(...salt, ...new Uint8Array(bits)))

  const adminId = `admin_${Date.now()}`
  await db.prepare(
    "INSERT INTO users (id, email, password, role, name, is_active, created_at, updated_at) VALUES (?, ?, ?, 'admin', ?, 1, datetime('now'), datetime('now'))"
  ).bind(adminId, email, hash, name).run()

  return c.json({ success: true, message: '管理员账号已创建', data: { id: adminId, email, name, role: 'admin' } })
})

export default users

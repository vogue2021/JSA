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

export default users

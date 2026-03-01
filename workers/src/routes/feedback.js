// 反馈路由 - Cloudflare Workers 版本
import { Hono } from 'hono'
import { jwtVerify } from 'jose'

const feedback = new Hono()

// ─── 提交反馈（公开，无需登录）───────────────────────────────────────────────
feedback.post('/', async (c) => {
  try {
    const { type, content, contact } = await c.req.json()

    if (!content || !content.trim()) {
      return c.json({ success: false, message: '反馈内容不能为空' }, 400)
    }

    const validTypes = ['suggestion', 'bug', 'other']
    const feedbackType = validTypes.includes(type) ? type : 'suggestion'

    // 尝试从 Authorization header 解析用户信息（可选）
    let userName = '匿名'
    let userId = null
    const authHeader = c.req.header('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1]
        const secret = new TextEncoder().encode(
          c.env.JWT_SECRET || 'dev-jwt-secret-do-not-use-in-production'
        )
        const { payload } = await jwtVerify(token, secret)
        userName = payload.name || payload.email || '匿名'
        userId = payload.id ? String(payload.id) : null
      } catch { /* token 无效时忽略，允许匿名提交 */ }
    }

    const feedbackId = `fb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const db = c.env.DB

    await db.prepare(`
      INSERT INTO feedbacks (id, type, content, contact, user_name, user_id, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `).bind(feedbackId, feedbackType, content.trim(), contact?.trim() || null, userName, userId).run()

    return c.json({ success: true, message: '反馈提交成功，感谢您的反馈！', id: feedbackId }, 201)
  } catch (error) {
    console.error('提交反馈失败:', error)
    return c.json({ success: false, message: '提交失败，请稍后重试' }, 500)
  }
})

// ─── 管理员：查询反馈列表（需鉴权）──────────────────────────────────────────
feedback.get('/', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'admin') {
    return c.json({ success: false, message: '无权限查看反馈记录' }, 403)
  }

  const { status, type, page = '1', pageSize = '20' } = c.req.query()
  const pageNum = parseInt(page)
  const pageSizeNum = parseInt(pageSize)
  const offset = (pageNum - 1) * pageSizeNum
  const db = c.env.DB

  let sql = 'SELECT * FROM feedbacks WHERE 1=1'
  const params = []
  if (status) { sql += ' AND status = ?'; params.push(status) }
  if (type) { sql += ' AND type = ?'; params.push(type) }

  const countResult = await db.prepare(
    `SELECT COUNT(*) as total FROM feedbacks WHERE 1=1${status ? ' AND status = ?' : ''}${type ? ' AND type = ?' : ''}`
  ).bind(...params).first()

  const { results: items } = await db.prepare(
    `${sql} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, pageSizeNum, offset).all()

  return c.json({
    success: true,
    data: items,
    pagination: {
      total: Number(countResult?.total || 0),
      page: pageNum,
      pageSize: pageSizeNum,
      totalPages: Math.ceil(Number(countResult?.total || 0) / pageSizeNum)
    }
  })
})

// ─── 管理员：更新反馈状态（需鉴权）──────────────────────────────────────────
feedback.patch('/:id', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'admin') {
    return c.json({ success: false, message: '无权限操作' }, 403)
  }

  const { id } = c.req.param()
  const body = await c.req.json()
  const db = c.env.DB

  const validStatuses = ['pending', 'reviewed', 'resolved']
  const fields = []
  const params = []

  if (body.status && validStatuses.includes(body.status)) {
    fields.push('status = ?'); params.push(body.status)
  }
  if (body.admin_note !== undefined) {
    fields.push('admin_note = ?'); params.push(body.admin_note)
  }
  fields.push('updated_at = datetime(\'now\')')
  params.push(id)

  const result = await db.prepare(
    `UPDATE feedbacks SET ${fields.join(', ')} WHERE id = ?`
  ).bind(...params).run()

  if (!result.meta?.changes) {
    return c.json({ success: false, message: '反馈记录不存在' }, 404)
  }

  return c.json({ success: true, message: '更新成功' })
})

export default feedback

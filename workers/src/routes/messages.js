// 站内消息发布系统 - Cloudflare Workers 路由（新需求77）
// 规则：
//   - 发布权限：admin 永远可以；teacher 必须显式拥有 publish_messages 权限
//   - 浏览权限：
//       student → 只能看 audience IN ('student','all') 且未撤回的消息
//       teacher → 只能看 audience IN ('teacher','all') 且未撤回的消息
//       admin   → 看到所有（含撤回，便于运维）
//   - 撤回 / 编辑 / 删除：仅作者本人 + admin 可执行
//   - banner 接口返回最新 N 条「未读」消息，用于时间线顶部横幅
import { Hono } from 'hono'

const messages = new Hono()

const isAdmin = (u) => u?.role === 'admin'
const isTeacher = (u) => u?.role === 'teacher'
const isStudent = (u) => u?.role === 'student'

// 是否可发布消息
const canPublish = (u) => {
  if (!u) return false
  if (isAdmin(u)) return true
  if (isTeacher(u)) {
    return Array.isArray(u.permissions) && u.permissions.includes('publish_messages')
  }
  return false
}

// 用户能否看到这条消息（按 audience）
const canRead = (u, row) => {
  if (!u || !row) return false
  if (isAdmin(u)) return true
  if (row.revoked === 1) return false
  if (row.audience === 'all') return true
  if (isStudent(u) && row.audience === 'student') return true
  if (isTeacher(u) && row.audience === 'teacher') return true
  return false
}

const safeJsonArray = (txt) => {
  if (!txt) return []
  try { const v = JSON.parse(txt); return Array.isArray(v) ? v : [] } catch { return [] }
}

const serialize = (row, { isRead = false } = {}) => ({
  id: row.id,
  title: row.title,
  content: row.content || '',
  content_type: row.content_type || 'markdown',
  audience: row.audience || 'all',
  author_id: row.author_id || '',
  author_name: row.author_name || '',
  author_role: row.author_role || '',
  image_urls: safeJsonArray(row.image_urls),
  pinned: row.pinned === 1 || row.pinned === true,
  revoked: row.revoked === 1 || row.revoked === true,
  is_read: !!isRead,
  created_at: row.created_at,
  updated_at: row.updated_at,
})

// 当前用户能看到的 audience 条件 SQL（不含 revoked，调用方按需追加）
const audienceWhere = (user) => {
  if (isAdmin(user)) return { sql: '1=1', params: [] }
  if (isStudent(user)) return { sql: "(audience = 'student' OR audience = 'all')", params: [] }
  if (isTeacher(user)) return { sql: "(audience = 'teacher' OR audience = 'all')", params: [] }
  return { sql: '1=0', params: [] }
}

// ─── GET / ── 列表查询 ────────────────────────────────────────────────────────
// query: page, pageSize, search, audience（仅 admin 可过滤）, mine（仅看我发布的）, include_revoked
messages.get('/', async (c) => {
  const user = c.get('user')
  const db = c.env.DB

  const page = Math.max(1, parseInt(c.req.query('page') || '1'))
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('pageSize') || '20')))
  const search = (c.req.query('search') || '').trim()
  const audience = (c.req.query('audience') || '').trim()
  const mine = c.req.query('mine') === '1'
  const includeRevoked = c.req.query('include_revoked') === '1'

  const aw = audienceWhere(user)
  let sql = `SELECT * FROM messages WHERE ${aw.sql}`
  const params = [...aw.params]

  // 非 admin 默认隐藏已撤回；admin 可通过 include_revoked=1 包含
  if (!isAdmin(user) || !includeRevoked) {
    sql += ' AND revoked = 0'
  }

  if (search) {
    sql += ' AND (title LIKE ? OR content LIKE ?)'
    const kw = `%${search}%`
    params.push(kw, kw)
  }
  if (audience && isAdmin(user) && ['student','teacher','all'].includes(audience)) {
    sql += ' AND audience = ?'
    params.push(audience)
  }
  if (mine) {
    sql += ' AND author_id = ?'
    params.push(String(user.id || ''))
  }

  // 总数
  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as cnt')
  const countRow = await db.prepare(countSql).bind(...params).first()
  const total = countRow?.cnt || 0

  sql += ' ORDER BY pinned DESC, created_at DESC, id DESC LIMIT ? OFFSET ?'
  params.push(pageSize, (page - 1) * pageSize)

  const { results = [] } = await db.prepare(sql).bind(...params).all()

  // 批量查"已读"
  const ids = results.map(r => r.id)
  let readSet = new Set()
  if (ids.length > 0 && user.id) {
    const placeholders = ids.map(() => '?').join(',')
    const { results: readRows = [] } = await db.prepare(
      `SELECT message_id FROM message_reads WHERE user_id = ? AND message_id IN (${placeholders})`
    ).bind(String(user.id), ...ids).all()
    readSet = new Set(readRows.map(r => r.message_id))
  }

  return c.json({
    success: true,
    data: {
      list: results.map(r => serialize(r, { isRead: readSet.has(r.id) })),
      total,
      page,
      pageSize,
    },
  })
})

// ─── GET /banner ── 时间线顶部横幅未读消息（限制最多 5 条） ──────────────────
messages.get('/banner', async (c) => {
  const user = c.get('user')
  const db = c.env.DB

  const aw = audienceWhere(user)
  let sql = `SELECT m.* FROM messages m
    WHERE ${aw.sql} AND m.revoked = 0
    AND NOT EXISTS (
      SELECT 1 FROM message_reads r WHERE r.message_id = m.id AND r.user_id = ?
    )
    ORDER BY m.pinned DESC, m.created_at DESC, m.id DESC
    LIMIT 5`
  const params = [...aw.params, String(user.id || '')]

  const { results = [] } = await db.prepare(sql).bind(...params).all()
  return c.json({ success: true, data: results.map(r => serialize(r, { isRead: false })) })
})

// ─── GET /unread-count ── 未读数量（用于角标） ─────────────────────────────
messages.get('/unread-count', async (c) => {
  const user = c.get('user')
  const db = c.env.DB
  const aw = audienceWhere(user)
  const sql = `SELECT COUNT(*) as cnt FROM messages m
    WHERE ${aw.sql} AND m.revoked = 0
    AND NOT EXISTS (SELECT 1 FROM message_reads r WHERE r.message_id = m.id AND r.user_id = ?)`
  const params = [...aw.params, String(user.id || '')]
  const row = await db.prepare(sql).bind(...params).first()
  return c.json({ success: true, data: { count: row?.cnt || 0 } })
})

// ─── GET /:id ── 详情（自动标记已读） ─────────────────────────────────────────
messages.get('/:id', async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()
  const db = c.env.DB

  const row = await db.prepare('SELECT * FROM messages WHERE id = ?').bind(id).first()
  if (!row) return c.json({ success: false, message: '消息不存在' }, 404)
  if (!canRead(user, row)) return c.json({ success: false, message: '无权查看该消息' }, 403)

  // 标记已读（幂等，依赖 UNIQUE(message_id, user_id) 索引）
  if (user.id) {
    try {
      await db.prepare(
        'INSERT OR IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)'
      ).bind(row.id, String(user.id)).run()
    } catch { /* ignore */ }
  }
  return c.json({ success: true, data: serialize(row, { isRead: true }) })
})

// ─── POST /:id/read ── 显式标记已读（不返回详情） ─────────────────────────────
messages.post('/:id/read', async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()
  const db = c.env.DB
  const row = await db.prepare('SELECT * FROM messages WHERE id = ?').bind(id).first()
  if (!row) return c.json({ success: false, message: '消息不存在' }, 404)
  if (!canRead(user, row)) return c.json({ success: false, message: '无权操作该消息' }, 403)
  if (user.id) {
    await db.prepare('INSERT OR IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)').bind(row.id, String(user.id)).run()
  }
  return c.json({ success: true })
})

// ─── POST /read-all ── 一键全部标为已读 ──────────────────────────────────────
messages.post('/read-all', async (c) => {
  const user = c.get('user')
  const db = c.env.DB
  if (!user.id) return c.json({ success: false, message: '未登录' }, 401)
  const aw = audienceWhere(user)
  const sql = `INSERT OR IGNORE INTO message_reads (message_id, user_id)
    SELECT id, ? FROM messages WHERE ${aw.sql} AND revoked = 0`
  await db.prepare(sql).bind(String(user.id), ...aw.params).run()
  return c.json({ success: true })
})

// ─── POST / ── 新建消息 ──────────────────────────────────────────────────────
messages.post('/', async (c) => {
  const user = c.get('user')
  if (!canPublish(user)) return c.json({ success: false, message: '无权发布消息' }, 403)

  const body = await c.req.json().catch(() => ({}))
  const {
    title, content = '', content_type = 'markdown',
    audience = 'all', image_urls = [], pinned = false,
  } = body

  if (!title || !String(title).trim()) {
    return c.json({ success: false, message: '标题不能为空' }, 400)
  }
  if (!['student','teacher','all'].includes(audience)) {
    return c.json({ success: false, message: 'audience 必须是 student / teacher / all' }, 400)
  }
  const ct = content_type === 'html' ? 'html' : 'markdown'

  const db = c.env.DB
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const result = await db.prepare(`
    INSERT INTO messages
      (title, content, content_type, audience, author_id, author_name, author_role,
       image_urls, pinned, revoked, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).bind(
    String(title).trim(),
    String(content || ''),
    ct,
    audience,
    String(user.id || ''),
    user.name || '',
    user.role || '',
    JSON.stringify(Array.isArray(image_urls) ? image_urls : []),
    pinned ? 1 : 0,
    now, now,
  ).run()

  const newId = result.meta?.last_row_id
  const row = newId ? await db.prepare('SELECT * FROM messages WHERE id = ?').bind(newId).first() : null
  return c.json({ success: true, message: '消息已发布', data: row ? serialize(row, { isRead: true }) : null }, 201)
})

// ─── PUT /:id ── 编辑（仅作者 / admin） ──────────────────────────────────────
messages.put('/:id', async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()
  const db = c.env.DB
  const row = await db.prepare('SELECT * FROM messages WHERE id = ?').bind(id).first()
  if (!row) return c.json({ success: false, message: '消息不存在' }, 404)
  const isAuthor = String(row.author_id) === String(user.id || '')
  if (!isAdmin(user) && !isAuthor) return c.json({ success: false, message: '无权编辑该消息' }, 403)

  const body = await c.req.json().catch(() => ({}))
  const nextTitle = body.title !== undefined ? String(body.title).trim() : row.title
  if (!nextTitle) return c.json({ success: false, message: '标题不能为空' }, 400)
  const nextContent = body.content !== undefined ? String(body.content || '') : (row.content || '')
  const nextType = body.content_type !== undefined
    ? (body.content_type === 'html' ? 'html' : 'markdown')
    : row.content_type
  const nextAudience = body.audience !== undefined
    ? (['student','teacher','all'].includes(body.audience) ? body.audience : row.audience)
    : row.audience
  const nextImageUrls = body.image_urls !== undefined
    ? JSON.stringify(Array.isArray(body.image_urls) ? body.image_urls : [])
    : (row.image_urls || '[]')
  const nextPinned = body.pinned !== undefined ? (body.pinned ? 1 : 0) : row.pinned
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

  await db.prepare(`UPDATE messages SET
    title = ?, content = ?, content_type = ?, audience = ?,
    image_urls = ?, pinned = ?, updated_at = ? WHERE id = ?`).bind(
      nextTitle, nextContent, nextType, nextAudience,
      nextImageUrls, nextPinned, now, id,
    ).run()
  const updated = await db.prepare('SELECT * FROM messages WHERE id = ?').bind(id).first()
  return c.json({ success: true, message: '消息已更新', data: serialize(updated, { isRead: true }) })
})

// ─── PUT /:id/revoke ── 撤回（仅作者 / admin），用 PUT 而非 PATCH 避开 CDN 预检 ──
messages.put('/:id/revoke', async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()
  const db = c.env.DB
  const row = await db.prepare('SELECT * FROM messages WHERE id = ?').bind(id).first()
  if (!row) return c.json({ success: false, message: '消息不存在' }, 404)
  const isAuthor = String(row.author_id) === String(user.id || '')
  if (!isAdmin(user) && !isAuthor) return c.json({ success: false, message: '无权撤回该消息' }, 403)
  const body = await c.req.json().catch(() => ({}))
  const nextRevoked = body.revoked === false ? 0 : 1
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  await db.prepare('UPDATE messages SET revoked = ?, updated_at = ? WHERE id = ?').bind(nextRevoked, now, id).run()
  const updated = await db.prepare('SELECT * FROM messages WHERE id = ?').bind(id).first()
  return c.json({ success: true, data: serialize(updated, { isRead: true }) })
})

// ─── DELETE /:id ── 永久删除（仅 admin，物理删除；老师只能撤回） ─────────────
messages.delete('/:id', async (c) => {
  const user = c.get('user')
  if (!isAdmin(user)) return c.json({ success: false, message: '仅管理员可永久删除消息' }, 403)
  const { id } = c.req.param()
  const db = c.env.DB
  const row = await db.prepare('SELECT id FROM messages WHERE id = ?').bind(id).first()
  if (!row) return c.json({ success: false, message: '消息不存在' }, 404)
  await db.prepare('DELETE FROM messages WHERE id = ?').bind(id).run()
  return c.json({ success: true, message: '消息已删除' })
})

export default messages

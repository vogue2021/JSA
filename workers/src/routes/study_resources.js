// 塾内备考资料库 - Cloudflare Workers 路由（需求38）
// 规则：
//   - 老师/管理员：可增删改查全部资料（含私密）
//   - 学生：只能读取 is_public = 1 的资料，不能新增/修改/删除
//   - 所有列表按 updated_at DESC 排序
import { Hono } from 'hono'

const studyResources = new Hono()

const isAdmin = (user) => user?.role === 'admin'
const isTeacher = (user) => user?.role === 'teacher'
const isStudent = (user) => user?.role === 'student'
const canEdit = (user) => isAdmin(user) || isTeacher(user)

const safeJsonArray = (txt) => {
  if (!txt) return []
  try {
    const v = JSON.parse(txt)
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

// 序列化 DB 行 -> 前端对象
const serialize = (row) => ({
  id: row.id,
  title: row.title,
  content: row.content || '',
  category: row.category || '',
  tags: safeJsonArray(row.tags),
  is_public: row.is_public === 1 || row.is_public === true,
  resource_type: row.resource_type === 'link' ? 'link' : 'markdown',
  url: row.url || '',
  description: row.description || '',
  author_id: row.author_id || '',
  author_name: row.author_name || '',
  updated_by: row.updated_by || '',
  updated_by_name: row.updated_by_name || '',
  created_at: row.created_at,
  updated_at: row.updated_at,
})

// ─── GET / ── 列表查询 ────────────────────────────────────────────────────────
// query: search, category, is_public（仅老师/管理员可过滤）
studyResources.get('/', async (c) => {
  const user = c.get('user')
  const { search = '', category = '', is_public } = c.req.query()
  const db = c.env.DB

  let sql = 'SELECT * FROM study_resources WHERE 1=1'
  const params = []

  // 学生端强制只返回公开
  if (isStudent(user)) {
    sql += ' AND is_public = 1'
  } else if (is_public === '1' || is_public === '0') {
    sql += ' AND is_public = ?'
    params.push(is_public === '1' ? 1 : 0)
  }

  if (search) {
    sql += ' AND (title LIKE ? OR content LIKE ?)'
    const kw = `%${search}%`
    params.push(kw, kw)
  }
  if (category) {
    sql += ' AND category = ?'
    params.push(category)
  }

  sql += ' ORDER BY updated_at DESC, id DESC'

  const { results = [] } = await db.prepare(sql).bind(...params).all()
  return c.json({ success: true, data: results.map(serialize) })
})

// ─── GET /:id ── 详情 ─────────────────────────────────────────────────────────
studyResources.get('/:id', async (c) => {
  const user = c.get('user')
  const { id } = c.req.param()
  const db = c.env.DB

  const row = await db.prepare('SELECT * FROM study_resources WHERE id = ?').bind(id).first()
  if (!row) return c.json({ success: false, message: '资料不存在' }, 404)

  // 学生不能读取私密资料
  if (isStudent(user) && row.is_public !== 1) {
    return c.json({ success: false, message: '无权查看该资料' }, 403)
  }

  return c.json({ success: true, data: serialize(row) })
})

// ─── POST / ── 新建 ──────────────────────────────────────────────────────────
studyResources.post('/', async (c) => {
  const user = c.get('user')
  if (!canEdit(user)) return c.json({ success: false, message: '无权创建资料' }, 403)

  const body = await c.req.json().catch(() => ({}))
  const {
    title, content = '', category = '', tags = [], is_public = false,
    resource_type = 'markdown', url = '', description = '',
  } = body

  if (!title || !String(title).trim()) {
    return c.json({ success: false, message: '标题不能为空' }, 400)
  }

  const rType = resource_type === 'link' ? 'link' : 'markdown'
  if (rType === 'link') {
    const u = String(url || '').trim()
    if (!u) return c.json({ success: false, message: '链接类型资料必须提供 URL' }, 400)
    if (!/^https?:\/\//i.test(u)) {
      return c.json({ success: false, message: 'URL 必须以 http:// 或 https:// 开头' }, 400)
    }
  }

  const db = c.env.DB
  const authorId = String(user.id || '')
  const authorName = user.name || ''
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

  const result = await db.prepare(`
    INSERT INTO study_resources
      (title, content, category, tags, is_public, resource_type, url, description,
       author_id, author_name, updated_by, updated_by_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    String(title).trim(),
    rType === 'link' ? '' : String(content || ''),
    String(category || ''),
    JSON.stringify(Array.isArray(tags) ? tags : []),
    is_public ? 1 : 0,
    rType,
    rType === 'link' ? String(url).trim() : '',
    String(description || ''),
    authorId,
    authorName,
    authorId,
    authorName,
    now,
    now,
  ).run()

  const newId = result.meta?.last_row_id
  const row = newId
    ? await db.prepare('SELECT * FROM study_resources WHERE id = ?').bind(newId).first()
    : null
  return c.json({ success: true, message: '资料已创建', data: row ? serialize(row) : null }, 201)
})

// ─── PUT /:id ── 更新 ────────────────────────────────────────────────────────
studyResources.put('/:id', async (c) => {
  const user = c.get('user')
  if (!canEdit(user)) return c.json({ success: false, message: '无权修改资料' }, 403)

  const { id } = c.req.param()
  const db = c.env.DB

  const row = await db.prepare('SELECT * FROM study_resources WHERE id = ?').bind(id).first()
  if (!row) return c.json({ success: false, message: '资料不存在' }, 404)

  const body = await c.req.json().catch(() => ({}))
  const nextTitle = body.title !== undefined ? String(body.title).trim() : row.title
  if (!nextTitle) return c.json({ success: false, message: '标题不能为空' }, 400)

  const nextType = body.resource_type !== undefined
    ? (body.resource_type === 'link' ? 'link' : 'markdown')
    : (row.resource_type === 'link' ? 'link' : 'markdown')

  // URL 校验：link 类型必须有有效 URL
  let nextUrl = body.url !== undefined ? String(body.url || '').trim() : (row.url || '')
  if (nextType === 'link') {
    if (!nextUrl) return c.json({ success: false, message: '链接类型资料必须提供 URL' }, 400)
    if (!/^https?:\/\//i.test(nextUrl)) {
      return c.json({ success: false, message: 'URL 必须以 http:// 或 https:// 开头' }, 400)
    }
  } else {
    nextUrl = ''
  }

  const nextContent = nextType === 'link'
    ? ''
    : (body.content !== undefined ? String(body.content || '') : (row.content || ''))
  const nextCategory = body.category !== undefined ? String(body.category || '') : (row.category || '')
  const nextDescription = body.description !== undefined ? String(body.description || '') : (row.description || '')
  const nextTags = body.tags !== undefined
    ? JSON.stringify(Array.isArray(body.tags) ? body.tags : [])
    : (row.tags || '[]')
  const nextPublic = body.is_public !== undefined ? (body.is_public ? 1 : 0) : row.is_public
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

  await db.prepare(`
    UPDATE study_resources SET
      title = ?, content = ?, category = ?, tags = ?, is_public = ?,
      resource_type = ?, url = ?, description = ?,
      updated_by = ?, updated_by_name = ?, updated_at = ?
    WHERE id = ?
  `).bind(
    nextTitle, nextContent, nextCategory, nextTags, nextPublic,
    nextType, nextUrl, nextDescription,
    String(user.id || ''), user.name || '', now,
    id,
  ).run()

  const updated = await db.prepare('SELECT * FROM study_resources WHERE id = ?').bind(id).first()
  return c.json({ success: true, message: '资料已更新', data: serialize(updated) })
})

// ─── PATCH/PUT /:id/visibility ── 快速切换公开/私密 ──────────────────────────────
// 需求58：同时支持 PATCH 和 PUT（Pages CDN 默认预检不放 PATCH）
studyResources.on(['PATCH', 'PUT'], '/:id/visibility', async (c) => {
  const user = c.get('user')
  if (!canEdit(user)) return c.json({ success: false, message: '无权修改资料' }, 403)

  const { id } = c.req.param()
  const db = c.env.DB

  const row = await db.prepare('SELECT * FROM study_resources WHERE id = ?').bind(id).first()
  if (!row) return c.json({ success: false, message: '资料不存在' }, 404)

  const body = await c.req.json().catch(() => ({}))
  const nextPublic = body.is_public ? 1 : 0
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

  await db.prepare(`
    UPDATE study_resources SET is_public = ?, updated_by = ?, updated_by_name = ?, updated_at = ? WHERE id = ?
  `).bind(nextPublic, String(user.id || ''), user.name || '', now, id).run()

  const updated = await db.prepare('SELECT * FROM study_resources WHERE id = ?').bind(id).first()
  return c.json({ success: true, data: serialize(updated) })
})

// ─── DELETE /:id ── 删除 ─────────────────────────────────────────────────────
studyResources.delete('/:id', async (c) => {
  const user = c.get('user')
  if (!canEdit(user)) return c.json({ success: false, message: '无权删除资料' }, 403)

  const { id } = c.req.param()
  const db = c.env.DB

  const row = await db.prepare('SELECT id FROM study_resources WHERE id = ?').bind(id).first()
  if (!row) return c.json({ success: false, message: '资料不存在' }, 404)

  await db.prepare('DELETE FROM study_resources WHERE id = ?').bind(id).run()
  return c.json({ success: true, message: '资料已删除' })
})

export default studyResources

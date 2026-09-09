// API Key 管理路由（仅 admin）—— 【开放只读 API】
//
// admin 用现有 JWT 登录后管理供第三方系统使用的 API Key：
//   POST   /api/api-keys        签发新 key（明文只在响应里出现一次，之后只存哈希）
//   GET    /api/api-keys        列出全部 key（哈希截断展示，含启用状态/最近使用时间）
//   DELETE /api/api-keys/:id    吊销（软删：is_active = 0，保留审计记录）

import { Hono } from 'hono'
import { ensureApiKeysTable, sha256Hex, generateApiKey } from '../middleware/apiKey.js'

const apiKeys = new Hono()

// index.js 已挂 authMiddleware；这里统一再做 admin 角色判断
apiKeys.use('*', async (c, next) => {
  const user = c.get('user')
  if (user?.role !== 'admin') {
    return c.json({ success: false, message: '仅管理员可管理 API Key' }, 403)
  }
  await ensureApiKeysTable(c.env.DB)
  await next()
})

// 签发
apiKeys.post('/', async (c) => {
  const db = c.env.DB
  const body = await c.req.json().catch(() => ({}))
  const name = String(body?.name || '').trim()
  if (!name) {
    return c.json({ success: false, message: '请提供 key 的名称（如"排课系统"），便于识别与吊销' }, 400)
  }
  const note = String(body?.note || '').slice(0, 200)

  const plaintext = generateApiKey()
  const hash = await sha256Hex(plaintext)
  const result = await db.prepare(
    'INSERT INTO api_keys (key_hash, name, note) VALUES (?, ?, ?)'
  ).bind(hash, name, note).run()

  return c.json({
    success: true,
    message: 'API Key 已签发。明文只显示这一次，请立即保存；泄露时请立即吊销并重新签发。',
    data: {
      id: result.meta?.last_row_id,
      name,
      note,
      key: plaintext, // ⚠️ 唯一一次明文返回
    },
  }, 201)
})

// 列表
apiKeys.get('/', async (c) => {
  const db = c.env.DB
  const { results } = await db.prepare(`
    SELECT id, name, note, is_active, created_at, last_used_at,
           substr(key_hash, 1, 8) AS hash_prefix
    FROM api_keys ORDER BY id DESC
  `).all()
  return c.json({ success: true, data: results || [] })
})

// 吊销（软删，保留审计）
apiKeys.delete('/:id', async (c) => {
  const db = c.env.DB
  const { id } = c.req.param()
  const row = await db.prepare('SELECT id, is_active FROM api_keys WHERE id = ?').bind(id).first()
  if (!row) return c.json({ success: false, message: 'API Key 不存在' }, 404)
  await db.prepare('UPDATE api_keys SET is_active = 0 WHERE id = ?').bind(id).run()
  return c.json({ success: true, message: 'API Key 已吊销，立即生效' })
})

export default apiKeys

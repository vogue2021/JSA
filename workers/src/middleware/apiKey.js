// API Key 认证中间件 —— 【开放只读 API】
//
// 用途：供**另一个系统**实时调取生产数据（只读），不走前端用户的 JWT 登录态。
//
// 与 JWT 中间件的区别：
//   JWT 是给"人"用的（角色权限、按学生收窄）；
//   API Key 是给"系统"用的（长期有效、只读、按 key 可吊销）。
//
// 安全设计：
//   · 数据库只存 key 的 SHA-256 哈希，不落明文 —— 即使库被拖，key 也无法还原
//   · key 可随时吊销（is_active = 0）即时生效
//   · 仅签发在 /api/open/* 只读端点上使用，写接口一律不认

// ─── 自动迁移：确保 api_keys 表存在 ─────────────────────────────────────────
// 与 schools.js 的 ensureExtraDatesColumn 同款模式：同一 worker 实例只检查一次。
let _apiKeysEnsured = false
export async function ensureApiKeysTable(db) {
  if (_apiKeysEnsured) return
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key_hash TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        note TEXT DEFAULT '',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        last_used_at TEXT
      )
    `).run()
    _apiKeysEnsured = true
  } catch (err) {
    console.warn('[apiKey] ensureApiKeysTable 失败（下次请求重试）:', String(err && err.message || err))
  }
}

/** SHA-256 哈希（hex）。Workers 环境原生支持 crypto.subtle */
export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

/** 生成一个新 API Key 明文（仅在签发时返回一次，之后只存哈希） */
export function generateApiKey() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  const rand = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
  return `jsa_${rand}` // jsa_ 前缀便于识别与泄漏扫描
}

// ─── 中间件 ─────────────────────────────────────────────────────────────────
export async function apiKeyMiddleware(c, next) {
  const db = c.env.DB
  await ensureApiKeysTable(db)

  const key = c.req.header('X-API-Key') || ''
  if (!key) {
    return c.json({ success: false, message: '未提供 API Key（请在请求头携带 X-API-Key）' }, 401)
  }

  const hash = await sha256Hex(key)
  const row = await db.prepare(
    'SELECT id, name, is_active FROM api_keys WHERE key_hash = ?'
  ).bind(hash).first()

  if (!row) {
    return c.json({ success: false, message: 'API Key 无效' }, 401)
  }
  if (row.is_active !== 1) {
    return c.json({ success: false, message: 'API Key 已被吊销，请联系管理员' }, 403)
  }

  // 记录最近使用时间（不阻塞响应体也不影响鉴权结果）
  try {
    await db.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?").bind(row.id).run()
  } catch { /* 时间戳更新失败不影响本次调用 */ }

  c.set('apiKey', { id: row.id, name: row.name })
  await next()
}

// R2 对象存储 - 图片上传与读取（新需求77）
// 设计：
//   - POST /api/upload/image：表单 multipart 或原始二进制上传，鉴权后存到 R2，返回可访问 URL
//   - GET  /api/upload/r2/:key：以 Worker 代理方式读取 R2 私有对象（key 含路径如 messages/2026/05/abc.jpg）
//   - 上传仅允许 admin / 拥有 publish_messages 权限的老师 / 管理员
//   - 限制：单文件 ≤ 5MB；只接受 image/*
//
// 部署前置：wrangler.toml 需有 [[r2_buckets]] binding = "R2_UPLOADS"。
// 若未配置 R2 binding，POST 接口会返回明确错误，避免发布消息流程崩溃。
import { Hono } from 'hono'

const upload = new Hono()

const isAdmin = (u) => u?.role === 'admin'
const canUpload = (u) => {
  if (!u) return false
  if (isAdmin(u)) return true
  if (u.role === 'teacher') return Array.isArray(u.permissions) && u.permissions.includes('publish_messages')
  return false
}

// 简易 mime → 扩展名映射
const mimeExtMap = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
}

const buildKey = (mime, prefix = 'messages') => {
  const now = new Date()
  const yyyy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const ext = mimeExtMap[mime] || 'bin'
  // 16 字节随机
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  const rand = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  return `${prefix}/${yyyy}/${mm}/${rand}.${ext}`
}

// ─── POST /image ── 上传图片到 R2 ────────────────────────────────────────────
// 支持两种 Content-Type：
//   1) multipart/form-data，字段名 file（推荐）
//   2) 直接二进制，header 里通过 X-File-Type 指定 mime
upload.post('/image', async (c) => {
  const user = c.get('user')
  if (!canUpload(user)) return c.json({ success: false, message: '无权上传图片' }, 403)
  const r2 = c.env.R2_UPLOADS
  if (!r2) {
    return c.json({
      success: false,
      message: 'R2 对象存储尚未配置（R2_UPLOADS binding 缺失），请联系管理员在 wrangler.toml 中绑定 R2 bucket 后重新部署',
    }, 503)
  }

  const ct = c.req.header('content-type') || ''
  let fileBody = null
  let mime = ''
  let fileName = ''
  let size = 0

  try {
    if (ct.startsWith('multipart/form-data')) {
      const form = await c.req.formData()
      const file = form.get('file')
      if (!file || typeof file === 'string') {
        return c.json({ success: false, message: '请通过 file 字段上传图片' }, 400)
      }
      mime = file.type || 'application/octet-stream'
      fileName = file.name || ''
      size = file.size || 0
      fileBody = file
    } else {
      mime = c.req.header('x-file-type') || ct || 'application/octet-stream'
      const ab = await c.req.arrayBuffer()
      fileBody = ab
      size = ab.byteLength
    }
  } catch (e) {
    return c.json({ success: false, message: `读取上传内容失败：${e.message || e}` }, 400)
  }

  if (!mime.startsWith('image/')) {
    return c.json({ success: false, message: '仅支持 image/* 类型文件' }, 400)
  }
  const MAX = 5 * 1024 * 1024
  if (size > MAX) {
    return c.json({ success: false, message: `文件过大，上限 ${MAX / 1024 / 1024}MB` }, 413)
  }

  const key = buildKey(mime)
  try {
    await r2.put(key, fileBody, {
      httpMetadata: { contentType: mime },
      customMetadata: {
        uploadedBy: String(user.id || ''),
        uploadedByName: user.name || '',
        originalName: fileName,
      },
    })
  } catch (e) {
    return c.json({ success: false, message: `R2 写入失败：${e.message || e}` }, 500)
  }

  // 返回相对路径，让前端走 /api/upload/r2/:key 代理读图，避免依赖 R2 公网 URL 配置
  const url = `/api/upload/r2/${key}`
  return c.json({
    success: true,
    data: { key, url, size, mime },
  })
})

// ─── GET /r2/:* ── 代理读取 R2 对象（公开） ──────────────────────────────────
// 注意：路径参数允许 / 嵌套，如 messages/2026/05/abc.jpg
upload.get('/r2/*', async (c) => {
  const r2 = c.env.R2_UPLOADS
  if (!r2) return c.text('R2 not configured', 503)
  // 取出 :path 部分（去掉 /r2/ 前缀）
  const url = new URL(c.req.url)
  const path = url.pathname.replace(/^.*\/r2\//, '')
  if (!path) return c.text('Bad key', 400)

  const obj = await r2.get(path)
  if (!obj) return c.text('Not found', 404)
  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  headers.set('etag', obj.httpEtag)
  // 缓存 30 天 — 文件名是随机 hash，不会变
  headers.set('cache-control', 'public, max-age=2592000, immutable')
  return new Response(obj.body, { headers })
})

export default upload

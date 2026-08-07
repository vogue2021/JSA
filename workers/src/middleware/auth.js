// JWT 认证中间件
// 使用 jose 库（支持 Web Crypto API，兼容 Cloudflare Workers）
import { jwtVerify } from 'jose'

export async function authMiddleware(c, next) {
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.split(' ')[1]

  if (!token) {
    return c.json({ success: false, message: '未提供认证令牌' }, 401)
  }

  try {
    const secret = new TextEncoder().encode(
      c.env.JWT_SECRET || 'dev-jwt-secret-do-not-use-in-production'
    )
    const { payload } = await jwtVerify(token, secret)

    // 检查账号是否已被禁用/删除（每次 API 请求都实时查 DB）
    const db = c.env.DB
    if (db && payload.id) {
      const user = await db.prepare('SELECT is_active FROM users WHERE id = ?').bind(payload.id).first()
      // 【新需求105】原先只判断 `user && user.is_active === 0`，当 user 为 null
      //   （账号行已被管理员硬删）时会直接放行 → 被删账号的旧 JWT在过期前仍可调用全部接口，
      //   既是"删了还在"的表现来源，也是实实在在的越权风险。修复：查不到用户行即拒绝。
      if (!user) {
        return c.json({ success: false, message: '账号不存在或已被删除，请重新登录', code: 'ACCOUNT_DELETED' }, 401)
      }
      if (user.is_active === 0) {
        return c.json({ success: false, message: '账号已被禁用，请联系管理员', code: 'ACCOUNT_DISABLED' }, 403)
      }
    }
    // 【新需求69】当登录用户是老师时，从 teachers 表加载 permissions 放进 user 上下文，
    //   供下游路由进行细粒度权限判断（edit_events / edit_schools / edit_materials /
    //   view_all_students / edit_all_students 等）。
    //   未拉到时设为 null，路由侧自行兜底（不阻塞请求）。
    let permissions = null
    if (db && payload.role === 'teacher' && payload.teacherId) {
      try {
        const trow = await db.prepare('SELECT permissions FROM teachers WHERE teacher_id = ?').bind(payload.teacherId).first()
        if (trow && trow.permissions) {
          try { permissions = JSON.parse(trow.permissions) } catch { permissions = null }
        }
      } catch { /* 忽略，permissions 仍为 null */ }
    }

    c.set('user', { ...payload, permissions })
    await next()
  } catch (e) {
    return c.json({ success: false, message: '令牌无效或已过期' }, 401)
  }
}

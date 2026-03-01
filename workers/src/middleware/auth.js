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
    c.set('user', payload)
    await next()
  } catch (e) {
    return c.json({ success: false, message: '令牌无效或已过期' }, 403)
  }
}

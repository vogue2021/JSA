// JSA API - Cloudflare Workers 入口
// 使用 Hono.js 框架，替代 Express.js
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authMiddleware } from './middleware/auth.js'
import authRoutes from './routes/auth.js'
import studentRoutes from './routes/students.js'
import teacherRoutes from './routes/teachers.js'
import schoolRoutes from './routes/schools.js'
import eventRoutes from './routes/events.js'
import materialRoutes from './routes/materials.js'
import feedbackRoutes from './routes/feedback.js'
import schoolDatabaseRoutes from './routes/school_database.js'
import userRoutes from './routes/users.js'
import reminderRoutes from './routes/reminders.js'
import xuebangRoutes from './routes/xuebang.js'

const app = new Hono()

// ─── CORS 配置 ────────────────────────────────────────────────────────────────
app.use('*', cors({
  origin: (origin) => {
    // 允许 Pages 域名、本地开发和自定义域名
    const allowed = [
      'https://jsa-ac8.pages.dev',
      'https://jsa-staging.pages.dev',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:4173',
    ]
    if (!origin || allowed.includes(origin) || origin.endsWith('.pages.dev')) {
      return origin || '*'
    }
    return null
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,
}))

// ─── 健康检查 ─────────────────────────────────────────────────────────────────
app.get('/api/health', (c) => c.json({
  status: 'OK',
  timestamp: new Date().toISOString(),
  version: '1.0.0'
}))

// ─── 公开路由（无需 JWT）──────────────────────────────────────────────────────
app.route('/api/auth', authRoutes)

// ─── 受保护路由（需要 JWT）────────────────────────────────────────────────────
// 注意：feedback POST 在路由内部不强制鉴权（允许匿名提交），GET/PATCH 需要 admin
app.use('/api/students/*', authMiddleware)
app.use('/api/teachers/*', authMiddleware)
app.use('/api/schools/*', authMiddleware)
app.use('/api/events/*', authMiddleware)
app.use('/api/materials/*', authMiddleware)
app.use('/api/school-database/*', authMiddleware)
app.use('/api/school-database', authMiddleware)
app.use('/api/users/*', authMiddleware)
app.use('/api/users', authMiddleware)
app.use('/api/reminders/*', authMiddleware)
app.use('/api/reminders', authMiddleware)
app.use('/api/xuebang/*', authMiddleware)
app.use('/api/xuebang', authMiddleware)
// 注意：feedback 路由在内部自行处理鉴权（POST 允许匿名，GET/PATCH 需要 admin）
// 不在这里挂载 authMiddleware，避免 Hono 路径匹配问题

app.route('/api/students', studentRoutes)
app.route('/api/teachers', teacherRoutes)
app.route('/api/schools', schoolRoutes)
app.route('/api/events', eventRoutes)
app.route('/api/materials', materialRoutes)
app.route('/api/feedback', feedbackRoutes)
app.route('/api/school-database', schoolDatabaseRoutes)
app.route('/api/users', userRoutes)
app.route('/api/reminders', reminderRoutes)
app.route('/api/xuebang', xuebangRoutes)

// ─── 404 处理 ─────────────────────────────────────────────────────────────────
app.notFound((c) => c.json({ success: false, message: '接口不存在' }, 404))

// ─── 全局错误处理 ─────────────────────────────────────────────────────────────
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ success: false, message: '服务器内部错误' }, 500)
})

export default app

/**
 * 结构化日志中间件
 * 每个请求记录：requestId / userId / method / route / status / latency / ip
 * 审计日志：记录关键写操作（POST/PUT/PATCH/DELETE）到 audit_logs 表
 */
const { randomUUID } = require('crypto');
const db = require('../config/db');

// ─── 结构化请求日志 ────────────────────────────────────────────────────────────
const structuredLogger = (req, res, next) => {
  const requestId = randomUUID();
  const startTime = Date.now();

  // 将 requestId 挂载到 req，方便路由层使用
  req.requestId = requestId;

  // 响应结束后记录日志
  res.on('finish', () => {
    const latency = Date.now() - startTime;
    const userId = req.user?.id || null;
    const log = {
      requestId,
      timestamp: new Date().toISOString(),
      method: req.method,
      route: req.originalUrl,
      status: res.statusCode,
      latency,
      userId,
      ip: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'] || '',
    };

    // 生产环境输出 JSON，开发环境输出可读格式
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(log));
    } else if (process.env.NODE_ENV !== 'test') {
      const statusColor = res.statusCode >= 500 ? '\x1b[31m' : res.statusCode >= 400 ? '\x1b[33m' : '\x1b[32m';
      console.log(
        `${statusColor}[${log.timestamp}]\x1b[0m ${req.method} ${req.originalUrl} ` +
        `${statusColor}${res.statusCode}\x1b[0m ${latency}ms` +
        (userId ? ` uid=${userId}` : '') +
        ` rid=${requestId.slice(0, 8)}`
      );
    }
  });

  next();
};

// ─── 审计日志（写操作） ────────────────────────────────────────────────────────
// 记录关键写操作到数据库 audit_logs 表（如果表存在）
const AUDIT_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
// 不需要审计的路径前缀（如健康检查、静态资源）
const SKIP_AUDIT_PREFIXES = ['/api/health', '/uploads'];

const auditLogger = (req, res, next) => {
  if (!AUDIT_METHODS.has(req.method)) return next();
  if (SKIP_AUDIT_PREFIXES.some(p => req.originalUrl.startsWith(p))) return next();

  // 在响应结束后异步写入审计日志（不阻塞响应）
  res.on('finish', () => {
    // 只记录成功的写操作（2xx）
    if (res.statusCode < 200 || res.statusCode >= 300) return;

    const entry = {
      request_id: req.requestId || null,
      user_id: req.user?.id || null,
      user_name: req.user?.name || req.user?.email || null,
      user_role: req.user?.role || null,
      method: req.method,
      route: req.originalUrl,
      status: res.statusCode,
      ip: req.ip || req.headers['x-forwarded-for'] || null,
      // 记录请求体摘要（脱敏：移除密码字段）
      body_summary: sanitizeBody(req.body),
      created_at: new Date().toISOString(),
    };

    // 异步写入，失败不影响主流程
    db('audit_logs').insert(entry).catch(() => {
      // 表不存在时静默忽略（迁移未运行时的降级处理）
    });
  });

  next();
};

// 脱敏：移除敏感字段
function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return null;
  const SENSITIVE_KEYS = new Set(['password', 'newPassword', 'oldPassword', 'token', 'secret', 'code']);
  const sanitized = {};
  for (const [k, v] of Object.entries(body)) {
    sanitized[k] = SENSITIVE_KEYS.has(k) ? '[REDACTED]' : v;
  }
  // 限制长度，避免大 body 撑爆数据库
  const str = JSON.stringify(sanitized);
  return str.length > 1000 ? str.slice(0, 1000) + '...' : str;
}

module.exports = { structuredLogger, auditLogger };

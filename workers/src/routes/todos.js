// 待办聚合路由 - 【新需求109】
//
// 目的：给「每日待办」页面提供**一次请求拿到全部待办**的能力。
//
// 为什么必须新增接口而不是复用现有的：
//   events / materials 都只有 `GET /student/:studentId`（按单个学生查）。
//   学生端只查自己没问题，但老师端要看名下所有学生 ——
//   生产库有 134 名学生，前端逐个拉取 = 268 个请求，完全不可接受。
//   所以这里用一条带 IN 子句的 SQL 把范围内学生的数据一次查出来。
//
// 权限范围（与 events.js / schools.js 的既有口径保持一致，不另立规则）：
//   · student —— 只能看自己（忽略传入的任何范围参数）
//   · teacher —— 默认只看三身份（升学/学管/顾问）名下的学生；
//                拥有 view_all_students 权限时可看全部
//   · admin   —— 全部
//
// 注意：这里只做「数据获取 + 范围控制」，不做业务聚合与排序 ——
// 待办的合并/去重/紧急度判定统一交给前端 utils/todoAggregator.js，
// 避免同一套口径在前后端各写一份而逐渐漂移。

import { Hono } from 'hono'

const todos = new Hono()

const isAdmin = (user) => user?.role === 'admin'
const isTeacher = (user) => user?.role === 'teacher'
const isStudent = (user) => user?.role === 'student'

const teacherHas = (user, permId) =>
  Array.isArray(user?.permissions) && user.permissions.includes(permId)

// 【新需求105】user_id 有值但在 users 表里查不到 → 账号已删除的孤儿学生，不应计入
const ORPHAN_GUARD =
  " AND (user_id IS NULL OR user_id = '' OR user_id IN (SELECT id FROM users))"

/**
 * 解析当前用户可见的学生范围。
 * @returns {Promise<{students: object[], scope: string}>}
 */
async function resolveVisibleStudents(db, user) {
  if (isStudent(user)) {
    // 学生：只有自己。用 student_id 或 user_id 双条件兜底 ——
    // 【新需求105】遗留问题导致部分账号的 users.student_id 为空，
    // 此时 user.studentId 由登录时反查得出，这里再用 user_id 兜一层更稳。
    const { results } = await db.prepare(
      'SELECT student_id, name, teacher_id FROM students'
      + ' WHERE (student_id = ? OR user_id = ?) AND is_active = 1' + ORPHAN_GUARD
      + ' LIMIT 1'
    ).bind(user.studentId || '', user.id || '').all()
    return { students: results || [], scope: 'self' }
  }

  if (isAdmin(user) || (isTeacher(user) && teacherHas(user, 'view_all_students'))) {
    const { results } = await db.prepare(
      'SELECT student_id, name, teacher_id FROM students WHERE is_active = 1' + ORPHAN_GUARD
    ).all()
    return { students: results || [], scope: 'all' }
  }

  if (isTeacher(user)) {
    if (!user.teacherId) return { students: [], scope: 'none' }
    const { results } = await db.prepare(
      'SELECT student_id, name, teacher_id FROM students'
      + ' WHERE (teacher_id = ? OR academic_advisor_id = ? OR consultant_id = ?)'
      + ' AND is_active = 1' + ORPHAN_GUARD
    ).bind(user.teacherId, user.teacherId, user.teacherId).all()
    return { students: results || [], scope: 'mine' }
  }

  return { students: [], scope: 'none' }
}

/**
 * D1 对单条语句的绑定参数数量有限制，学生多时需要分批查询。
 * 每批 80 个占位符，134 名学生约 2 批，远优于逐个请求。
 *
 * @param {Function} buildSql (placeholders) => sql
 * @param {string[]} ids      学号列表
 * @param {Array} extraParams 追加的绑定参数（如日期窗口），拼在 ids 之后
 */
const BATCH_SIZE = 80

async function queryInBatches(db, buildSql, ids, extraParams = []) {
  const out = []
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const chunk = ids.slice(i, i + BATCH_SIZE)
    const placeholders = chunk.map(() => '?').join(',')
    const { results } = await db.prepare(buildSql(placeholders))
      .bind(...chunk, ...extraParams)
      .all()
    if (Array.isArray(results)) out.push(...results)
  }
  return out
}

// ─── 待办聚合：一次返回范围内所有学生的 事件 / 材料 / 学校 ─────────────────────
//
// 查询参数：
//   days   —— 只返回未来 N 天内（含逾期未完成）的数据，默认 60，最大 365。
//             收窄范围能显著减小响应体，前端「今天/本周/本月」视图足够用。
//   scope  —— 老师可传 'mine'（仅自己负责）强制收窄；不传则按权限取最大范围。
todos.get('/', async (c) => {
  const user = c.get('user')
  const db = c.env.DB

  const rawDays = Number(c.req.query('days'))
  const days = Number.isFinite(rawDays) ? Math.max(1, Math.min(rawDays, 365)) : 60
  const requestedScope = c.req.query('scope')

  let { students, scope } = await resolveVisibleStudents(db, user)

  // 老师主动要求只看自己负责的学生（前端提供的开关）
  if (requestedScope === 'mine' && isTeacher(user) && user.teacherId) {
    students = students.filter(s => s.teacher_id === user.teacherId)
    scope = 'mine'
  }

  if (students.length === 0) {
    return c.json({
      success: true,
      data: { scope, students: [], events: [], materials: [], schools: [], range: { days } },
    })
  }

  const ids = students.map(s => s.student_id)

  // 日期窗口：向前留 30 天用于展示"已逾期但未完成"的事项 ——
  // 逾期未做的事比未来的事更需要被看到，不能因为日期过了就从待办里消失。
  const today = new Date()
  const from = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10)
  const to = new Date(today.getTime() + days * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10)

  try {
    const [events, materials, schools] = await Promise.all([
      // 日期窗口一律走参数绑定，不做字符串内插 —— 即使这两个值由服务端生成，
      // 保持全项目"SQL 值只走 bind"的一致性，避免后续有人照抄成拼接用户输入。
      //
      // ⚠️ 这里**不能** SELECT deadline_type：
      //   events 表与 schools 表都没有这一列（已在两个库确认过建表语句）。
      //   【新需求88/90】的"出愿截止类型（消印有効/必着/当面受付）"实际是：
      //     · schools —— 存在 extra_dates JSON 里的 deadlineType 字段
      //     · events  —— 根本没落库，而是把类型拼在标题后缀里（"○○ 出愿截止（消印有効）"）
      //   所以类型信息统一由前端从 extra_dates 解包 / 从标题反向提取，与既有实现保持一致。
      queryInBatches(db, (ph) =>
        `SELECT id, student_id, type, title, date, category, urgent, notes, completed,
                school_id
         FROM events
         WHERE student_id IN (${ph}) AND date >= ? AND date <= ?`
        , ids, [from, to]),
      queryInBatches(db, (ph) =>
        `SELECT id, student_id, school_id, item, type, deadline, url, completed
         FROM materials
         WHERE student_id IN (${ph}) AND deadline IS NOT NULL AND deadline != ''
           AND deadline >= ? AND deadline <= ?`
        , ids, [from, to]),
      // 学校本身也带一批日期端（一审/二审/自定义日期未必都展开成了 events），
      // 前端会据此补齐 events 里缺失的日期项。
      // deadlineType 在 extra_dates 里，不是独立列。
      queryInBatches(db, (ph) =>
        `SELECT id, student_id, name, program, type, status,
                application_start_date, application_end_date,
                exam_date, result_date, extra_dates
         FROM schools WHERE student_id IN (${ph})`
        , ids),
    ])

    // extra_dates 是 JSON 文本，解析在这里做掉，前端拿到的就是结构化数据
    schools.forEach(s => {
      if (s.extra_dates) {
        try { s.extra_dates = JSON.parse(s.extra_dates) } catch { s.extra_dates = {} }
      } else {
        s.extra_dates = {}
      }
    })

    return c.json({
      success: true,
      data: {
        scope,
        students,
        events,
        materials,
        schools,
        range: { days, from, to },
      },
    })
  } catch (err) {
    console.error('[todos.GET] failed:', err)
    return c.json({ success: false, message: '待办数据加载失败：' + (err.message || String(err)) }, 500)
  }
})

export default todos

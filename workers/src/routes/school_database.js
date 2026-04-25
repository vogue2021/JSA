// 学校信息库路由 - Cloudflare Workers 版本
// 对应 D1 表：school_database
import { Hono } from 'hono'

const schoolDatabase = new Hono()

const isAdmin = (user) => user?.role === 'admin'
const isTeacher = (user) => user?.role === 'teacher'

// 将数据库行转换为前端格式（camelCase + JSON 解析）
function formatSchool(r) {
  if (!r) return null
  return {
    ...r,
    nameJa: r.name_ja || '',
    acceptanceRate: r.acceptance_rate || '',
    requirementsUrl: r.requirements_url || '',
    xuexinCert: r.xuexin_cert || '不确定',
    overseasCert: r.overseas_cert || '不确定',
    requirementsYear: r.requirements_year || '',
    requirementsUpdated: Boolean(r.requirements_updated),
    requirementsUpdatedAt: r.requirements_updated_at || '',
    programs: (() => { try { return JSON.parse(r.programs || '[]') } catch { return [] } })(),
    importantDates: (() => { try { return JSON.parse(r.important_dates || '[]') } catch { return [] } })(),
    requiredMaterials: (() => { try { return JSON.parse(r.required_materials || '[]') } catch { return [] } })(),
  }
}

// ─── 获取所有学校信息 ───────────────────────────────────────────────
schoolDatabase.get('/', async (c) => {
  const { type, search } = c.req.query()
  const db = c.env.DB

  let sql = 'SELECT * FROM school_database WHERE 1=1'
  const params = []

  if (type && type !== 'all') {
    sql += ' AND type = ?'
    params.push(type)
  }
  if (search) {
    sql += ' AND (name LIKE ? OR name_ja LIKE ? OR location LIKE ?)'
    params.push(`%${search}%`, `%${search}%`, `%${search}%`)
  }
  sql += ' ORDER BY ranking ASC, name ASC'

  const { results } = await db.prepare(sql).bind(...params).all()

  const data = results.map(formatSchool)

  return c.json({ success: true, data })
})
// ─── 获取单个学校信息 ─────────────────────────────────────────────────────────
schoolDatabase.get('/:id', async (c) => {
  const { id } = c.req.param()
  const db = c.env.DB

  const school = await db.prepare('SELECT * FROM school_database WHERE id = ?').bind(id).first()
  if (!school) return c.json({ success: false, message: '学校不存在' }, 404)

  // 统一使用 formatSchool 转为 camelCase
  const data = formatSchool(school)

  return c.json({ success: true, data })
})

// ─── 添加学校信息 ─────────────────────────────────────────────────────────────
schoolDatabase.post('/', async (c) => {
  const user = c.get('user')
  if (!isAdmin(user) && !isTeacher(user)) {
    return c.json({ success: false, message: '权限不足' }, 403)
  }

  const body = await c.req.json()
  if (!body.name || !body.type) {
    return c.json({ success: false, message: '学校名称和类型为必填' }, 400)
  }

  const db = c.env.DB
  await db.prepare(`
    INSERT INTO school_database (name, name_ja, type, location, programs, requirements, notes,
      acceptance_rate, difficulty, ranking, xuexin_cert, overseas_cert, important_dates, requirements_url, required_materials,
      requirements_year, requirements_updated, requirements_updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    body.name, body.nameJa || body.name_ja || '',
    body.type, body.location || '',
    JSON.stringify(body.programs || []),
    body.requirements || '', body.notes || '',
    body.acceptanceRate || body.acceptance_rate || '',
    body.difficulty || '', body.ranking || 0,
    body.xuexinCert || body.xuexin_cert || '不确定',
    body.overseasCert || body.overseas_cert || '不确定',
    JSON.stringify(body.importantDates || body.important_dates || []),
    body.requirementsUrl || body.requirements_url || '',
    JSON.stringify(body.requiredMaterials || body.required_materials || []),
    body.requirementsYear || body.requirements_year || '',
    (body.requirementsUpdated || body.requirements_updated) ? 1 : 0,
    body.requirementsUpdatedAt || body.requirements_updated_at || ''
  ).run()

  const newSchool = await db.prepare(
    'SELECT * FROM school_database ORDER BY id DESC LIMIT 1'
  ).first()

  return c.json({ success: true, message: '学校信息已添加', data: formatSchool(newSchool) }, 201)
})

// ─── 更新学校信息 ─────────────────────────────────────────────────────────────
schoolDatabase.put('/:id', async (c) => {
  const user = c.get('user')
  if (!isAdmin(user) && !isTeacher(user)) {
    return c.json({ success: false, message: '权限不足' }, 403)
  }

  const { id } = c.req.param()
  const db = c.env.DB

  try {
    const existing = await db.prepare('SELECT * FROM school_database WHERE id = ?').bind(id).first()
    if (!existing) return c.json({ success: false, message: '学校不存在' }, 404)

    const body = await c.req.json()

    // 安全归一化：确保所有 bind 参数都是 D1 允许的标量（string/number/null），
    // 不出现 undefined / boolean / object / NaN（这些会导致 D1 bind 抛错 → 500）
    const safeStr = (v, fallback = '') => {
      if (v === undefined || v === null) return fallback
      if (typeof v === 'string') return v
      if (typeof v === 'number' && Number.isFinite(v)) return String(v)
      if (typeof v === 'boolean') return v ? '1' : ''
      return String(v)
    }
    const safeInt = (v, fallback = 0) => {
      if (v === undefined || v === null || v === '') return fallback
      const n = typeof v === 'number' ? v : parseInt(v, 10)
      return Number.isFinite(n) ? n : fallback
    }
    const safeJson = (v, existingRaw) => {
      try {
        if (v !== undefined && v !== null) return JSON.stringify(Array.isArray(v) ? v : [])
        // fallback 用 existing 原始 JSON 字符串
        if (typeof existingRaw === 'string' && existingRaw) return existingRaw
        return '[]'
      } catch {
        return '[]'
      }
    }
    const pickStr = (a, b, existingVal, fallback = '') => {
      if (a !== undefined && a !== null && a !== '') return safeStr(a, fallback)
      if (b !== undefined && b !== null && b !== '') return safeStr(b, fallback)
      return safeStr(existingVal, fallback)
    }

    const params = [
      safeStr(body.name, existing.name),                                                   // 1 name
      pickStr(body.nameJa, body.name_ja, existing.name_ja, ''),                            // 2 name_ja
      safeStr(body.type, existing.type),                                                   // 3 type
      body.location !== undefined ? safeStr(body.location) : safeStr(existing.location),   // 4 location
      safeJson(body.programs, existing.programs),                                          // 5 programs
      body.requirements !== undefined ? safeStr(body.requirements) : safeStr(existing.requirements), // 6
      body.notes !== undefined ? safeStr(body.notes) : safeStr(existing.notes),            // 7 notes
      pickStr(body.acceptanceRate, body.acceptance_rate, existing.acceptance_rate, ''),    // 8
      body.difficulty !== undefined ? safeStr(body.difficulty) : safeStr(existing.difficulty), // 9
      safeInt(body.ranking !== undefined ? body.ranking : existing.ranking, 0),            // 10 ranking (INTEGER)
      pickStr(body.xuexinCert, body.xuexin_cert, existing.xuexin_cert, '不确定'),          // 11
      pickStr(body.overseasCert, body.overseas_cert, existing.overseas_cert, '不确定'),    // 12
      safeJson(body.importantDates !== undefined ? body.importantDates : body.important_dates, existing.important_dates), // 13
      pickStr(body.requirementsUrl, body.requirements_url, existing.requirements_url, ''), // 14
      safeJson(body.requiredMaterials !== undefined ? body.requiredMaterials : body.required_materials, existing.required_materials), // 15
      (() => {                                                                              // 16 requirements_year
        if (body.requirementsYear !== undefined) return safeStr(body.requirementsYear)
        if (body.requirements_year !== undefined) return safeStr(body.requirements_year)
        return safeStr(existing.requirements_year)
      })(),
      (() => {                                                                              // 17 requirements_updated (INTEGER 0/1)
        if (body.requirementsUpdated !== undefined) return body.requirementsUpdated ? 1 : 0
        if (body.requirements_updated !== undefined) return body.requirements_updated ? 1 : 0
        return safeInt(existing.requirements_updated, 0) ? 1 : 0
      })(),
      (() => {                                                                              // 18 requirements_updated_at
        if (body.requirementsUpdatedAt !== undefined) return safeStr(body.requirementsUpdatedAt)
        if (body.requirements_updated_at !== undefined) return safeStr(body.requirements_updated_at)
        return safeStr(existing.requirements_updated_at)
      })(),
      id,                                                                                   // 19 WHERE id
    ]

    await db.prepare(`
      UPDATE school_database SET
        name = ?, name_ja = ?, type = ?, location = ?, programs = ?, requirements = ?, notes = ?,
        acceptance_rate = ?, difficulty = ?, ranking = ?, xuexin_cert = ?, overseas_cert = ?,
        important_dates = ?, requirements_url = ?, required_materials = ?,
        requirements_year = ?, requirements_updated = ?, requirements_updated_at = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).bind(...params).run()

    const updated = await db.prepare('SELECT * FROM school_database WHERE id = ?').bind(id).first()

    return c.json({ success: true, message: '学校信息已更新', data: formatSchool(updated) })
  } catch (err) {
    // 关键：把真实错误返回给前端，便于定位（500 根源）
    const msg = err && (err.message || err.toString()) || '未知错误'
    const stack = err && err.stack ? String(err.stack).slice(0, 500) : ''
    console.error('[school-database PUT] error:', msg, stack)
    return c.json({ success: false, message: `服务器错误：${msg}`, stack }, 500)
  }
})

// ─── 删除学校信息 ─────────────────────────────────────────────────────────────
schoolDatabase.delete('/:id', async (c) => {
  const user = c.get('user')
  if (!isAdmin(user) && !isTeacher(user)) {
    return c.json({ success: false, message: '权限不足' }, 403)
  }

  const { id } = c.req.param()
  const db = c.env.DB

  const existing = await db.prepare('SELECT id FROM school_database WHERE id = ?').bind(id).first()
  if (!existing) return c.json({ success: false, message: '学校不存在' }, 404)

  await db.prepare('DELETE FROM school_database WHERE id = ?').bind(id).run()
  return c.json({ success: true, message: '学校信息已删除' })
})

// ─── 批量导入 ─────────────────────────────────────────────────────────────────
schoolDatabase.post('/batch', async (c) => {
  const user = c.get('user')
  if (!isAdmin(user) && !isTeacher(user)) {
    return c.json({ success: false, message: '权限不足' }, 403)
  }

  const { schools } = await c.req.json()
  if (!Array.isArray(schools) || schools.length === 0) {
    return c.json({ success: false, message: '请提供学校数组' }, 400)
  }

  const db = c.env.DB
  const results = { success: [], failed: [] }

  for (let i = 0; i < schools.length; i++) {
    const s = schools[i]
    if (!s.name) {
      results.failed.push({ index: i, name: s.name || '(空)', error: '学校名称为必填' })
      continue
    }
    try {
      await db.prepare(`
        INSERT INTO school_database (name, name_ja, type, location, programs, requirements, notes,
          acceptance_rate, difficulty, ranking, xuexin_cert, overseas_cert, important_dates, requirements_url, required_materials,
          requirements_year, requirements_updated, requirements_updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        s.name, s.nameJa || s.name_ja || '',
        s.type || '私立', s.location || '',
        JSON.stringify(s.programs || []),
        s.requirements || '', s.notes || '',
        s.acceptanceRate || s.acceptance_rate || '',
        s.difficulty || '', s.ranking || 0,
        s.xuexinCert || s.xuexin_cert || '不确定',
        s.overseasCert || s.overseas_cert || '不确定',
        JSON.stringify(s.importantDates || s.important_dates || []),
        s.requirementsUrl || s.requirements_url || '',
        JSON.stringify(s.requiredMaterials || s.required_materials || []),
        s.requirementsYear || s.requirements_year || '',
        (s.requirementsUpdated || s.requirements_updated) ? 1 : 0,
        s.requirementsUpdatedAt || s.requirements_updated_at || ''
      ).run()
      results.success.push({ index: i, name: s.name })
    } catch (err) {
      results.failed.push({ index: i, name: s.name, error: err.message || '写入失败' })
    }
  }

  const imported = results.success.length
  return c.json({
    success: true,
    message: `成功导入 ${imported} 所学校${results.failed.length > 0 ? `，${results.failed.length} 条失败` : ''}`,
    count: imported,
    total: schools.length,
    failed: results.failed
  })
})

export default schoolDatabase
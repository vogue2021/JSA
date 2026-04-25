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

  const existing = await db.prepare('SELECT * FROM school_database WHERE id = ?').bind(id).first()
  if (!existing) return c.json({ success: false, message: '学校不存在' }, 404)

  const body = await c.req.json()
  await db.prepare(`
    UPDATE school_database SET
      name = ?, name_ja = ?, type = ?, location = ?, programs = ?, requirements = ?, notes = ?,
      acceptance_rate = ?, difficulty = ?, ranking = ?, xuexin_cert = ?, overseas_cert = ?,
      important_dates = ?, requirements_url = ?, required_materials = ?,
      requirements_year = ?, requirements_updated = ?, requirements_updated_at = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).bind(
    body.name || existing.name,
    body.nameJa || body.name_ja || existing.name_ja || '',
    body.type || existing.type,
    body.location !== undefined ? body.location : (existing.location || ''),
    JSON.stringify(body.programs || (() => { try { return JSON.parse(existing.programs || '[]') } catch { return [] } })()),
    body.requirements !== undefined ? body.requirements : (existing.requirements || ''),
    body.notes !== undefined ? body.notes : (existing.notes || ''),
    body.acceptanceRate || body.acceptance_rate || existing.acceptance_rate || '',
    body.difficulty !== undefined ? body.difficulty : (existing.difficulty || ''),
    body.ranking !== undefined ? body.ranking : (existing.ranking || 0),
    body.xuexinCert || body.xuexin_cert || existing.xuexin_cert || '不确定',
    body.overseasCert || body.overseas_cert || existing.overseas_cert || '不确定',
    JSON.stringify(body.importantDates || body.important_dates || (() => { try { return JSON.parse(existing.important_dates || '[]') } catch { return [] } })()),
    body.requirementsUrl || body.requirements_url || existing.requirements_url || '',
    JSON.stringify(body.requiredMaterials || body.required_materials || (() => { try { return JSON.parse(existing.required_materials || '[]') } catch { return [] } })()),
    body.requirementsYear !== undefined ? body.requirementsYear : (body.requirements_year !== undefined ? body.requirements_year : (existing.requirements_year || '')),
    (body.requirementsUpdated !== undefined || body.requirements_updated !== undefined)
      ? ((body.requirementsUpdated ?? body.requirements_updated) ? 1 : 0)
      : (existing.requirements_updated || 0),
    body.requirementsUpdatedAt !== undefined ? body.requirementsUpdatedAt : (body.requirements_updated_at !== undefined ? body.requirements_updated_at : (existing.requirements_updated_at || '')),
    id
  ).run()

  const updated = await db.prepare('SELECT * FROM school_database WHERE id = ?').bind(id).first()

  return c.json({ success: true, message: '学校信息已更新', data: formatSchool(updated) })
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
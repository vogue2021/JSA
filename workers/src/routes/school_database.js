// 学校信息库路由 - Cloudflare Workers 版本
// 对应 D1 表：school_database
import { Hono } from 'hono'

const schoolDatabase = new Hono()

const isAdmin = (user) => user?.role === 'admin'
const isTeacher = (user) => user?.role === 'teacher'

// ─── 获取所有学校信息 ─────────────────────────────────────────────────────────
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

  // 解析 JSON 字段
  const data = results.map(r => ({
    ...r,
    programs: (() => { try { return JSON.parse(r.programs || '[]') } catch { return [] } })(),
    importantDates: (() => { try { return JSON.parse(r.important_dates || '[]') } catch { return [] } })(),
  }))

  return c.json({ success: true, data })
})

// ─── 获取单个学校信息 ─────────────────────────────────────────────────────────
schoolDatabase.get('/:id', async (c) => {
  const { id } = c.req.param()
  const db = c.env.DB

  const school = await db.prepare('SELECT * FROM school_database WHERE id = ?').bind(id).first()
  if (!school) return c.json({ success: false, message: '学校不存在' }, 404)

  school.programs = (() => { try { return JSON.parse(school.programs || '[]') } catch { return [] } })()
  school.importantDates = (() => { try { return JSON.parse(school.important_dates || '[]') } catch { return [] } })()

  return c.json({ success: true, data: school })
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
      acceptance_rate, difficulty, ranking, xuexin_cert, overseas_cert, important_dates, requirements_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    body.requirementsUrl || body.requirements_url || ''
  ).run()

  const newSchool = await db.prepare(
    'SELECT * FROM school_database ORDER BY id DESC LIMIT 1'
  ).first()

  if (newSchool) {
    newSchool.programs = (() => { try { return JSON.parse(newSchool.programs || '[]') } catch { return [] } })()
    newSchool.importantDates = (() => { try { return JSON.parse(newSchool.important_dates || '[]') } catch { return [] } })()
  }

  return c.json({ success: true, message: '学校信息已添加', data: newSchool }, 201)
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
      important_dates = ?, requirements_url = ?, updated_at = datetime('now')
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
    id
  ).run()

  const updated = await db.prepare('SELECT * FROM school_database WHERE id = ?').bind(id).first()
  if (updated) {
    updated.programs = (() => { try { return JSON.parse(updated.programs || '[]') } catch { return [] } })()
    updated.importantDates = (() => { try { return JSON.parse(updated.important_dates || '[]') } catch { return [] } })()
  }

  return c.json({ success: true, message: '学校信息已更新', data: updated })
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
          acceptance_rate, difficulty, ranking, xuexin_cert, overseas_cert, important_dates, requirements_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        s.requirementsUrl || s.requirements_url || ''
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
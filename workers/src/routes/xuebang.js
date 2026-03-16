// 学邦数据同步路由 - Cloudflare Workers 版本
// 从学邦系统 API 获取学生数据，同步到 JSA 的 students/users 表
import { Hono } from 'hono'

const xuebang = new Hono()

const isAdmin = (user) => user?.role === 'admin'

// 学邦 API 基础地址（通过环境变量配置）
const XUEBANG_API_BASE = 'https://openapi.xuebangsoft.net'

// ─── 获取学邦配置状态 ──────────────────────────────────────────────────────────
xuebang.get('/config', async (c) => {
  const user = c.get('user')
  if (!isAdmin(user)) return c.json({ success: false, message: '仅管理员可操作' }, 403)

  const db = c.env.DB
  const xbToken = c.env.XUEBANG_TOKEN || ''

  // 查询上次同步时间
  const lastSync = await db.prepare(
    'SELECT * FROM xuebang_sync_logs ORDER BY synced_at DESC LIMIT 1'
  ).first().catch(() => null)

  return c.json({
    success: true,
    data: {
      configured: !!xbToken,
      lastSyncTime: lastSync?.synced_at || null,
      lastSyncResult: lastSync?.result || null,
      lastSyncCount: lastSync?.synced_count || 0,
    }
  })
})

// ─── 预览学邦学生数据（不执行同步）──────────────────────────────────────────
xuebang.get('/preview', async (c) => {
  const user = c.get('user')
  if (!isAdmin(user)) return c.json({ success: false, message: '仅管理员可操作' }, 403)

  const xbToken = c.env.XUEBANG_TOKEN
  if (!xbToken) {
    return c.json({ success: false, message: '未配置学邦 Token，请在 Workers Secrets 中设置 XUEBANG_TOKEN' }, 400)
  }

  try {
    // 调用学邦 API 获取有效学员列表
    const xbStudents = await fetchXuebangStudents(xbToken, { stuStatus: 1 })

    // 查询 JSA 中已有的学邦关联记录
    const db = c.env.DB
    const { results: existingStudents } = await db.prepare(
      'SELECT student_id, xuebang_id, name FROM students WHERE xuebang_id IS NOT NULL AND xuebang_id != \'\''
    ).all()
    const existingXbIds = new Set(existingStudents.map(s => String(s.xuebang_id)))

    // 分类：新增 / 已存在
    const newStudents = []
    const existingMatches = []

    for (const xb of xbStudents) {
      const xbId = String(xb.studentId)
      if (existingXbIds.has(xbId)) {
        const matched = existingStudents.find(s => String(s.xuebang_id) === xbId)
        existingMatches.push({
          xuebangId: xbId,
          xuebangName: xb.name,
          jsaStudentId: matched?.student_id,
          jsaName: matched?.name,
          studentNo: xb.studentNo || '',
        })
      } else {
        newStudents.push({
          xuebangId: xbId,
          name: xb.name,
          studentNo: xb.studentNo || '',
          contact: xb.contact || '',
          birthday: xb.birthday || '',
          sex: xb.sex,
          gradeName: xb.gradeName || '',
          statusName: xb.statusCommonName || '',
          contractType: xb.studentContractType || '',
          campusName: xb.blCampusName || '',
          remark: xb.remark || '',
        })
      }
    }

    return c.json({
      success: true,
      data: {
        total: xbStudents.length,
        newCount: newStudents.length,
        existingCount: existingMatches.length,
        newStudents,
        existingMatches,
      }
    })
  } catch (error) {
    console.error('学邦预览失败:', error)
    return c.json({ success: false, message: '获取学邦数据失败: ' + error.message }, 500)
  }
})

// ─── 执行同步（将学邦学生导入 JSA）─────────────────────────────────────────
xuebang.post('/sync', async (c) => {
  const user = c.get('user')
  if (!isAdmin(user)) return c.json({ success: false, message: '仅管理员可操作' }, 403)

  const xbToken = c.env.XUEBANG_TOKEN
  if (!xbToken) {
    return c.json({ success: false, message: '未配置学邦 Token' }, 400)
  }

  const body = await c.req.json().catch(() => ({}))
  const { selectedIds, defaultTeacherId, defaultPassword } = body
  // selectedIds: 要同步的学邦学生 ID 列表（可选，不传则同步所有新增）
  // defaultTeacherId: 分配的默认老师（可选）
  // defaultPassword: 默认密码前缀（可选，默认用学号作密码）

  const db = c.env.DB

  try {
    // 1. 获取学邦学生数据
    const xbStudents = await fetchXuebangStudents(xbToken, { stuStatus: 1 })

    // 2. 查询已存在的关联
    const { results: existingStudents } = await db.prepare(
      'SELECT student_id, xuebang_id FROM students WHERE xuebang_id IS NOT NULL AND xuebang_id != \'\''
    ).all()
    const existingXbIds = new Set(existingStudents.map(s => String(s.xuebang_id)))

    // 3. 筛选需要同步的新学生
    let toSync = xbStudents.filter(xb => !existingXbIds.has(String(xb.studentId)))

    // 如果指定了 selectedIds，只同步选中的
    if (selectedIds && Array.isArray(selectedIds) && selectedIds.length > 0) {
      const selectedSet = new Set(selectedIds.map(String))
      toSync = toSync.filter(xb => selectedSet.has(String(xb.studentId)))
    }

    if (toSync.length === 0) {
      // 记录同步日志
      await logSync(db, user.id, 0, 'success', '没有需要同步的新学生')
      return c.json({ success: true, message: '没有需要同步的新学生', data: { syncedCount: 0 } })
    }

    // 4. 批量创建学生记录
    let syncedCount = 0
    const errors = []
    const passwordPrefix = defaultPassword || 'jsa'

    for (const xb of toSync) {
      try {
        // 用学邦学号作为 JSA 的 student_id
        const studentId = xb.studentNo || `XB${xb.studentId}`
        const studentName = xb.name || '未命名'

        // 检查 student_id 是否已存在（防止学号冲突）
        const existing = await db.prepare(
          'SELECT student_id FROM students WHERE student_id = ?'
        ).bind(studentId).first()

        if (existing) {
          // student_id 冲突，跳过但更新 xuebang_id 关联
          await db.prepare(
            "UPDATE students SET xuebang_id = ?, updated_at = datetime('now') WHERE student_id = ?"
          ).bind(String(xb.studentId), studentId).run()
          syncedCount++
          continue
        }

        // 创建 students 表记录
        await db.prepare(
          `INSERT INTO students (student_id, name, email, teacher_id, birthday, phone, xuebang_id, has_account, is_active, tags, eju_scores, follow_up_notes, jlpt_scores, english_scores)
           VALUES (?, ?, '', ?, ?, ?, ?, 0, 1, '[]', '[]', '[]', '[]', '[]')`
        ).bind(
          studentId,
          studentName,
          defaultTeacherId || '',
          xb.birthday || '',
          xb.contact || '',
          String(xb.studentId)
        ).run()

        syncedCount++
      } catch (err) {
        console.error(`同步学生 ${xb.name}(${xb.studentId}) 失败:`, err)
        errors.push({ xuebangId: xb.studentId, name: xb.name, error: err.message })
      }
    }

    // 5. 记录同步日志
    const result = errors.length > 0 ? 'partial' : 'success'
    const message = `成功同步 ${syncedCount} 名学生${errors.length > 0 ? `，${errors.length} 名失败` : ''}`
    await logSync(db, user.id, syncedCount, result, message)

    return c.json({
      success: true,
      message,
      data: {
        syncedCount,
        errorCount: errors.length,
        errors: errors.slice(0, 10), // 最多返回10条错误
      }
    })
  } catch (error) {
    console.error('学邦同步失败:', error)
    await logSync(db, user.id, 0, 'error', error.message).catch(() => {})
    return c.json({ success: false, message: '同步失败: ' + error.message }, 500)
  }
})

// ─── 获取同步历史 ────────────────────────────────────────────────────────────
xuebang.get('/sync-logs', async (c) => {
  const user = c.get('user')
  if (!isAdmin(user)) return c.json({ success: false, message: '仅管理员可操作' }, 403)

  const db = c.env.DB
  const { results } = await db.prepare(
    'SELECT * FROM xuebang_sync_logs ORDER BY synced_at DESC LIMIT 20'
  ).all()

  return c.json({ success: true, data: results })
})

// ─── 更新已关联学生的信息（从学邦拉取最新数据覆盖）──────────────────────────
xuebang.post('/refresh', async (c) => {
  const user = c.get('user')
  if (!isAdmin(user)) return c.json({ success: false, message: '仅管理员可操作' }, 403)

  const xbToken = c.env.XUEBANG_TOKEN
  if (!xbToken) {
    return c.json({ success: false, message: '未配置学邦 Token' }, 400)
  }

  const db = c.env.DB

  try {
    // 获取所有有 xuebang_id 的学生
    const { results: linkedStudents } = await db.prepare(
      'SELECT student_id, xuebang_id, name FROM students WHERE xuebang_id IS NOT NULL AND xuebang_id != \'\''
    ).all()

    if (linkedStudents.length === 0) {
      return c.json({ success: true, message: '没有已关联的学邦学生', data: { updatedCount: 0 } })
    }

    // 获取学邦全部学生
    const xbStudents = await fetchXuebangStudents(xbToken, {})
    const xbMap = {}
    xbStudents.forEach(xb => { xbMap[String(xb.studentId)] = xb })

    let updatedCount = 0
    for (const linked of linkedStudents) {
      const xb = xbMap[String(linked.xuebang_id)]
      if (!xb) continue

      // 更新名字、电话、生日等基础信息
      const updates = []
      const params = []

      if (xb.name && xb.name !== linked.name) {
        updates.push('name = ?')
        params.push(xb.name)
      }
      if (xb.contact) {
        updates.push('phone = ?')
        params.push(xb.contact)
      }
      if (xb.birthday) {
        updates.push('birthday = ?')
        params.push(xb.birthday)
      }

      if (updates.length > 0) {
        updates.push("updated_at = datetime('now')")
        params.push(linked.student_id)
        await db.prepare(
          `UPDATE students SET ${updates.join(', ')} WHERE student_id = ?`
        ).bind(...params).run()
        updatedCount++
      }
    }

    return c.json({
      success: true,
      message: `已更新 ${updatedCount} 名学生的信息`,
      data: { updatedCount, totalLinked: linkedStudents.length }
    })
  } catch (error) {
    console.error('学邦刷新失败:', error)
    return c.json({ success: false, message: '刷新失败: ' + error.message }, 500)
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════════════════════

// 调用学邦 API 获取学生列表（支持分页自动遍历）
async function fetchXuebangStudents(token, params = {}) {
  const allStudents = []
  let pageNo = 0
  const pageSize = 50

  while (true) {
    const url = new URL(`${XUEBANG_API_BASE}/api/student/findStudentsByInstitution`)
    url.searchParams.set('pageNo', pageNo)
    url.searchParams.set('pageSize', pageSize)

    // 添加额外查询参数
    if (params.stuStatus !== undefined) url.searchParams.set('stuStatus', params.stuStatus)
    if (params.studentContractType) url.searchParams.set('studentContractType', params.studentContractType)
    if (params.createTimeBegin) url.searchParams.set('createTimeBegin', params.createTimeBegin)
    if (params.createTimeEnd) url.searchParams.set('createTimeEnd', params.createTimeEnd)

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-XB-JWT': token,
        'Accept': 'application/json',
      }
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`学邦 API 请求失败: HTTP ${response.status} - ${errorText}`)
    }

    const result = await response.json()

    // 学邦 API 返回格式: { resultCode: 0, data: [...], ... }
    if (result.resultCode !== 0) {
      throw new Error(`学邦 API 返回错误: ${result.resultMessage || '未知错误'}`)
    }

    const students = result.data || []
    if (students.length === 0) break

    allStudents.push(...students)

    // 如果返回数量少于 pageSize，说明已是最后一页
    if (students.length < pageSize) break
    pageNo++

    // 安全限制：最多获取 2000 条
    if (allStudents.length >= 2000) break
  }

  return allStudents
}

// 记录同步日志
async function logSync(db, userId, syncedCount, result, message) {
  await db.prepare(
    `INSERT INTO xuebang_sync_logs (user_id, synced_count, result, message, synced_at)
     VALUES (?, ?, ?, ?, datetime('now'))`
  ).bind(userId, syncedCount, result, message).run()
}

export default xuebang

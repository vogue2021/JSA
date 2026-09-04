//【新需求111 第2项】材料准备截止日的默认推算（Workers 侧）
//
// ⚠️ 本文件与 src/utils/materialDeadline.js 是**同一套口径的两份实现**。
//    前端构建产物与 Workers 运行时无法共享模块，只能各存一份；
//    改动任何一处都必须同步另一处。两边各有测试锁定，且用例刻意保持一致，便于交叉核对。
//
// 规则：材料未手填截止日时，默认取「出愿截止前 2 周」，并做两次夹逼：
//   base   = 出愿截止 − 14 天
//   result = min(出愿截止, max(base, 今天))
// 详细理由见前端同名文件的注释。
//
// 为什么后端也必须有：真正写 materials 表的是这里（POST/PUT /api/schools），
// 前端只负责本地 checklist 的即时展示。仅改前端会让库里仍然写着出愿截止当天。

export const MATERIAL_LEAD_DAYS = 14

/**
 * 归一为 YYYY-MM-DD。线上存在区间格式（"2026-09-11~2026-10-10"），取起始日 ——
 * 对"截止"语义而言取起始日更保守。无法解析返回 ''。
 */
export function normalizeDay(value) {
  if (!value) return ''
  const s = String(value).trim()
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s)
  if (!m) return ''
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return ''
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return ''
  return `${m[1]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * 今天（YYYY-MM-DD）。
 *
 * ⚠️ Workers 运行时的本地时区就是 UTC，这里与前端的"本地时区今天"会有最多一天的偏差。
 *    影响面：仅在「距出愿截止不足两周」这一分支上，可能与前端预览差一天。
 *    不做时区偏移补偿，因为业务上材料截止精确到天已足够，
 *    而引入固定 offset 反而会在夏令时/跨区场景制造更难排查的问题。
 */
export function todayStr(now = new Date()) {
  return [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

export function shiftDay(dayStr, delta) {
  const day = normalizeDay(dayStr)
  if (!day) return ''
  const [y, m, d] = day.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d) + delta * 86400000)
  return [
    dt.getUTCFullYear(),
    String(dt.getUTCMonth() + 1).padStart(2, '0'),
    String(dt.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

/**
 * 出愿截止前两周（带夹逼）。出愿截止缺失或不可解析时返回 ''。
 */
export function computeMaterialDeadline(applicationEndDate, now = new Date()) {
  const end = normalizeDay(applicationEndDate)
  if (!end) return ''
  const base = shiftDay(end, -MATERIAL_LEAD_DAYS)
  const today = todayStr(now)
  const notBeforeToday = base < today ? today : base
  return notBeforeToday > end ? end : notBeforeToday
}

/**
 * 落库前的截止日决策：手填优先，留空按规则推算，都没有则 null。
 *
 * 返回 null 而不是回落到出愿截止日 —— 出愿截止本身都没填的学校，
 * 凭空给材料造一个日期只会污染待办列表。
 *
 * @returns {string|null}
 */
export function resolveMaterialDeadline(materialDeadline, applicationEndDate, now = new Date()) {
  const manual = String(materialDeadline || '').trim()
  if (manual) return manual
  return computeMaterialDeadline(applicationEndDate, now) || null
}

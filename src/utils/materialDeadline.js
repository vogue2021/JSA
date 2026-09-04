//【新需求111 第2项】材料准备截止日的默认推算
//
// 需求原话：
//   「添加学校里有一个所需材料的部分，这里面每一个需要准备的材料都可以设置截止日期。
//     目前是如果不手动设置，默认就是学校报名的截止时间，这个不合理。
//     我想改成，如果没有设置截止日期，材料准备的截止日期就是大学报名截止前的 2 周。」
//
// 为什么旧默认不合理：出愿截止当天才"准备好材料"，等于没有任何缓冲 ——
// 高中成绩证明、日语学校在籍证明这类要跑机构开具，当天拿不到就直接错过报考。
// 生产库实测：5137 条学校材料里 **3233 条（63%）的截止日就是出愿截止当天**，
// 例如「日本大学（第1期）」的 7 项材料全部压在出愿截止日那天。
//
// ⚠️ 本文件与 workers/src/utils/materialDeadline.js 是**同一套口径的两份实现**
//    （前端构建与 Workers 运行时无法共享模块）。改动任何一处都必须同步另一处，
//    两边各有测试锁定，且测试用例刻意保持一致，便于交叉核对。

/** 提前量：出愿截止前 2 周 */
export const MATERIAL_LEAD_DAYS = 14;

/**
 * 归一为 YYYY-MM-DD；无法解析返回 ''。
 *
 * 与 todoAggregator.normalizeDay 保持同一口径：线上存在区间格式日期
 * （如 "2026-09-11~2026-10-10"，出愿期被录成了区间），这里取**区间起始日**。
 * 对"截止"语义而言取起始日更保守 —— 提前准备好永远不会出错，反之会。
 */
export function normalizeDay(value) {
  if (!value) return '';
  const s = String(value).trim();
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (!m) return '';
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return '';
  // 用 UTC 构造再回读，过滤掉 2026-02-31 这类不存在的日期
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return '';
  return `${m[1]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** 本地时区的今天（不用 toISOString —— 它按 UTC 算，日本时区会差一天） */
export function todayStr(now = new Date()) {
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

/** 在 YYYY-MM-DD 上加减天数，返回 YYYY-MM-DD */
export function shiftDay(dayStr, delta) {
  const day = normalizeDay(dayStr);
  if (!day) return '';
  const [y, m, d] = day.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d) + delta * 86400000;
  const dt = new Date(t);
  return [
    dt.getUTCFullYear(),
    String(dt.getUTCMonth() + 1).padStart(2, '0'),
    String(dt.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * 推算「未手动设置截止日」时材料的默认截止日。
 *
 *   base   = 出愿截止 − 14 天
 *   result = min(出愿截止, max(base, 今天))
 *
 * 两次夹逼各解决一个真实问题：
 *
 * ① `max(base, 今天)` —— 出愿截止若在 10 天后，"提前两周"已经来不及，
 *    直接用 base 会**造出一条刚创建就已逾期的材料**。那不是提醒，是噪音，
 *    还会污染【新需求111 第1项】刚收窄的 3 天待办视图。落在今天才是正确语义：
 *    "现在就得做"。
 *
 * ② `min(出愿截止, …)` —— 编辑一所出愿期已经过去的历史学校时，
 *    上一步会把材料截止推到今天，反而**晚于出愿截止**，逻辑上说不通。
 *    夹回出愿截止日，等价于退化成旧行为，对历史数据是安全的。
 *
 * @param {string} applicationEndDate 出愿截止日（可为区间文本，取起始日）
 * @param {Date}   [now]
 * @returns {string} YYYY-MM-DD；出愿截止缺失或不可解析时返回 ''
 */
export function computeMaterialDeadline(applicationEndDate, now = new Date()) {
  const end = normalizeDay(applicationEndDate);
  if (!end) return '';
  const base = shiftDay(end, -MATERIAL_LEAD_DAYS);
  const today = todayStr(now);
  const notBeforeToday = base < today ? today : base;
  return notBeforeToday > end ? end : notBeforeToday;
}

/**
 * 材料条目落库前的截止日决策：手填优先，留空则按上面的规则推算。
 * 出愿截止也缺失时返回 null —— 宁可不设，也不要凭空造一个日期出来。
 *
 * @returns {string|null}
 */
export function resolveMaterialDeadline(materialDeadline, applicationEndDate, now = new Date()) {
  const manual = String(materialDeadline || '').trim();
  if (manual) return manual;
  return computeMaterialDeadline(applicationEndDate, now) || null;
}

/**
 * 给表单用的提示文案：告诉老师留空会得到哪一天，而不是让他去猜。
 * @returns {string} 出愿截止未填时返回 ''
 */
export function describeDefaultMaterialDeadline(applicationEndDate, now = new Date()) {
  const d = computeMaterialDeadline(applicationEndDate, now);
  if (!d) return '';
  const end = normalizeDay(applicationEndDate);
  if (d === end) return `留空则默认为出愿截止日 ${d}（出愿期已临近或已过，无法再提前两周）`;
  if (d === todayStr(now)) return `留空则默认为今天 ${d}（距出愿截止不足两周，需立即准备）`;
  return `留空则默认为 ${d}（出愿截止前两周）`;
}

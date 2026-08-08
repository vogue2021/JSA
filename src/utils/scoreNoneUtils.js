//【新需求106】"确认无相关成绩"标记的统一口径
//
// 背景：原先监管台只有两态—— 有成绩（✔）/ 没成绩（✘）。
//   但相当一部分学生是真的没有某项成绩（例如完全没考过英语），
//   老师无从表达"这一项确实没有"，导致监管台永远挂着红叉、完整度永远无法达标。
//
// 解决：学生信息页的每类成绩下方增加「无相关成绩」勾选，勾上后：
//   - 该类成绩标记为"已确认无"
//   - 监管台该列显示灰色的「无」，而不是红叉
//   - 完整度统计把它算作"已确认"
//
// 存储：students.score_none_flags（TEXT，JSON），形如 {"jlpt":true,"english":true}
//   只存true，false 直接省略，保持列内容最小。
//
// 三类成绩的键名固定为 jlpt / eju / english，与后端白名单一致。

export const SCORE_NONE_KEYS = ['jlpt', 'eju', 'english'];

/**
 * 把任意来源（API 返回的对象 / localStorage 里的旧数据 / undefined）
 * 规范化为只含已知键、值为布尔 true 的干净对象。
 * @param {any} raw
 * @returns {{jlpt?: boolean, eju?: boolean, english?: boolean}}
 */
export function normalizeScoreNoneFlags(raw) {
  let src = raw;
  // 兼容历史上被存成 JSON 字符串的情况
  if (typeof src === 'string') {
    try { src = JSON.parse(src); } catch { src = null; }
  }
  if (!src || typeof src !== 'object' || Array.isArray(src)) return {};
  const out = {};
  for (const k of SCORE_NONE_KEYS) {
    if (src[k]) out[k] = true;
  }
  return out;
}

/**
 * 计算某一类成绩的三态。
 * @param {boolean} hasScore是否已录入至少一条成绩
 * @param {any} flags       normalizeScoreNoneFlags 的结果
 * @param {string} key      jlpt | eju | english
 * @returns {{has: boolean, none: boolean, ok: boolean}}
 *   has  = 有成绩
 *   none = 没成绩但已明确标记「无」
 *   ok   = 已确认（有成绩 或已标记无）→ 计入完整度
 */
export function resolveScoreState(hasScore, flags, key) {
  const has = !!hasScore;
  const none = !has && !!(flags && flags[key]);
  return { has, none, ok: has || none };
}

/**
 * 已录入成绩时，「无」标记应自动失效 —— 避免"既有成绩又标记无"的矛盾状态。
 * 用于保存前收敛数据。
 * @param {any} flags
 * @param {{jlpt: boolean, eju: boolean, english: boolean}} hasMap 各类是否已有成绩
 */
export function pruneConflictingFlags(flags, hasMap) {
  const clean = normalizeScoreNoneFlags(flags);
  for (const k of SCORE_NONE_KEYS) {
    if (hasMap && hasMap[k]) delete clean[k];
  }
  return clean;
}

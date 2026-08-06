// 【新需求101】校内考（校考）撞期检测工具
//
// 背景：一个学生同时报考多所学校时，不同学校的校内考 / 一审 / 二审 / 面试日期
//完全有可能落在同一天。学生一天只能去一个考场，老师在选校和排考试时必须
//      提前看到这种冲突，才能避免"报了却考不了"的情况。
//
// 本工具只做纯计算（无React / 无 API 依赖），供以下位置复用：
//   - src/App.jsx        学校页面（当前学生志愿校卡片 + 顶部冲突横幅 + 详情弹窗）
//   - src/components/AdminSupervisionPage.jsx  监管台（跨学生批量排查）
//
// 判定口径：
//   1. 只统计"考试类"日期，不统计出愿开始/截止、合格发表（那些同一天没有冲突问题）
//   2. 同一所学校内部的多个考试日期落在同一天 → 不算冲突（同校併願/多次机会，属数据表达）
//   3. 只有【两所及以上不同学校】的考试日期落在同一天 → 判定为撞期冲突

/** 主考试日期字段（顶层 camelCase） → 展示名*/
export const EXAM_DATE_FIELDS = [
  { key: 'examDate', label: '校内考' },
  { key: 'firstExamDate', label: '一审考试' },
  { key: 'secondExamDate', label: '二审考试' },
];

/** 对应的 extra_dates 内字段（后端 JSON 兜底） */
const EXTRA_EXAM_KEYS = ['firstExamDate', 'secondExamDate'];

/** 自定义日期里，label 命中这些关键词才视为"考试类"日期 */
const EXAM_LABEL_PATTERN = /考|試|试|面接|面试|筆記|笔记|笔试|口述|実技|实技/;

/**
 * 判断一个自定义日期的 label 是否属于"考试类"
 * @param {string} label
 * @returns {boolean}
 */
export function isExamLikeLabel(label) {
  if (!label) return false;
  return EXAM_LABEL_PATTERN.test(String(label));
}

/**
 * 把各种日期输入统一成 'YYYY-MM-DD'；无法识别时返回 ''
 * 兼容：'2026-08-25' / '2026-08-25T00:00:00Z' / '2026/08/25' / Date 对象
 * @param {string|Date} input
 * @returns {string}
 */
export function normalizeDate(input) {
  if (!input) return '';
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return '';
    const m = String(input.getMonth() + 1).padStart(2, '0');
    const d = String(input.getDate()).padStart(2, '0');
    return `${input.getFullYear()}-${m}-${d}`;
  }
  const raw = String(input).trim();
  if (!raw) return '';
  // 直接取前 10 位的 YYYY-MM-DD（覆盖带时间的 ISO 串）
  const iso = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  // 兼容 YYYY/M/D 与 YYYY-M-D
  const m = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (m) {
    return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
  }
  return '';
}

/**稳定的学校标识：优先 id，退化到 名称+学部 组合键 */
export function getSchoolKey(school) {
  if (!school) return '';
  if (school.id !== undefined && school.id !== null && school.id !== '') return `id:${school.id}`;
  return `nm:${school.name || ''}|${school.program || ''}`;
}

/**
 * 收集一所学校的全部"考试类"日期
 * @param {object} school 前端 camelCase 学校对象（也兼容后端 snake_case + extra_dates）
 * @returns {Array<{date: string, label: string}>} 已按日期升序去重
 */
export function collectExamDates(school) {
  if (!school) return [];

  // extra_dates 可能是对象，也可能是尚未解析的 JSON 字符串
  let extra = {};
  const rawExtra = school.extra_dates ?? school.extraDates;
  if (rawExtra && typeof rawExtra === 'object') {
    extra = rawExtra;
  } else if (typeof rawExtra === 'string' && rawExtra.trim()) {
    try { extra = JSON.parse(rawExtra) || {}; } catch { extra = {}; }
  }

  const out = [];
  const push = (date, label) => {
    const d = normalizeDate(date);
    if (!d) return;
    // 同一学校内date+label 完全重复的只留一条
    if (out.some(o => o.date === d && o.label === label)) return;
    out.push({ date: d, label });
  };

  // 1) 主考试日期（顶层字段 → extra_dates → snake_case 依次兜底）
  push(school.examDate ?? school.exam_date, '校内考');
  EXTRA_EXAM_KEYS.forEach((key) => {
    const label = EXAM_DATE_FIELDS.find(f => f.key === key)?.label || key;
    push(school[key] ?? extra[key], label);
  });

  // 2) 自定义日期里的考试类条目（如"面试时间""笔试"）
  const customs = Array.isArray(school.customDates) && school.customDates.length > 0
    ? school.customDates
    : (Array.isArray(extra.customDates) ? extra.customDates : []);
  customs.forEach((cd) => {
    if (cd && cd.label && cd.date && isExamLikeLabel(cd.label)) {
      push(cd.date, String(cd.label));
    }
  });

  // 3) 併願（同一学校多个学部）各自的考试日期
  const joint = Array.isArray(school.jointPrograms) ? school.jointPrograms : [];
  joint.forEach((jp) => {
    if (jp && jp.examDate) {
      push(jp.examDate, `併願${jp.program ? `·${jp.program}` : ''} 校内考`);
    }
  });

  // 4) 【新需求102】学校信息库（school_database）形态：importantDates 多组日期
  //    该结构里每组代表一个入试（秋季入试 / 春季入试 …），组内同样有校内考/一审/二审/自定义日期。
  //    这样本工具对"学生志愿校"和"学校信息库候选校"两种数据形态都通用。
  const groups = school.importantDates || school.important_dates;
  if (Array.isArray(groups)) {
    groups.forEach((dg, gi) => {
      if (!dg) return;
      const groupLabel = dg.label || `第${gi + 1}审`;
      push(dg.examDate ?? dg.exam_date, `${groupLabel}·校内考`);
      push(dg.firstExamDate ?? dg.first_exam_date, `${groupLabel}·一审考试`);
      push(dg.secondExamDate ?? dg.second_exam_date, `${groupLabel}·二审考试`);
      const groupCustoms = Array.isArray(dg.customDates) ? dg.customDates : [];
      groupCustoms.forEach((cd) => {
        if (cd && cd.label && cd.date && isExamLikeLabel(cd.label)) {
          push(cd.date, `${groupLabel}·${cd.label}`);
        }
      });
    });
  }

  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 在一组学校（通常是同一个学生的全部志愿校）中检测考试撞期
 *
 * @param {Array<object>} schools
 * @returns {{
 *   conflictDates: Array<{date: string, entries: Array<{schoolKey: string, schoolId: any, schoolName: string, program: string, label: string}>}>,
 *   bySchoolKey: Object<string, Array<{date: string, label: string, others: Array<{schoolName: string, label: string}>}>>,
 *   conflictDateSet: Set<string>,
 *   conflictDateCount: number,
 *   involvedSchoolCount: number,
 *   hasConflict: boolean
 * }}
 */
export function detectExamConflicts(schools) {
  const empty = {
    conflictDates: [],
    bySchoolKey: {},
    conflictDateSet: new Set(),
    conflictDateCount: 0,
    involvedSchoolCount: 0,
    hasConflict: false,
  };
  if (!Array.isArray(schools) || schools.length < 2) return empty;

  // date → entries
  const byDate = {};
  schools.forEach((school) => {
    const schoolKey = getSchoolKey(school);
    const schoolName = school.name || '(未命名学校)';
    const program = school.program || '';
    collectExamDates(school).forEach(({ date, label }) => {
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push({ schoolKey, schoolId: school.id, schoolName, program, label });
    });
  });

  const conflictDates = [];
  const bySchoolKey = {};
  const involved = new Set();

  Object.keys(byDate).sort().forEach((date) => {
    const entries = byDate[date];
    // 冲突条件：该日期上出现 >= 2 所【不同】学校
    const distinctSchools = new Set(entries.map(e => e.schoolKey));
    if (distinctSchools.size < 2) return;

    conflictDates.push({ date, entries });
    entries.forEach((entry) => {
      involved.add(entry.schoolKey);
      const others = entries
        .filter(o => o.schoolKey !== entry.schoolKey)
        .map(o => ({ schoolName: o.schoolName, label: o.label }));
      if (!bySchoolKey[entry.schoolKey]) bySchoolKey[entry.schoolKey] = [];
      bySchoolKey[entry.schoolKey].push({ date, label: entry.label, others });
    });
  });

  return {
    conflictDates,
    bySchoolKey,
    conflictDateSet: new Set(conflictDates.map(c => c.date)),
    conflictDateCount: conflictDates.length,
    involvedSchoolCount: involved.size,
    hasConflict: conflictDates.length > 0,
  };
}

/**
 * 【新需求102】把"已报志愿校"的考试日期建成索引，供候选校快速比对
 * @param {Array<object>} plannedSchools 学生已报的志愿校列表
 * @returns {Object<string, Array<{schoolName: string, program: string, label: string}>>} date → 占用该日的考试
 */
export function buildExamDateIndex(plannedSchools) {
  const index = {};
  if (!Array.isArray(plannedSchools)) return index;
  plannedSchools.forEach((school) => {
    const schoolName = school?.name || '(未命名学校)';
    const program = school?.program || '';
    collectExamDates(school).forEach(({ date, label }) => {
      if (!index[date]) index[date] = [];
      index[date].push({ schoolName, program, label });
    });
  });
  return index;
}

/**
 * 【新需求102】候选学校（如"近期可报"里的信息库学校）与"已报志愿校"的撞期比对
 *
 * 与 detectExamConflicts 的区别：这里是"候选 × 已有计划"的单向比对，
 * 用于回答"如果给这个学生报这所学校，考试会不会和已报的学校撞车"。
 *
 * @param {object} candidateSchool 候选学校（支持 importantDates 形态）
 * @param {Object} plannedIndex buildExamDateIndex 的返回值
 * @param {object} [options]
 * @param {string} [options.excludeSchoolName] 需要排除的学校名（候选校本身已被该学生报过时避免自撞）
 * @returns {Array<{date: string, label: string, others: Array<{schoolName: string, label: string}>}>}
 */
export function findConflictsAgainstIndex(candidateSchool, plannedIndex, options = {}) {
  if (!candidateSchool || !plannedIndex) return [];
  const { excludeSchoolName } = options;
  const out = [];
  collectExamDates(candidateSchool).forEach(({ date, label }) => {
    const occupied = (plannedIndex[date] || [])
      .filter(o => !excludeSchoolName || o.schoolName !== excludeSchoolName);
    if (occupied.length > 0) {
      out.push({
        date,
        label,
        others: occupied.map(o => ({ schoolName: o.schoolName, label: o.label })),
      });
    }
  });
  return out;
}

/**
 * 取某所学校命中的冲突条目
 * @param {object} conflictResult detectExamConflicts 的返回值
 * @param {object} school
 * @returns {Array<{date: string, label: string, others: Array<{schoolName: string, label: string}>}>}
 */
export function getSchoolConflicts(conflictResult, school) {
  if (!conflictResult || !school) return [];
  return conflictResult.bySchoolKey?.[getSchoolKey(school)] || [];
}

/**
 * 判断某个日期在结果中是否为冲突日
 * @param {object} conflictResult
 * @param {string|Date} date
 * @returns {boolean}
 */
export function isConflictDate(conflictResult, date) {
  const d = normalizeDate(date);
  if (!d || !conflictResult?.conflictDateSet) return false;
  return conflictResult.conflictDateSet.has(d);
}

/**
 * 生成人类可读的冲突摘要文案（用于 tooltip / CSV / 通知）
 * @param {object} conflictResult
 * @returns {string} 例："2026-08-25：東京大学(校内考)、京都大学(一审考试)"
 */
export function formatConflictSummary(conflictResult) {
  if (!conflictResult?.conflictDates?.length) return '';
  return conflictResult.conflictDates
    .map(({ date, entries }) => {
      const names = entries.map(e => `${e.schoolName}(${e.label})`).join('、');
      return `${date}：${names}`;
    })
    .join('； ');
}

//【新需求120 第2项】每日考务日程构建
//
// 需求原话：
//   「作为一个权限，只给 admin 账号的功能，新增加一个页面，按照每天的维度去显示
//     数据库里面的学校，哪些要报名了，哪些要考试了。也就是为了清晰的知道哪些学校
//     需要报名，哪些学校需要考试。目的是方便安排考试的上课时间。」
//
// 与 todoAggregator 的区别：
//   待办页回答的是"每个学生今天该做什么"（按任务聚合、以完成状态为核心）；
//   本模块回答的是"全校接下来每天要接什么"（按日期聚合、以场次为核心），
//   用于排课/统筹安排，所以不读 events/materials，只用 schools 的日期端。
//
// 关键口径：
//   · 只收两类事 —— 报名（出愿开始/出愿截止）与 考试（入学考试/一审/二审/考试类自定义日期）
//     结果发表不收录：需求明确"报名与考试"，发表日不需要排课
//   · 合格/未合格的学校整体排除 —— 流程已结束，无需再安排
//   · 同一所学校同一天同一事项涉及多名学生 → 合并成一行，学生姓名聚成数组
//     （併願同校不同学部的 program 不同，不合并）

import {
  TODO_KINDS, normalizeDay, daysUntil, parseExtraDates, classifyCustomLabel,
} from './todoAggregator';

export const SCHEDULE_CATEGORY = {
  EXAM: 'exam',   // 考试类
  APPLY: 'apply', // 报名类
};

export const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/** 与 todoAggregator 相同的字段兼容取值 */
function pick(obj, ...keys) {
  for (const k of keys) {
    if (obj?.[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return '';
}

/**
 * 把 schools 数据按天聚合成考务日程。
 *
 * @param {object}   input
 * @param {Array}    input.schools   原始 schools（extra_dates 可为 JSON 字符串或对象）
 * @param {Array}    input.students  [{ student_id, name }]
 * @param {number}  [input.days=30]  向后看多少天（含今天）
 * @param {Date}    [input.now]
 * @returns {Array<{ date, weekday, daysLeft, isToday, isTomorrow,
 *   items: Array<{ category, label, schoolName, program, schoolId, deadlineType,
 *                  students: Array<{studentId, studentName}> }> }>}
 *   只返回有内容的日期，按日期升序；同一天内考试类排在报名类之前。
 */
export function buildDailySchedule({ schools = [], students = [], days = 30, now = new Date() }) {
  const nameOf = new Map();
  students.forEach(s => {
    const id = pick(s, 'student_id', 'studentId');
    if (id) nameOf.set(String(id), pick(s, 'name') || String(id));
  });

  // 先展开成扁平场次，再按 (日期|类别|标签|校名|学部) 指纹合并学生
  const byDay = new Map(); // date -> Map<fingerprint, item>

  const pushEntry = (sc, dateRaw, category, label, deadlineType = '') => {
    const day = normalizeDay(dateRaw);
    if (!day) return;
    const left = daysUntil(day, now);
    if (left === null || left < 0 || left > days) return; // 只收窗口内的
    const studentId = pick(sc, 'student_id', 'studentId');
    const schoolId = pick(sc, 'id');
    const schoolName = pick(sc, 'name') || '未命名学校';
    const program = pick(sc, 'program');
    const fp = [day, category, label, schoolName, program].join('|');
    if (!byDay.has(day)) byDay.set(day, new Map());
    const dayMap = byDay.get(day);
    if (!dayMap.has(fp)) {
      dayMap.set(fp, {
        category, label, schoolName, program, schoolId,
        deadlineType,
        students: [],
      });
    }
    const item = dayMap.get(fp);
    if (!item.students.some(s => String(s.studentId) === String(studentId))) {
      item.students.push({ studentId, studentName: nameOf.get(String(studentId)) || String(studentId || '') });
    }
  };

  for (const sc of schools) {
    const status = String(pick(sc, 'status') || '');
    // 已出结果的学校不再需要排课/报名安排
    if (status === 'admitted' || status === 'rejected') continue;
    const extra = parseExtraDates(sc);

    // 报名类
    pushEntry(sc, pick(sc, 'application_start_date', 'applicationStartDate'), SCHEDULE_CATEGORY.APPLY, '出愿开始');
    pushEntry(sc, pick(sc, 'application_end_date', 'applicationEndDate'), SCHEDULE_CATEGORY.APPLY, '出愿截止', extra.deadlineType || '');
    // 考试类
    pushEntry(sc, pick(sc, 'exam_date', 'examDate'), SCHEDULE_CATEGORY.EXAM, '考试');
    pushEntry(sc, extra.firstExamDate, SCHEDULE_CATEGORY.EXAM, '一审考试');
    pushEntry(sc, extra.secondExamDate, SCHEDULE_CATEGORY.EXAM, '二审考试');
    (Array.isArray(extra.customDates) ? extra.customDates : []).forEach(cd => {
      if (cd && cd.label && cd.date && classifyCustomLabel(cd.label) === TODO_KINDS.EXAM) {
        pushEntry(sc, cd.date, SCHEDULE_CATEGORY.EXAM, cd.label);
      }
    });
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, dayMap]) => {
      const [y, m, d] = date.split('-').map(Number);
      const weekday = WEEKDAY_LABELS[new Date(y, m - 1, d).getDay()];
      const left = daysUntil(date, now);
      const items = [...dayMap.values()].sort((a, b) => {
        // 同一天内：考试类在前（排课优先级最高），再按校名
        if (a.category !== b.category) return a.category === SCHEDULE_CATEGORY.EXAM ? -1 : 1;
        return String(a.schoolName).localeCompare(String(b.schoolName), 'zh');
      });
      items.forEach(it => it.students.sort((a, b) => String(a.studentName).localeCompare(String(b.studentName), 'zh')));
      return {
        date,
        weekday,
        daysLeft: left,
        isToday: left === 0,
        isTomorrow: left === 1,
        items,
      };
    });
}

/** 汇总统计（供页面统计卡） */
export function summarizeSchedule(daysList) {
  const schoolIds = new Set();
  let examCount = 0;
  let applyCount = 0;
  for (const day of daysList) {
    for (const it of day.items) {
      schoolIds.add(`${it.schoolName}|${it.program}`);
      if (it.category === SCHEDULE_CATEGORY.EXAM) examCount += 1;
      else applyCount += 1;
    }
  }
  return { days: daysList.length, examCount, applyCount, schoolCount: schoolIds.size };
}

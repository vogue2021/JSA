//【新需求109】待办聚合口径测试
//
// 这些口径直接决定学生"今天该做什么"，算错会让人漏掉出愿截止 —— 后果不可逆，
// 所以逐条固化：
//   · 日期差必须按**日历日**算（不能用 24 小时差，否则晚上看会差一天）
//   · 一审/二审/自定义日期必须能从 schools 补齐（events 从未展开过它们）
//   · 同一件事涉及多个学生时必须合并成一行（需求明确要求）
//   · 逾期未完成的事必须排在最前，不能因为日期过了就消失

import { describe, it, expect } from 'vitest';
import {
  TODO_KINDS, normalizeDay, todayStr, daysUntil,
  buildTodoItems, groupTodosByTask, bucketTodos, summarizeTodos, sortTodos,
  extractDeadlineTypeFromTitle,
} from '../utils/todoAggregator';

// 固定"现在"，让测试不随真实日期漂移
const NOW = new Date(2026, 7, 31, 10, 0, 0); // 2026-08-31 10:00 本地时间
const students = [
  { student_id: '2026091', name: '吴以凡' },
  { student_id: '2026064', name: '吴佳李南' },
];

describe('normalizeDay / daysUntil', () => {
  it('归一各种日期写法到 YYYY-MM-DD', () => {
    expect(normalizeDay('2026-9-5')).toBe('2026-09-05');
    expect(normalizeDay('2026-09-05T12:00:00Z')).toBe('2026-09-05');
    expect(normalizeDay('')).toBe('');
    expect(normalizeDay(null)).toBe('');
  });

  it('按日历日计算天数差', () => {
    expect(daysUntil('2026-08-31', NOW)).toBe(0);
    expect(daysUntil('2026-09-01', NOW)).toBe(1);
    expect(daysUntil('2026-08-30', NOW)).toBe(-1);
    expect(daysUntil('2026-09-30', NOW)).toBe(30);
  });

  it('深夜看"明天"仍应是 1 天，而不是被 24 小时差算成 0', () => {
    const lateNight = new Date(2026, 7, 31, 23, 30, 0);
    expect(daysUntil('2026-09-01', lateNight)).toBe(1);
  });

  it('todayStr 用本地时区（日本时区不能被 UTC 挪走一天）', () => {
    expect(todayStr(new Date(2026, 7, 31, 8, 0, 0))).toBe('2026-08-31');
  });
});

describe('buildTodoItems —— 三类来源的展开', () => {
  it('events 按标题正确分类', () => {
    const items = buildTodoItems({
      students,
      events: [
        { id: 1, student_id: '2026091', title: '早稲田 出愿截止（消印有効）', date: '2026-09-05', category: '出愿', completed: 0, school_id: 10, deadline_type: '消印有効' },
        { id: 2, student_id: '2026091', title: '明治 考试', date: '2026-09-20', category: '考试', type: 'exam', completed: 0, school_id: 11 },
        { id: 3, student_id: '2026091', title: '法政 合格发表', date: '2026-10-01', category: '合格发表', completed: 0, school_id: 12 },
      ],
      now: NOW,
    });
    expect(items.find(i => i.sourceId === 1).kind).toBe(TODO_KINDS.APPLICATION_END);
    expect(items.find(i => i.sourceId === 2).kind).toBe(TODO_KINDS.EXAM);
    expect(items.find(i => i.sourceId === 3).kind).toBe(TODO_KINDS.RESULT);
    // 出愿截止类型要带出来（决定实际寄送时间）
    expect(items.find(i => i.sourceId === 1).deadlineType).toBe('消印有効');
  });

  it('材料的 deadline 会成为待办，并带上学生姓名', () => {
    const items = buildTodoItems({
      students,
      materials: [
        { id: 5, student_id: '2026091', item: '毕业证明', type: 'general', deadline: '2026-09-02', completed: 0 },
      ],
      now: NOW,
    });
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe(TODO_KINDS.MATERIAL);
    expect(items[0].studentName).toBe('吴以凡');
    expect(items[0].daysLeft).toBe(2);
  });

  it('【关键】一审/二审/自定义日期能从 schools 补齐 —— events 从未展开过它们', () => {
    const items = buildTodoItems({
      students,
      events: [],
      schools: [{
        id: 20, student_id: '2026091', name: '立命馆大学', status: 'preparing',
        extra_dates: {
          firstExamDate: '2026-09-10',
          firstResultDate: '2026-09-18',
          secondExamDate: '2026-10-05',
          secondResultDate: '2026-10-12',
          customDates: [{ label: '书类提交', date: '2026-09-08' }],
        },
      }],
      now: NOW,
    });
    const titles = items.map(i => i.title);
    expect(titles).toContain('立命馆大学 一审考试');
    expect(titles).toContain('立命馆大学 一审发表');
    expect(titles).toContain('立命馆大学 二审考试');
    expect(titles).toContain('立命馆大学 二审发表');
    expect(titles).toContain('立命馆大学 书类提交');
    // 一审考试要归类为考试；书类提交含"提交"应归为截止类
    expect(items.find(i => i.title.includes('一审考试')).kind).toBe(TODO_KINDS.EXAM);
    expect(items.find(i => i.title.includes('书类提交')).kind).toBe(TODO_KINDS.APPLICATION_END);
  });

  it('extra_dates 是 JSON 字符串时同样能解析', () => {
    const items = buildTodoItems({
      students,
      schools: [{
        id: 21, student_id: '2026091', name: 'X大学',
        extra_dates: JSON.stringify({ firstExamDate: '2026-09-11' }),
      }],
      now: NOW,
    });
    expect(items.some(i => i.title === 'X大学 一审考试')).toBe(true);
  });

  it('同一学校同一天已有 event 时，不从 schools 重复生成', () => {
    const items = buildTodoItems({
      students,
      events: [{ id: 1, student_id: '2026091', title: '早稲田 出愿截止', date: '2026-09-05', category: '出愿', completed: 0, school_id: 30 }],
      schools: [{ id: 30, student_id: '2026091', name: '早稲田', application_end_date: '2026-09-05' }],
      now: NOW,
    });
    expect(items.filter(i => i.date === '2026-09-05')).toHaveLength(1);
  });

  it('逾期未完成标记 overdue；已完成的不算逾期', () => {
    const items = buildTodoItems({
      students,
      materials: [
        { id: 6, student_id: '2026091', item: '过期未交', type: 'general', deadline: '2026-08-20', completed: 0 },
        { id: 7, student_id: '2026091', item: '过期已交', type: 'general', deadline: '2026-08-20', completed: 1 },
      ],
      now: NOW,
    });
    expect(items.find(i => i.sourceId === 6).overdue).toBe(true);
    expect(items.find(i => i.sourceId === 7).overdue).toBe(false);
  });

  it('无法解析的日期直接丢弃，不产生脏条目', () => {
    const items = buildTodoItems({
      students,
      materials: [{ id: 8, student_id: '2026091', item: '无期限', deadline: '', completed: 0 }],
      now: NOW,
    });
    expect(items).toHaveLength(0);
  });
});

describe('groupTodosByTask —— 同一任务多学生合并（需求核心）', () => {
  it('同校同日同事项的多个学生合并为一行', () => {
    const items = buildTodoItems({
      students,
      events: [
        { id: 1, student_id: '2026091', title: '早稲田 出愿截止', date: '2026-09-05', category: '出愿', completed: 0, school_id: 40 },
        { id: 2, student_id: '2026064', title: '早稲田 出愿截止', date: '2026-09-05', category: '出愿', completed: 0, school_id: 40 },
      ],
      now: NOW,
    });
    const groups = groupTodosByTask(items);
    expect(groups).toHaveLength(1);
    expect(groups[0].totalCount).toBe(2);
    expect(groups[0].students.map(s => s.studentName)).toEqual(['吴佳李南', '吴以凡']); // 按姓名排序
  });

  it('同校同日但不同事项不能被糊在一起', () => {
    const items = buildTodoItems({
      students,
      events: [{ id: 1, student_id: '2026091', title: '早稲田 出愿截止', date: '2026-09-05', category: '出愿', completed: 0, school_id: 40 }],
      materials: [{ id: 2, student_id: '2026091', item: '早稲田 推荐信', type: 'school', deadline: '2026-09-05', school_id: 40, completed: 0 }],
      now: NOW,
    });
    expect(groupTodosByTask(items)).toHaveLength(2);
  });

  it('统计每个任务的完成进度；全部完成时 allDone 为 true', () => {
    const items = buildTodoItems({
      students,
      materials: [
        { id: 1, student_id: '2026091', item: '毕业证明', type: 'general', deadline: '2026-09-05', completed: 1 },
        { id: 2, student_id: '2026064', item: '毕业证明', type: 'general', deadline: '2026-09-05', completed: 0 },
      ],
      now: NOW,
    });
    const g = groupTodosByTask(items)[0];
    expect(g.totalCount).toBe(2);
    expect(g.doneCount).toBe(1);
    expect(g.allDone).toBe(false);
  });
});

describe('sortTodos / bucketTodos / summarizeTodos', () => {
  const build = () => buildTodoItems({
    students,
    materials: [
      { id: 1, student_id: '2026091', item: '逾期项', type: 'general', deadline: '2026-08-25', completed: 0 },
      { id: 2, student_id: '2026091', item: '今天项', type: 'general', deadline: '2026-08-31', completed: 0 },
      { id: 3, student_id: '2026091', item: '明天项', type: 'general', deadline: '2026-09-01', completed: 0 },
      { id: 4, student_id: '2026091', item: '远期项', type: 'general', deadline: '2026-11-01', completed: 0 },
    ],
    now: NOW,
  });

  it('逾期项排最前', () => {
    const sorted = sortTodos(groupTodosByTask(build()));
    expect(sorted[0].title).toBe('逾期项');
  });

  it('同一天内出愿截止排在材料之前（错过出愿后果最重）', () => {
    const items = buildTodoItems({
      students,
      events: [{ id: 9, student_id: '2026091', title: 'A大学 出愿截止', date: '2026-09-05', category: '出愿', completed: 0, school_id: 50 }],
      materials: [{ id: 10, student_id: '2026091', item: 'B材料', type: 'general', deadline: '2026-09-05', completed: 0 }],
      now: NOW,
    });
    const sorted = sortTodos(groupTodosByTask(items));
    expect(sorted[0].kind).toBe(TODO_KINDS.APPLICATION_END);
  });

  it('按时间分桶，且空桶不出现', () => {
    const buckets = bucketTodos(groupTodosByTask(build()));
    const ids = buckets.map(b => b.id);
    expect(ids).toContain('overdue');
    expect(ids).toContain('today');
    expect(ids).toContain('tomorrow');
    expect(ids).toContain('later');
    expect(ids).not.toContain('week'); // 2~7 天内无数据
  });

  it('统计卡计数正确', () => {
    const s = summarizeTodos(groupTodosByTask(build()));
    expect(s.total).toBe(4);
    expect(s.overdue).toBe(1);
    expect(s.today).toBe(1);
    expect(s.week).toBe(2); // 今天 + 明天
  });
});

// ─── 回归：deadline_type 列不存在（线上报 no such column）─────────────────────
//
// 故障：接口 SELECT 了 events.deadline_type 与 schools.deadline_type，
//   但这两张表**都没有这一列**（已核对两个库的建表语句）→
//   D1 直接抛 `no such column: deadline_type`，整个待办页一片空白。
//
// 【新需求88/90】的出愿截止类型实际是：
//   · schools —— 存在 extra_dates JSON 的 deadlineType 字段
//   · events  —— 根本没落库，而是把类型拼在标题后缀里
// 所以类型只能从这两个地方取，绝不能读独立列。
describe('出愿截止类型的来源（回归 no such column: deadline_type）', () => {
  it('从事件标题后缀提取类型', () => {
    expect(extractDeadlineTypeFromTitle('早稲田 出愿截止（消印有効）')).toBe('消印有効');
    expect(extractDeadlineTypeFromTitle('明治 出愿截止(必着)')).toBe('必着');
  });

  it('不误伤"出愿截止前注意事项"这类自定义标题', () => {
    expect(extractDeadlineTypeFromTitle('出愿截止前注意事项')).toBe('');
    expect(extractDeadlineTypeFromTitle('法政 考试')).toBe('');
    expect(extractDeadlineTypeFromTitle(null)).toBe('');
  });

  it('事件待办的 deadlineType 来自标题，而非不存在的列', () => {
    const items = buildTodoItems({
      students,
      events: [{
        id: 1, student_id: '2026091', title: '早稲田 出愿截止（消印有効）',
        date: '2026-09-05', category: '出愿', completed: 0, school_id: 60,
        // 故意不提供 deadline_type —— 真实接口也不会返回它
      }],
      now: NOW,
    });
    expect(items[0].deadlineType).toBe('消印有効');
  });

  it('学校补齐的出愿截止，类型取自 extra_dates.deadlineType', () => {
    const items = buildTodoItems({
      students,
      schools: [{
        id: 61, student_id: '2026091', name: '上智大学',
        application_end_date: '2026-09-12',
        extra_dates: { deadlineType: '必着' },
      }],
      now: NOW,
    });
    const t = items.find(i => i.title.includes('出愿截止'));
    expect(t.deadlineType).toBe('必着');
    // 非"出愿截止"的项不应带类型（考试日没有消印/必着的概念）
    const exam = items.find(i => i.kind === TODO_KINDS.EXAM);
    expect(exam).toBeUndefined();
  });
});

// ─── 回归：线上真实数据里存在区间格式日期 ────────────────────────────────────
//
// staging 实测发现 events.date 有 "2026-09-11~2026-10-10" 这种值
// （学校的考试期/出愿期被录成了区间）。
// 待办必须能处理它：取区间起始日用于排序分桶，同时保留原文供 UI 展示。
// 若哪天把 normalizeDay 改成严格全串匹配，这类事项会直接从待办里消失。
describe('区间格式日期（回归）', () => {
  it('normalizeDay 取区间起始日，不返回空', () => {
    expect(normalizeDay('2026-09-11~2026-10-10')).toBe('2026-09-11');
    expect(normalizeDay('2026-09-11～2026-10-10')).toBe('2026-09-11'); // 全角波浪号
  });

  it('区间事项不会被丢弃，且保留原始文本用于展示', () => {
    const items = buildTodoItems({
      students,
      events: [{
        id: 70, student_id: '2026091', title: '早稻田大学 入学考试',
        date: '2026-09-11~2026-10-10', category: '考试', type: 'exam',
        completed: 0, school_id: 32,
      }],
      now: NOW,
    });
    expect(items).toHaveLength(1);
    expect(items[0].date).toBe('2026-09-11');       // 排序/分桶用起始日
    expect(items[0].dateRaw).toBe('2026-09-11~2026-10-10'); // UI 显示用原文
    expect(items[0].isRange).toBe(true);
    expect(items[0].daysLeft).toBe(11);             // 距 8/31 有 11 天
  });

  it('单日事项的 isRange 为 false，dateRaw 等于 date', () => {
    const items = buildTodoItems({
      students,
      materials: [{ id: 71, student_id: '2026091', item: '证件照', deadline: '2026-09-05', completed: 0 }],
      now: NOW,
    });
    expect(items[0].isRange).toBe(false);
    expect(items[0].dateRaw).toBe('2026-09-05');
  });

  it('分组后区间信息保留到任务层', () => {
    const items = buildTodoItems({
      students,
      events: [{ id: 72, student_id: '2026091', title: 'X大学 入学考试', date: '2026-09-11~2026-10-10', category: '考试', completed: 0, school_id: 80 }],
      now: NOW,
    });
    const g = groupTodosByTask(items)[0];
    expect(g.isRange).toBe(true);
    expect(g.dateRaw).toBe('2026-09-11~2026-10-10');
  });
});

// ─── 回归：不同学生报同一所学校，school_id 不同但必须合并 ─────────────────────
//
// 用 staging 真实数据验证时发现的 bug：最初的任务指纹把 schoolId 纳入了，
// 而每个学生的志愿校是各自独立的记录 —— 两个学生报同一所早稻田，
// school_id 分别是 32 和 26。结果"早稻田大学 一审发表"被拆成两行，
// 恰恰违背了需求「学生重叠时……一个任务的 UI，需要考虑多个学生」。
describe('跨学生同校任务合并（回归 school_id 不同导致拆分）', () => {
  it('两个学生报同一所学校、school_id 不同，仍应合并为一个任务', () => {
    const items = buildTodoItems({
      students,
      schools: [
        { id: 32, student_id: '2026091', name: '早稻田大学', extra_dates: { firstResultDate: '2026-09-25' } },
        { id: 26, student_id: '2026064', name: '早稻田大学', extra_dates: { firstResultDate: '2026-09-25' } },
      ],
      now: NOW,
    });
    const groups = groupTodosByTask(items);
    const target = groups.filter(g => g.title === '早稻田大学 一审发表');
    expect(target).toHaveLength(1);           // 关键：只有一条
    expect(target[0].totalCount).toBe(2);     // 两个学生都挂在这条上
    expect(target[0].students.map(s => s.studentId).sort())
      .toEqual(['2026064', '2026091']);
  });

  it('不同学校的同类事项仍然分开（标题不同）', () => {
    const items = buildTodoItems({
      students,
      schools: [
        { id: 1, student_id: '2026091', name: '早稻田大学', application_end_date: '2026-09-25' },
        { id: 2, student_id: '2026091', name: '庆应大学', application_end_date: '2026-09-25' },
      ],
      now: NOW,
    });
    expect(groupTodosByTask(items)).toHaveLength(2);
  });

  it('同一天同一学校的不同事项不会被合并', () => {
    const items = buildTodoItems({
      students,
      schools: [{
        id: 3, student_id: '2026091', name: 'A大学',
        application_end_date: '2026-09-25',
        extra_dates: { firstExamDate: '2026-09-25' },
      }],
      now: NOW,
    });
    const groups = groupTodosByTask(items);
    // 出愿截止与一审考试是两件事
    expect(groups).toHaveLength(2);
  });
});

// ─── 回归：同一学生对同一学校有多条志愿记录时不能重复出现 ────────────────────
//
// 真实数据里"刘七"对早稻田有两条志愿校记录（school_id 26/27，不同学部），
// 一审发表日期相同 → 会为同一学生生成两条同名待办。
// 若不去重，卡片上会显示"刘七, 刘七"，且 N/M 完成计数虚高。
describe('同一学生在同一任务中去重（回归）', () => {
  it('同学生的多条同名待办合并为一个学生标签', () => {
    const items = buildTodoItems({
      students,
      schools: [
        { id: 26, student_id: '2026091', name: '早稻田大学', program: '政経', extra_dates: { firstResultDate: '2026-09-25' } },
        { id: 27, student_id: '2026091', name: '早稻田大学', program: '商学', extra_dates: { firstResultDate: '2026-09-25' } },
      ],
      now: NOW,
    });
    const g = groupTodosByTask(items).find(x => x.title === '早稻田大学 一审发表');
    expect(g.totalCount).toBe(1);
    expect(g.students).toHaveLength(1);
    expect(g.students[0].studentId).toBe('2026091');
  });

  it('多条记录中任一条已完成，即视为该生已完成', () => {
    const items = buildTodoItems({
      students,
      materials: [
        { id: 1, student_id: '2026091', item: '毕业证明', type: 'general', deadline: '2026-09-05', completed: 0 },
        { id: 2, student_id: '2026091', item: '毕业证明', type: 'general', deadline: '2026-09-05', completed: 1 },
      ],
      now: NOW,
    });
    const g = groupTodosByTask(items)[0];
    expect(g.totalCount).toBe(1);
    expect(g.doneCount).toBe(1);
    expect(g.allDone).toBe(true);
  });
});

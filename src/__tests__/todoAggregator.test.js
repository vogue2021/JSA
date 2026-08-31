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

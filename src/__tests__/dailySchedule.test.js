//【新需求120 第2项】考务日程聚合口径测试
//
// 这个页面直接决定"哪天要接哪所学校的考试/报名"，排错课就是事故，逐条固化：
//   · 只收窗口内的日期，已过的不出现
//   · 同一学校同一事项跨学生合并成一行
//   · 併願同校不同学部（program 不同）不合并
//   · 考试类自定义日期收录，非考试类（书类提交等）不收
//   · 合格/未合格的学校整体排除

import { describe, it, expect } from 'vitest';
import { buildDailySchedule, summarizeSchedule, SCHEDULE_CATEGORY } from '../utils/dailySchedule';

const NOW = new Date(2026, 8, 5, 10, 0, 0); // 2026-09-05 10:00 本地时间
const students = [
  { student_id: 'S1', name: '张三' },
  { student_id: 'S2', name: '李四' },
];

describe('buildDailySchedule', () => {
  it('按天聚合：出愿开始/截止 + 考试/一审/二审都入场，窗口外排除', () => {
    const days = buildDailySchedule({
      students,
      now: NOW,
      days: 30,
      schools: [{
        id: 1, student_id: 'S1', name: '早稲田大学', program: '政治经济学部', status: 'preparing',
        application_start_date: '2026-09-01',  // 已过 → 排除
        application_end_date: '2026-09-10',
        exam_date: '2026-09-20',
        result_date: '2026-10-01',             // 发表日不收录
        extra_dates: { firstExamDate: '2026-09-15', secondExamDate: '2026-09-28', firstResultDate: '2026-09-25' },
      }, {
        id: 99, student_id: 'S1', name: '远期大学', status: 'preparing', exam_date: '2026-10-20', // 45 天后，超出 30 天窗口
      }],
    });
    const all = days.flatMap(d => d.items.map(i => `${d.date}|${i.label}`));
    expect(all).toContain('2026-09-10|出愿截止');
    expect(all).toContain('2026-09-15|一审考试');
    expect(all).toContain('2026-09-20|考试');
    expect(all).toContain('2026-09-28|二审考试');
    expect(all.some(s => s.includes('出愿开始'))).toBe(false); // 已过
    expect(all.some(s => s.includes('发表'))).toBe(false);     // 发表不收录
    expect(all.some(s => s.includes('远期大学'))).toBe(false); // 超出 30 天窗口
  });

  it('同一学校同一事项跨学生合并成一行', () => {
    const days = buildDailySchedule({
      students,
      now: NOW,
      schools: [
        { id: 2, student_id: 'S1', name: '明治大学', program: '文学部', status: 'applied', exam_date: '2026-09-12' },
        { id: 3, student_id: 'S2', name: '明治大学', program: '文学部', status: 'applied', exam_date: '2026-09-12' },
      ],
    });
    const day = days.find(d => d.date === '2026-09-12');
    expect(day.items).toHaveLength(1);
    expect(day.items[0].students.map(s => s.studentName)).toEqual(['李四', '张三']); // 中文按拼音排序
  });

  it('併願同校不同学部不合并', () => {
    const days = buildDailySchedule({
      students,
      now: NOW,
      schools: [
        { id: 4, student_id: 'S1', name: '明治大学', program: '文学部', status: 'applied', exam_date: '2026-09-12' },
        { id: 5, student_id: 'S1', name: '明治大学', program: '商学部', status: 'applied', exam_date: '2026-09-12' },
      ],
    });
    const day = days.find(d => d.date === '2026-09-12');
    expect(day.items).toHaveLength(2);
  });

  it('考试类自定义日期（面试/笔试）收录，非考试类（书类提交）不收', () => {
    const days = buildDailySchedule({
      students,
      now: NOW,
      schools: [{
        id: 6, student_id: 'S1', name: '法政大学', status: 'applied',
        extra_dates: { customDates: [
          { label: '面试', date: '2026-09-08' },
          { label: '书类提交', date: '2026-09-09' },
        ] },
      }],
    });
    const labels = days.flatMap(d => d.items.map(i => `${d.date}|${i.label}`));
    expect(labels).toContain('2026-09-08|面试');
    expect(labels.some(s => s.includes('书类提交'))).toBe(false);
  });

  it('合格/未合格的学校整体排除；出愿截止带消印/必着类型', () => {
    const days = buildDailySchedule({
      students,
      now: NOW,
      schools: [
        { id: 7, student_id: 'S1', name: 'A大学', status: 'admitted', exam_date: '2026-09-10' },
        { id: 8, student_id: 'S1', name: 'B大学', status: 'rejected', exam_date: '2026-09-10' },
        { id: 9, student_id: 'S1', name: 'C大学', status: 'submitted',
          application_end_date: '2026-09-11', extra_dates: { deadlineType: '必着' } },
      ],
    });
    const all = days.flatMap(d => d.items);
    expect(all.some(i => i.schoolName === 'A大学' || i.schoolName === 'B大学')).toBe(false);
    const end = all.find(i => i.schoolName === 'C大学');
    expect(end.label).toBe('出愿截止');
    expect(end.deadlineType).toBe('必着');
  });

  it('日期元信息：星期/今天/明天/天数差；同一天内考试类排在报名类之前', () => {
    const days = buildDailySchedule({
      students,
      now: NOW,
      schools: [{
        id: 10, student_id: 'S1', name: 'D大学', status: 'preparing',
        application_end_date: '2026-09-05', exam_date: '2026-09-05',
      }],
    });
    expect(days[0].date).toBe('2026-09-05');
    expect(days[0].isToday).toBe(true);
    expect(days[0].weekday).toBe('周六'); // 2026-09-05 是周六
    expect(days[0].items[0].category).toBe(SCHEDULE_CATEGORY.EXAM);
    expect(days[0].items[1].category).toBe(SCHEDULE_CATEGORY.APPLY);
  });

  it('区间日期取起始日入日程', () => {
    const days = buildDailySchedule({
      students,
      now: NOW,
      schools: [{ id: 11, student_id: 'S1', name: 'E大学', status: 'applied', exam_date: '2026-09-11~2026-10-10' }],
    });
    expect(days[0].date).toBe('2026-09-11');
  });

  it('summarizeSchedule 统计场次与学校数', () => {
    const days = buildDailySchedule({
      students,
      now: NOW,
      schools: [
        { id: 12, student_id: 'S1', name: 'F大学', program: 'X', status: 'applied', exam_date: '2026-09-10', application_end_date: '2026-09-08' },
        { id: 13, student_id: 'S2', name: 'F大学', program: 'X', status: 'applied', exam_date: '2026-09-10' },
        { id: 14, student_id: 'S1', name: 'G大学', program: 'Y', status: 'applied', exam_date: '2026-09-12' },
      ],
    });
    const s = summarizeSchedule(days);
    expect(s.examCount).toBe(2);   // F大学合并成一行 + G大学
    expect(s.applyCount).toBe(1);
    expect(s.schoolCount).toBe(2); // F大学|X 与 G大学|Y
  });
});

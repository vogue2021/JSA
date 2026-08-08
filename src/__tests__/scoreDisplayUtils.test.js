//【新需求107】成绩展示口径测试
//
// 这些口径直接影响监管判断，写错了会误导选校决策，所以固化成测试：
//   · JLPT 必须取「最高级别」，不能取最新或最高分（N2 180不该盖过 N1 100）
//   · 英语必须「按类型分别取最高」，绝不能跨类型比大小（IELTS 7.5 与 TOEIC 800 不可比）
//   · EJU 总分必须实时计算，不能盲信可能过时的 totalScore 存量字段

import { describe, it, expect } from 'vitest';
import {
  calcEjuTotal,
  pickBestJlpt, formatJlptSummary,
  pickBestEju, formatEjuSummary,
  pickBestEnglishByType, formatEnglishSummary,
  getScoreDisplay, groupScoresByYear,
} from '../utils/scoreDisplayUtils';

describe('calcEjuTotal', () => {
  it('理科：日语 + 数学 + 物化生', () => {
    expect(calcEjuTotal({ japanese: 300, math: 180, physics: 90, chemistry: 85 })).toBe(655);
  });

  it('文科：日语 + 数学 + 文综', () => {
    expect(calcEjuTotal({ japanese: 320, math: 150, generalSubjects: 170 })).toBe(640);
  });

  it('记述分不计入总分', () => {
    expect(calcEjuTotal({ japanese: 300, descriptive: 50, math: 100 })).toBe(400);
  });

  it('兼容旧 science 字段（无物化生时才启用）', () => {
    expect(calcEjuTotal({ japanese: 300, math: 100, science: 160 })).toBe(560);
    // 新字段存在时忽略旧字段，避免重复累加
    expect(calcEjuTotal({ japanese: 300, math: 100, physics: 90, science: 160 })).toBe(490);
  });

  it('非法值按 0 处理，不产生 NaN', () => {
    expect(calcEjuTotal({ japanese: 'abc', math: null, physics: undefined })).toBe(0);
    expect(calcEjuTotal(null)).toBe(0);
  });
});

describe('pickBestJlpt', () => {
  it('取最高级别，而不是最高分', () => {
    const best = pickBestJlpt([
      { date: '2025-07', level: 'N2', score: 180 },
      { date: '2025-12', level: 'N1', score: 100 },
    ]);
    expect(best.level).toBe('N1');
    expect(best.score).toBe(100);
  });

  it('同级别取最高分', () => {
    const best = pickBestJlpt([
      { date: '2024-12', level: 'N1', score: 120 },
      { date: '2025-07', level: 'N1', score: 155 },
    ]);
    expect(best.score).toBe(155);
  });

  it('空数组返回 null', () => {
    expect(pickBestJlpt([])).toBeNull();
    expect(pickBestJlpt(undefined)).toBeNull();
  });

  it('摘要格式为「级别 分数」', () => {
    expect(formatJlptSummary([{ level: 'N1', score: 160 }])).toBe('N1 160');
    // 只有级别没分数时不应出现悬空数字
    expect(formatJlptSummary([{ level: 'N2', score: '' }])).toBe('N2');
  });
});

describe('pickBestEju', () => {
  it('取总分最高的一次', () => {
    const best = pickBestEju([
      { date: '2025-06', japanese: 280, math: 150, generalSubjects: 150 }, // 580
      { date: '2025-11', japanese: 320, math: 170, generalSubjects: 160 }, // 650
    ]);
    expect(best._total).toBe(650);
    expect(best.date).toBe('2025-11');
  });

  it('实时重算总分，不盲信过时的 totalScore', () => {
    const best = pickBestEju([{ japanese: 300, math: 100, totalScore: 999 }]);
    expect(best._total).toBe(400);
  });

  it('各科全空时回退到存量 totalScore（兼容早期只存总分的数据）', () => {
    const best = pickBestEju([{ date: '2023-06', totalScore: 610 }]);
    expect(best._total).toBe(610);
  });

  it('摘要含总分与日语分', () => {
    expect(formatEjuSummary([{ japanese: 320, math: 170, generalSubjects: 160 }]))
      .toBe('650（日 320）');
  });
});

describe('pickBestEnglishByType', () => {
  it('按类型分别取最高分，不跨类型比较', () => {
    const list = pickBestEnglishByType([
      { date: '2025-03-01', type: 'TOEIC', score: 800 },
      { date: '2025-05-01', type: 'IELTS', score: 7.5 },
      { date: '2025-08-01', type: 'IELTS', score: 6.5 },
    ]);
    expect(list).toHaveLength(2);
    const ielts = list.find(x => x.type === 'IELTS');
    const toeic = list.find(x => x.type === 'TOEIC');
    // IELTS 取7.5（同类型最高），而不是被TOEIC 800 这个不可比的数字压掉
    expect(Number(ielts.score)).toBe(7.5);
    expect(Number(toeic.score)).toBe(800);
  });

  it('单一类型时摘要不带 +N 后缀', () => {
    expect(formatEnglishSummary([{ type: 'TOEFL', score: 95 }])).toBe('TOEFL 95');
  });

  it('多类型时摘要提示还有几项', () => {
    const summary = formatEnglishSummary([
      { type: 'TOEFL', score: 95 },
      { type: 'IELTS', score: 7 },
    ]);
    expect(summary).toMatch(/\+1$/);
  });

  it('缺失type 时归入「其他」而不是丢弃', () => {
    const list = pickBestEnglishByType([{ score: 700 }]);
    expect(list).toHaveLength(1);
    expect(list[0].type).toBe('其他');
  });
});

describe('getScoreDisplay', () => {
  const student = {
    jlptScores: [{ date: '2025-07', level: 'N1', score: 160 }],
    ejuScores: [{ date: '2025-11', japanese: 320, math: 170, generalSubjects: 160 }],
    englishScores: [{ date: '2025-05-01', type: 'TOEFL', score: 95 }],
  };

  it('三类成绩都能给出摘要与历史', () => {
    expect(getScoreDisplay(student, 'jlpt').summary).toBe('N1 160');
    expect(getScoreDisplay(student, 'eju').summary).toBe('650（日 320）');
    expect(getScoreDisplay(student, 'english').summary).toBe('TOEFL 95');
    expect(getScoreDisplay(student, 'jlpt').history).toContain('N1');
    expect(getScoreDisplay(student, 'eju').history).toContain('总分 650');
  });

  it('数组为空但存在旧单值字段时，回退显示旧值', () => {
    expect(getScoreDisplay({ jlptScores: [], jlptScore: 'N2-140' }, 'jlpt').summary).toBe('N2 140');
    expect(getScoreDisplay({ englishScores: [], englishScore: 'TOEIC 780' }, 'english').summary).toBe('TOEIC 780');
  });

  it('完全无数据时返回空字符串而不是抛错', () => {
    expect(getScoreDisplay({}, 'jlpt').summary).toBe('');
    expect(getScoreDisplay(null, 'eju').summary).toBe('');
  });
});

// ─── 【新需求108】按年度分组（问号浮窗的数据源）──────────────────────────────
describe('groupScoresByYear', () => {
  it('JLPT 按年份分组，年份降序（最近的排前面）', () => {
    const groups = groupScoresByYear({
      jlptScores: [
        { date: '2024-07', level: 'N3', score: 100 },
        { date: '2025-12', level: 'N1', score: 160 },
        { date: '2025-07', level: 'N2', score: 140 },
      ],
    }, 'jlpt');
    expect(groups.map(g => g.year)).toEqual(['2025', '2024']);
    // 年内也按时间倒序：12月 排在 07月 之前
    expect(groups[0].items.map(i => i.when)).toEqual(['12月', '07月']);
    expect(groups[0].items[0].main).toBe('N1 160 分');
  });

  it('EJU 的各科分项进入 detail，总分进 main', () => {
    const groups = groupScoresByYear({
      ejuScores: [{ date: '2025-11', japanese: 320, math: 170, generalSubjects: 160 }],
    }, 'eju');
    expect(groups[0].items[0].main).toBe('总分 650');
    expect(groups[0].items[0].detail).toContain('日语 320');
    expect(groups[0].items[0].detail).toContain('文综 160');
  });

  it('英语按 YYYY-MM-DD 显示到日', () => {
    const groups = groupScoresByYear({
      englishScores: [{ date: '2025-05-18', type: 'TOEFL', score: 95 }],
    }, 'english');
    expect(groups[0].year).toBe('2025');
    expect(groups[0].items[0].when).toBe('05-18');
    expect(groups[0].items[0].main).toContain('TOEFL');
  });

  it('日期缺失的记录归入「年份未填」并排在最后，分数不丢', () => {
    const groups = groupScoresByYear({
      jlptScores: [
        { date: '', level: 'N2', score: 130 },
        { date: '2025-07', level: 'N1', score: 150 },
      ],
    }, 'jlpt');
    expect(groups[groups.length - 1].year).toBe('年份未填');
    expect(groups[groups.length - 1].items[0].main).toBe('N2 130 分');
  });

  it('只有旧单值字段时仍能给出一条明细（不能让浮窗空着）', () => {
    const groups = groupScoresByYear({ jlptScores: [], jlptScore: 'N2-140' }, 'jlpt');
    expect(groups).toHaveLength(1);
    expect(groups[0].items[0].main).toBe('N2 140');
  });

  it('无任何成绩时返回空数组（组件据此不渲染问号）', () => {
    expect(groupScoresByYear({}, 'jlpt')).toEqual([]);
    expect(groupScoresByYear({ ejuScores: [] }, 'eju')).toEqual([]);
    expect(groupScoresByYear(null, 'english')).toEqual([]);
  });

  it('未填分数不显示为 0 分（与 toNum 的空值修复保持一致）', () => {
    const groups = groupScoresByYear({
      jlptScores: [{ date: '2025-07', level: 'N2', score: '' }],
    }, 'jlpt');
    expect(groups[0].items[0].main).toBe('N2');
  });
});

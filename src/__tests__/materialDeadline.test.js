//【新需求111 第2项】材料默认截止日推算的口径测试
//
// 这套口径决定"老师不填截止日时，材料到底落在哪一天"，算错会让学生：
//   · 太晚 → 出愿截止当天才准备，来不及（就是本需求要修的旧 bug）
//   · 太早 → 刚创建就逾期，污染每日待办
// 所以逐条固化边界。前后端是两份实现，用例刻意保持一致，便于交叉核对。

import { describe, it, expect } from 'vitest';
import {
  MATERIAL_LEAD_DAYS, normalizeDay, shiftDay,
  computeMaterialDeadline, resolveMaterialDeadline, describeDefaultMaterialDeadline,
} from '../utils/materialDeadline';

describe('normalizeDay / shiftDay', () => {
  it('归一常见写法', () => {
    expect(normalizeDay('2026-9-5')).toBe('2026-09-05');
    expect(normalizeDay('2026-09-05T00:00:00Z')).toBe('2026-09-05');
    expect(normalizeDay('2026-09-11~2026-10-10')).toBe('2026-09-11'); // 区间取起始日
    expect(normalizeDay('')).toBe('');
    expect(normalizeDay(null)).toBe('');
  });

  it('丢弃不存在的日期（如 2 月 31 日）', () => {
    expect(normalizeDay('2026-02-31')).toBe('');
    expect(normalizeDay('2026-13-01')).toBe('');
    expect(normalizeDay('2026-00-10')).toBe('');
  });

  it('跨月跨年加减天数正确', () => {
    expect(shiftDay('2026-09-14', -14)).toBe('2026-08-31');
    expect(shiftDay('2026-01-05', -14)).toBe('2025-12-22');
    expect(shiftDay('2026-02-28', 1)).toBe('2026-03-01'); // 2026 非闰年
  });

  it('提前量常量是 14 天', () => {
    expect(MATERIAL_LEAD_DAYS).toBe(14);
  });
});

describe('computeMaterialDeadline —— 出愿截止前两周（带夹逼）', () => {
  // 固定"今天" = 2026-08-01，让所有断言可复现
  const NOW = new Date(2026, 7, 1, 9, 0, 0);

  it('常规情况：出愿截止充裕时，取截止前 14 天', () => {
    expect(computeMaterialDeadline('2026-10-01', NOW)).toBe('2026-09-17');
  });

  it('距截止不足两周：不早于今天（避免造出刚建就逾期的材料）', () => {
    // 出愿截止 2026-08-10，减 14 天是 2026-07-27（已过），应夹到今天 08-01
    expect(computeMaterialDeadline('2026-08-10', NOW)).toBe('2026-08-01');
  });

  it('恰好距截止 14 天：等于今天', () => {
    expect(computeMaterialDeadline('2026-08-15', NOW)).toBe('2026-08-01');
  });

  it('距截止 15 天：比今天晚一天', () => {
    expect(computeMaterialDeadline('2026-08-16', NOW)).toBe('2026-08-02');
  });

  it('历史学校（出愿截止已过）：夹回出愿截止日，不晚于它', () => {
    // 截止 2026-07-20 已过；base 更早，max(base,今天)=今天 08-01 > 截止 → 夹回 07-20
    expect(computeMaterialDeadline('2026-07-20', NOW)).toBe('2026-07-20');
  });

  it('出愿截止当天就是今天：结果就是今天', () => {
    expect(computeMaterialDeadline('2026-08-01', NOW)).toBe('2026-08-01');
  });

  it('出愿截止缺失或不可解析：返回空串', () => {
    expect(computeMaterialDeadline('', NOW)).toBe('');
    expect(computeMaterialDeadline(null, NOW)).toBe('');
    expect(computeMaterialDeadline('待定', NOW)).toBe('');
  });

  it('区间格式出愿期：按起始日推算', () => {
    // 起始 2026-10-01，减 14 天 = 2026-09-17
    expect(computeMaterialDeadline('2026-10-01~2026-10-31', NOW)).toBe('2026-09-17');
  });
});

describe('resolveMaterialDeadline —— 落库决策', () => {
  const NOW = new Date(2026, 7, 1, 9, 0, 0);

  it('手填优先，原样返回', () => {
    expect(resolveMaterialDeadline('2026-09-30', '2026-10-01', NOW)).toBe('2026-09-30');
  });

  it('手填空白字符串视为未填，走推算', () => {
    expect(resolveMaterialDeadline('   ', '2026-10-01', NOW)).toBe('2026-09-17');
  });

  it('留空 → 出愿截止前两周', () => {
    expect(resolveMaterialDeadline('', '2026-10-01', NOW)).toBe('2026-09-17');
    expect(resolveMaterialDeadline(null, '2026-10-01', NOW)).toBe('2026-09-17');
  });

  it('留空且出愿截止也缺失 → null（不凭空造日期）', () => {
    expect(resolveMaterialDeadline('', '', NOW)).toBeNull();
    expect(resolveMaterialDeadline(null, null, NOW)).toBeNull();
  });
});

describe('describeDefaultMaterialDeadline —— 表单提示文案', () => {
  const NOW = new Date(2026, 7, 1, 9, 0, 0);

  it('充裕：提示两周前的具体日期', () => {
    expect(describeDefaultMaterialDeadline('2026-10-01', NOW)).toContain('2026-09-17');
    expect(describeDefaultMaterialDeadline('2026-10-01', NOW)).toContain('出愿截止前两周');
  });

  it('临近：提示为今天且说明原因', () => {
    const msg = describeDefaultMaterialDeadline('2026-08-10', NOW);
    expect(msg).toContain('今天');
    expect(msg).toContain('不足两周');
  });

  it('已过：提示回落到出愿截止日', () => {
    const msg = describeDefaultMaterialDeadline('2026-07-20', NOW);
    expect(msg).toContain('出愿截止日');
  });

  it('出愿截止未填：无提示', () => {
    expect(describeDefaultMaterialDeadline('', NOW)).toBe('');
  });
});

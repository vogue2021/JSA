//【新需求111 第2项】Workers 侧材料默认截止日验证脚本
//
// workers/ 没有接测试框架，这里用可独立运行的断言脚本代替：
//   node workers/src/utils/materialDeadline.test.js
//
// 目的：确保后端这份实现与前端 src/utils/materialDeadline.js 口径一致
// （两处是同一逻辑的两份拷贝，必须交叉核对）。
// 注意：后端 todayStr 用 UTC，为让断言可复现，这里传入的 now 都用 Date.UTC 构造。

import assert from 'node:assert';
import {
  MATERIAL_LEAD_DAYS, normalizeDay, shiftDay,
  computeMaterialDeadline, resolveMaterialDeadline,
} from './materialDeadline.js';

let pass = 0, fail = 0;
function t(label, fn) {
  try { fn(); console.log(`  ✅ ${label}`); pass++; }
  catch (e) { console.log(`  ❌ ${label} —— ${e.message}`); fail++; }
}

// 固定"今天" = 2026-08-01（UTC）
const NOW = new Date(Date.UTC(2026, 7, 1, 3, 0, 0));

console.log('\n═══ 需求111 材料默认截止日（Workers 侧）═══\n');

t('提前量常量 14', () => assert.strictEqual(MATERIAL_LEAD_DAYS, 14));

t('normalizeDay 归一 + 区间取起始日', () => {
  assert.strictEqual(normalizeDay('2026-9-5'), '2026-09-05');
  assert.strictEqual(normalizeDay('2026-09-11~2026-10-10'), '2026-09-11');
  assert.strictEqual(normalizeDay('2026-02-31'), ''); // 不存在的日期
  assert.strictEqual(normalizeDay(''), '');
});

t('shiftDay 跨月', () => {
  assert.strictEqual(shiftDay('2026-09-14', -14), '2026-08-31');
  assert.strictEqual(shiftDay('2026-01-05', -14), '2025-12-22');
});

t('常规：出愿截止前 14 天', () => {
  assert.strictEqual(computeMaterialDeadline('2026-10-01', NOW), '2026-09-17');
});

t('临近（<14天）：不早于今天', () => {
  assert.strictEqual(computeMaterialDeadline('2026-08-10', NOW), '2026-08-01');
});

t('恰好 14 天 = 今天', () => {
  assert.strictEqual(computeMaterialDeadline('2026-08-15', NOW), '2026-08-01');
});

t('15 天 = 明天', () => {
  assert.strictEqual(computeMaterialDeadline('2026-08-16', NOW), '2026-08-02');
});

t('历史学校（出愿截止已过）：夹回出愿截止日', () => {
  assert.strictEqual(computeMaterialDeadline('2026-07-20', NOW), '2026-07-20');
});

t('出愿截止缺失 → 空串', () => {
  assert.strictEqual(computeMaterialDeadline('', NOW), '');
  assert.strictEqual(computeMaterialDeadline(null, NOW), '');
});

t('resolveMaterialDeadline：手填优先', () => {
  assert.strictEqual(resolveMaterialDeadline('2026-09-30', '2026-10-01', NOW), '2026-09-30');
});

t('resolveMaterialDeadline：留空走推算', () => {
  assert.strictEqual(resolveMaterialDeadline('', '2026-10-01', NOW), '2026-09-17');
  assert.strictEqual(resolveMaterialDeadline('   ', '2026-10-01', NOW), '2026-09-17');
});

t('resolveMaterialDeadline：都缺失 → null（不凭空造）', () => {
  assert.strictEqual(resolveMaterialDeadline('', '', NOW), null);
  assert.strictEqual(resolveMaterialDeadline(null, null, NOW), null);
});

console.log(`\n═══ 结果：${pass} 通过 / ${fail} 失败 ═══\n`);
process.exit(fail === 0 ? 0 : 1);

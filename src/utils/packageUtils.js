/**
 * 套餐名称工具（新需求81）
 *
 * 套餐重命名规则：
 *   校内考专家 1+2     → 校内考专家 1
 *   校内考专家 1+2+3   → 校内考专家 1+2
 *   丁老师规划 1+2     → 丁老师规划 1
 *   丁老师规划 1+2+3   → 丁老师规划 1+2
 *   私塾 / VIP        不变
 *
 * 数据库中存储的统一为「新名称」（normalizePackageName 会把旧值转成新值），
 * 而展示时会附加括号备注「（原 旧名）」让用户清楚改名前的称呼。
 */

// 新套餐选项（下拉框使用）
export const PACKAGE_OPTIONS = [
  '私塾',
  '校内考专家 1',
  '校内考专家 1+2',
  '丁老师规划 1',
  '丁老师规划 1+2',
  'VIP',
];

// 旧值 → 新值（用于读取后归一化）
const OLD_TO_NEW_MAP = {
  '校内考专家 1+2': '校内考专家 1',
  '校内考专家 1+2+3': '校内考专家 1+2',
  '丁老师规划 1+2': '丁老师规划 1',
  '丁老师规划 1+2+3': '丁老师规划 1+2',
};

// 新值 → 旧值（用于显示括号备注）
const NEW_TO_OLD_MAP = {
  '校内考专家 1': '1+2',
  '校内考专家 1+2': '1+2+3',
  '丁老师规划 1': '1+2',
  '丁老师规划 1+2': '1+2+3',
};

/**
 * 把任意（含历史）套餐值归一化到新名称，便于保存与比较。
 */
export function normalizePackageName(name) {
  if (!name) return '';
  return OLD_TO_NEW_MAP[name] || name;
}

/**
 * 用于 UI 展示的套餐显示名：
 *  - 新名带历史备注：校内考专家 1（原 1+2）
 *  - 私塾/VIP/未知值：原样返回
 */
export function getPackageDisplayName(name) {
  if (!name) return '';
  const normalized = normalizePackageName(name);
  const oldSuffix = NEW_TO_OLD_MAP[normalized];
  return oldSuffix ? `${normalized}（原 ${oldSuffix}）` : normalized;
}

/**
 * 下拉框选项（{ value, label }），label 含括号备注，value 为新名称。
 */
export function getPackageSelectOptions() {
  return PACKAGE_OPTIONS.map(opt => ({
    value: opt,
    label: getPackageDisplayName(opt),
  }));
}

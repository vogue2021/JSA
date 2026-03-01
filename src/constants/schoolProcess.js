/**
 * 学部升学流程枚举字典
 * 统一定义学部入试流程中的状态、事件类型等枚举值
 * 所有组件应从此文件引用，避免硬编码散落各处
 */

// ─── 志愿学校申请状态 ─────────────────────────────────────────────────────────
// 学部入试流程：未开始 → 准备中 → 出愿完成 → 邮寄完成 → 合格 / 未合格
export const SCHOOL_STATUS = {
  NOT_STARTED: 'not_started', // 未开始：尚未开始准备
  PREPARING: 'preparing',     // 准备中：收集材料、备考阶段
  APPLIED: 'applied',         // 出愿完成：已提交出愿书
  SUBMITTED: 'submitted',     // 邮寄完成：材料全部邮寄完毕
  ADMITTED: 'admitted',       // 合格：收到合格通知
  REJECTED: 'rejected',       // 未合格：收到不合格通知
};

export const SCHOOL_STATUS_LABELS = {
  [SCHOOL_STATUS.NOT_STARTED]: '未开始',
  [SCHOOL_STATUS.PREPARING]: '准备中',
  [SCHOOL_STATUS.APPLIED]: '出愿完成',
  [SCHOOL_STATUS.SUBMITTED]: '邮寄完成',
  [SCHOOL_STATUS.ADMITTED]: '合格',
  [SCHOOL_STATUS.REJECTED]: '未合格',
};

// ─── 时间线事件类型 ───────────────────────────────────────────────────────────
export const EVENT_TYPE = {
  EXAM: 'exam',           // 校内考（笔试/小论文）
  DEADLINE: 'deadline',   // 出愿截止
  INTERVIEW: 'interview', // 面试
  DOCUMENT: 'document',   // 材料准备（志望理由书等）
  OTHER: 'other',         // 其他
};

export const EVENT_TYPE_LABELS = {
  [EVENT_TYPE.EXAM]: '校内考',
  [EVENT_TYPE.DEADLINE]: '出愿截止',
  [EVENT_TYPE.INTERVIEW]: '面试',
  [EVENT_TYPE.DOCUMENT]: '材料准备',
  [EVENT_TYPE.OTHER]: '其他',
};

// ─── 文理科 ───────────────────────────────────────────────────────────────────
// 枚举值直接使用中文，与 AppContext 默认数据保持一致
export const SUBJECT_TYPE = {
  LIBERAL: '文科',
  SCIENCE: '理科',
};

export const SUBJECT_TYPE_LABELS = {
  [SUBJECT_TYPE.LIBERAL]: '文科',
  [SUBJECT_TYPE.SCIENCE]: '理科',
};

// ─── 老师部门 ─────────────────────────────────────────────────────────────────
export const DEPARTMENT = {
  ACADEMIC: '学部升学组',   // 负责升学指导
  STUDENT_AFFAIRS: '学管',  // 负责学生日常管理
  ACADEMIC_AFFAIRS: '教务', // 负责教务管理
  OTHER: '其他',
};

export const DEPARTMENT_LIST = [
  DEPARTMENT.ACADEMIC,
  DEPARTMENT.STUDENT_AFFAIRS,
  DEPARTMENT.ACADEMIC_AFFAIRS,
  DEPARTMENT.OTHER,
];

// ─── 反馈类型 ─────────────────────────────────────────────────────────────────
export const FEEDBACK_TYPE = {
  SUGGESTION: 'suggestion', // 功能建议
  BUG: 'bug',               // 错误报告
  OTHER: 'other',           // 其他
};

export const FEEDBACK_TYPE_LABELS = {
  [FEEDBACK_TYPE.SUGGESTION]: '功能建议',
  [FEEDBACK_TYPE.BUG]: '错误报告',
  [FEEDBACK_TYPE.OTHER]: '其他',
};

export const FEEDBACK_STATUS = {
  PENDING: 'pending',     // 待处理
  REVIEWED: 'reviewed',   // 已查看
  RESOLVED: 'resolved',   // 已解决
};

export const FEEDBACK_STATUS_LABELS = {
  [FEEDBACK_STATUS.PENDING]: '待处理',
  [FEEDBACK_STATUS.REVIEWED]: '已查看',
  [FEEDBACK_STATUS.RESOLVED]: '已解决',
};

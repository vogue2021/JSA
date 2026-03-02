/**
 * 日志服务 - 记录用户操作行为和系统事件
 * 数据存储在 localStorage 中
 */

const LOG_STORAGE_KEY = 'systemLogs';
const MAX_LOGS = 500; // 最多保存500条日志

// 日志级别
export const LOG_LEVELS = {
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  ACTION: 'action',
};

// 日志类别
export const LOG_CATEGORIES = {
  AUTH: '认证',
  STUDENT: '学生管理',
  TEACHER: '老师管理',
  SCHOOL: '学校管理',
  EVENT: '事件管理',
  MATERIAL: '材料管理',
  SYSTEM: '系统',
  SETTINGS: '设置',
  DATA: '数据操作',
};

/**
 * 获取所有日志
 */
export function getLogs() {
  try {
    const saved = localStorage.getItem(LOG_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

/**
 * 添加一条日志
 * @param {string} level - 日志级别
 * @param {string} category - 日志类别
 * @param {string} message - 日志消息
 * @param {object} [details] - 额外详情
 */
export function addLog(level, category, message, details = null) {
  try {
    const logs = getLogs();
    const newLog = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      details,
      // 从 localStorage 获取当前用户信息
      user: getCurrentUserInfo(),
    };

    logs.unshift(newLog); // 最新的在前面

    // 限制日志数量
    if (logs.length > MAX_LOGS) {
      logs.length = MAX_LOGS;
    }

    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
    return newLog;
  } catch (e) {
    console.error('添加日志失败:', e);
  }
}

/**
 * 获取当前用户信息
 */
function getCurrentUserInfo() {
  try {
    const saved = sessionStorage.getItem('user');
    if (saved) {
      const user = JSON.parse(saved);
      return {
        name: user.name,
        role: user.role,
        email: user.email,
      };
    }
  } catch {}
  return { name: '未知', role: '未知', email: '' };
}

/**
 * 清空所有日志
 */
export function clearLogs() {
  localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify([]));
}

/**
 * 按条件过滤日志
 * @param {object} filters - { level, category, search, dateFrom, dateTo }
 */
export function filterLogs(filters = {}) {
  let logs = getLogs();

  if (filters.level && filters.level !== 'all') {
    logs = logs.filter(l => l.level === filters.level);
  }
  if (filters.category && filters.category !== 'all') {
    logs = logs.filter(l => l.category === filters.category);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    logs = logs.filter(l =>
      l.message.toLowerCase().includes(q) ||
      l.user?.name?.toLowerCase().includes(q) ||
      l.category?.toLowerCase().includes(q)
    );
  }
  if (filters.dateFrom) {
    logs = logs.filter(l => l.timestamp >= filters.dateFrom);
  }
  if (filters.dateTo) {
    const to = new Date(filters.dateTo);
    to.setDate(to.getDate() + 1);
    logs = logs.filter(l => l.timestamp < to.toISOString());
  }

  return logs;
}

// === 便捷方法 ===

export function logAction(category, message, details) {
  return addLog(LOG_LEVELS.ACTION, category, message, details);
}

export function logInfo(category, message, details) {
  return addLog(LOG_LEVELS.INFO, category, message, details);
}

export function logWarn(category, message, details) {
  return addLog(LOG_LEVELS.WARN, category, message, details);
}

export function logError(category, message, details) {
  return addLog(LOG_LEVELS.ERROR, category, message, details);
}

export default {
  getLogs,
  addLog,
  clearLogs,
  filterLogs,
  logAction,
  logInfo,
  logWarn,
  logError,
  LOG_LEVELS,
  LOG_CATEGORIES,
};

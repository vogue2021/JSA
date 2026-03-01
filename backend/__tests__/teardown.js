/**
 * Jest 全局 Teardown
 * 在所有测试结束后清理资源
 */
module.exports = async () => {
  // 关闭数据库连接（防止 Jest 挂起）
  try {
    const db = require('../config/db');
    await db.destroy();
  } catch (e) { /* 忽略 */ }
};

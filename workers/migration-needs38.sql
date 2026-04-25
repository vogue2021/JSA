-- 新需求38 数据库迁移脚本：塾内备考资料库
-- 执行命令（仅 staging）：
--   cd workers && npx wrangler d1 execute jsa-db-staging --file=./migration-needs38.sql --remote --env staging
-- 若想在本地 D1 先验证：
--   cd workers && npx wrangler d1 execute jsa-db-staging --file=./migration-needs38.sql --local
--
-- 字段说明：
--   id          ：主键
--   title       ：资料标题
--   content     ：Markdown 内容（老师在线编辑）
--   category    ：分类标签（例如 EJU、日语、留学生试验、面试等；自由文本）
--   tags        ：JSON 字符串数组，自由标签（可为空 '[]'）
--   is_public   ：1 = 公开（学生可见）；0 = 私密（仅老师/管理员可见）
--   author_id   ：创建者 user_id（关联 users.id）
--   author_name ：快照：创建者姓名（列表展示用，避免每次 join）
--   updated_by  ：最近一次更新人 user_id
--   updated_by_name ：最近一次更新人姓名快照
--   created_at / updated_at：时间戳

CREATE TABLE IF NOT EXISTS study_resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  is_public INTEGER NOT NULL DEFAULT 0,
  author_id TEXT,
  author_name TEXT DEFAULT '',
  updated_by TEXT,
  updated_by_name TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_study_resources_is_public ON study_resources(is_public);
CREATE INDEX IF NOT EXISTS idx_study_resources_category ON study_resources(category);
CREATE INDEX IF NOT EXISTS idx_study_resources_updated_at ON study_resources(updated_at DESC);

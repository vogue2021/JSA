-- 新需求41 生产环境合并迁移：塾内备考资料库
-- 合并 needs38（建表）+ needs39（新增 resource_type / url / description 字段）
-- 直接用最终字段集建表，避免 ALTER 语法在生产上的兼容性问题
--
-- 执行命令（生产）：
--   cd workers && npx wrangler d1 execute jsa-db --file=./migration-needs41-prod-study-resources.sql --remote
--
-- 字段说明：
--   id             : 主键
--   title          : 资料标题
--   content        : Markdown 内容（老师在线编辑，resource_type='markdown' 时使用）
--   category       : 分类标签（EJU、日语、留学生试验、面试等，自由文本）
--   tags           : JSON 字符串数组，自由标签（可为空 '[]'）
--   is_public      : 1 = 公开（学生可见）；0 = 私密（仅老师/管理员）
--   author_id      : 创建者 user_id
--   author_name    : 创建者姓名快照
--   updated_by     : 最近一次更新人 user_id
--   updated_by_name: 最近一次更新人姓名快照
--   resource_type  : 'markdown'（在线编辑）| 'link'（外链）
--   url            : 外链地址（仅 link 类型使用）
--   description    : 链接的简要说明
--   created_at / updated_at: 时间戳

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
  resource_type TEXT NOT NULL DEFAULT 'markdown',
  url TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_study_resources_is_public ON study_resources(is_public);
CREATE INDEX IF NOT EXISTS idx_study_resources_category ON study_resources(category);
CREATE INDEX IF NOT EXISTS idx_study_resources_updated_at ON study_resources(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_resources_type ON study_resources(resource_type);

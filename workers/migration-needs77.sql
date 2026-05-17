-- 【新需求77】站内消息发布系统 migration
-- 功能：管理员/有 publish_messages 权限的老师可发布消息，
--       消息按 audience 投递给学生/老师/所有人，显示在时间线顶部，
--       支持 Markdown 富文本 + R2 图片，并提供"已读/未读"标记。
--
-- 应用方式：
--   生产： npx wrangler d1 execute jsa-db --file=migration-needs77.sql --remote
--   测试： npx wrangler d1 execute jsa-db-staging --env staging --file=migration-needs77.sql --remote

-- 1. 消息主表
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  -- 内容类型：markdown / html（前端按类型渲染）
  content_type TEXT NOT NULL DEFAULT 'markdown' CHECK(content_type IN ('markdown','html')),
  -- 发布对象：student / teacher / all（admin 永远能看到全部）
  audience TEXT NOT NULL DEFAULT 'all' CHECK(audience IN ('student','teacher','all')),
  -- 发布者信息（保留作者名称便于后续作者账号被删时仍可显示）
  author_id TEXT NOT NULL DEFAULT '',
  author_name TEXT NOT NULL DEFAULT '',
  author_role TEXT NOT NULL DEFAULT '',
  -- 图片 URL 列表（JSON 数组），便于后续追踪/清理 R2 资源
  image_urls TEXT NOT NULL DEFAULT '[]',
  -- 是否置顶：1 = 置顶展示在横幅最前
  pinned INTEGER NOT NULL DEFAULT 0,
  -- 是否撤回：撤回后用户端横幅 / 列表都会过滤掉，但管理员仍可在历史里看到
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 2. 已读记录表（每用户对每条消息一行）
CREATE TABLE IF NOT EXISTS message_reads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  read_at TEXT DEFAULT (datetime('now')),
  UNIQUE(message_id, user_id)
);

-- 3. 索引
CREATE INDEX IF NOT EXISTS idx_messages_audience_revoked ON messages(audience, revoked);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_reads_user ON message_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_message_reads_msg ON message_reads(message_id);

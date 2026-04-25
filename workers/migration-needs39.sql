-- 新需求39 数据库迁移脚本：扩展塾内备考资料库以支持 URL 链接资料
-- 执行命令（仅 staging）：
--   cd workers && npx wrangler d1 execute jsa-db-staging --file=./migration-needs39.sql --remote
--
-- 新增字段：
--   resource_type ：资料类型 'markdown'（在线编辑）| 'link'（外链）。默认 'markdown'，兼容历史数据
--   url           ：外链地址（仅 link 类型使用；markdown 类型为空）
--   description   ：链接类型的简要说明（可选）
--
-- 注意：D1/SQLite 不支持 IF NOT EXISTS for ADD COLUMN。
--       本迁移在原始建表语句尚未包含这些字段时执行；如果已经执行过一次，第二次会报错，可忽略。

ALTER TABLE study_resources ADD COLUMN resource_type TEXT NOT NULL DEFAULT 'markdown';
ALTER TABLE study_resources ADD COLUMN url TEXT NOT NULL DEFAULT '';
ALTER TABLE study_resources ADD COLUMN description TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_study_resources_type ON study_resources(resource_type);

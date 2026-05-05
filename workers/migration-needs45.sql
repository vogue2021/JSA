-- 新需求45 数据库迁移脚本：扩展 schools 表以支持一审/二审/自定义日期字段
-- 执行命令（仅 staging）：
--   cd workers && npx wrangler d1 execute jsa-db-staging --file=./migration-needs45.sql --remote
--
-- 新增字段：
--   extra_dates ：JSON 字符串，结构 { firstExamDate, firstResultDate, secondExamDate, secondResultDate, customDates: [{label,date}] }
--                  用于存储学校信息库/学校页面【添加新学校】表单中新增的一审/二审/发表时间，
--                  以及用户自由添加的自定义日期字段。
--                  默认 '{}' 兼容历史数据。
--
-- 注意：D1/SQLite 不支持 IF NOT EXISTS for ADD COLUMN；若已执行过一次，第二次会报错，可忽略。

ALTER TABLE schools ADD COLUMN extra_dates TEXT NOT NULL DEFAULT '{}';

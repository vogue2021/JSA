-- 【新需求84】修复学生信息页"目标学位"修改后刷新回退到"修士"的 bug
-- 根因：students 表缺少 target_level 列，后端 formatStudent / PUT updatable 都不识别该字段，
--      前端 PUT body 也没传该字段，导致目标学位永远未持久化，刷新后回退到前端默认值 '修士'。
-- 本迁移：仅给 students 表添加 target_level 列（默认 '修士'，与前端兜底一致）。
--
-- 应用方式（幂等，已存在则失败但不影响）：
--   测试： npx wrangler d1 execute jsa-db-staging --env staging --file=migration-needs84.sql --remote
--   生产： npx wrangler d1 execute jsa-db --file=migration-needs84.sql --remote
--
-- 注意：SQLite 不支持 IF NOT EXISTS 用于 ADD COLUMN，重复执行会报错"duplicate column"，可忽略。

ALTER TABLE students ADD COLUMN target_level TEXT DEFAULT '修士';

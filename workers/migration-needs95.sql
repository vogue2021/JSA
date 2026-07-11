-- 【新需求95】在学校信息库增加"高才加分校"字段
-- 目的：学生/老师可标记该学校为"高才加分校"，前端支持按钮开关 + 筛选 + 显示徽章，
--       方便学生在申请志愿学校时快速识别、选择加分校。
--
-- 应用方式（幂等，重复执行会因"duplicate column"报错，可忽略）：
--   测试： npx wrangler d1 execute jsa-db-staging --env staging --file=migration-needs95.sql --remote
--   生产： npx wrangler d1 execute jsa-db --file=migration-needs95.sql --remote
--
-- 注意：SQLite 不支持 IF NOT EXISTS 用于 ADD COLUMN，重复执行会报"duplicate column"，可忽略。

ALTER TABLE school_database ADD COLUMN is_talent_bonus INTEGER DEFAULT 0;

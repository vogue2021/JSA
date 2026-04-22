-- 迁移脚本：为明学义塾定制新增学生字段
-- 执行方式：
--   本地/staging:  npx wrangler d1 execute jsa-db --env staging --file=./migrate-mingxue-fields.sql --remote
--   生产:          npx wrangler d1 execute jsa-db --file=./migrate-mingxue-fields.sql --remote
-- D1 不支持 IF NOT EXISTS 的 ADD COLUMN，这里使用 SQLite 兼容的顺序添加。
-- 如果某列已存在，请将对应行注释掉后再执行。

ALTER TABLE students ADD COLUMN mingxue_id TEXT DEFAULT '';
ALTER TABLE students ADD COLUMN region TEXT DEFAULT '';
ALTER TABLE students ADD COLUMN emergency_contact_name TEXT DEFAULT '';
ALTER TABLE students ADD COLUMN emergency_contact_phone TEXT DEFAULT '';
ALTER TABLE students ADD COLUMN emergency_contact_relation TEXT DEFAULT '';
ALTER TABLE students ADD COLUMN passport_no TEXT DEFAULT '';
ALTER TABLE students ADD COLUMN residence_card_no TEXT DEFAULT '';

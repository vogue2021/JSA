-- 新需求27 数据库迁移脚本
-- 执行命令（staging）：
--   npx wrangler d1 execute jsa-db --file=./migration-needs27.sql --remote
-- 如需在本地 D1 执行：
--   npx wrangler d1 execute jsa-db --file=./migration-needs27.sql --local
--
-- 说明：SQLite/D1 不支持 IF NOT EXISTS 子句用于 ALTER TABLE ADD COLUMN；
--   如果字段已存在，D1 会返回错误但不影响数据。本脚本可安全重复执行
--   （已存在的列会报错跳过），建议用 wrangler 的 --json 输出观察。

-- ── 需求27.1：学校信息库 — 募集要项年度更新状态 ──────────────────────────────
-- requirements_year        ：当前募集要项所参考的年度（如 '2026' 或 '2025（沿用去年）'）
-- requirements_updated     ：0 = 未更新（沿用去年），1 = 已更新到最新年度
-- requirements_updated_at  ：最后更新日期（YYYY-MM-DD）
ALTER TABLE school_database ADD COLUMN requirements_year TEXT DEFAULT '';
ALTER TABLE school_database ADD COLUMN requirements_updated INTEGER DEFAULT 0;
ALTER TABLE school_database ADD COLUMN requirements_updated_at TEXT DEFAULT '';

-- ── 需求27.2：学生信息 — 中国高中学籍与海外认证 ──────────────────────────────
-- has_china_high_school_record：是否有中国高中学籍
--   '' = 未填 / 'yes' = 有 / 'no' = 无 / 'unsure' = 不确定
-- overseas_certifications      ：可开具的海外认证（JSON 字符串数组）
--   可选值：'Cognia', 'WASC', 'CIS', 'NEASC/MSA', 'COBIS/BSO', 'IB'
ALTER TABLE students ADD COLUMN has_china_high_school_record TEXT DEFAULT '';
ALTER TABLE students ADD COLUMN overseas_certifications TEXT DEFAULT '[]';

-- ═══════════════════════════════════════════════════════════════════════════
-- 【新需求106】数据库迁移
--
-- 变更内容：
--   1. students 新增 score_none_flags 列 —— "确认无相关成绩"标记
--      JSON 结构：{"jlpt":true,"eju":true,"english":true}（只存true，false 直接省略）
--      作用：把"还没录成绩"和"确认没有这项成绩"区分开，
--            监管台成绩列因此有了第三态「无」，不再一律显示红叉。
--
--   2. 目标学位默认值 '修士' → '学部'
--      SQLite 不支持 ALTER COLUMN 改默认值，因此**不动已有列定义**，
--      仅靠应用层兜底（students.js formatStudent / POST 均已改为 '学部'）。
--      schema.sql 已同步更新，供将来重建库时使用。
--      ⚠️ 已存在的学生记录一律不动 —— 他们的 target_level 是历史真实选择，
--         不能因为默认值调整而被批量改写。
--
-- 执行方式：
--   cd workers
--   npx wrangler d1 execute jsa-db-staging --remote --file=./migration-needs106.sql
--   npx wrangler d1 execute jsa-db         --remote --file=./migration-needs106.sql
--
-- ⚠️ 关于重复执行：
--   wrangler 的 --file 会把整个文件当**一个批次**跑。若STEP 1 因列已存在而报
--   "duplicate column name: score_none_flags"，则该批次会整体中止，
--   后面的 STEP 2/3 都不会执行。这属于预期行为 —— 说明迁移此前已经成功过一次，
--   无需处理。若想单独复验，请用 --command 逐条执行 STEP 2 / STEP 3。
--
-- 验证是否已生效（比 PRAGMA 更可靠，PRAGMA 在 --json 模式下偶有截断）：
--   npx wrangler d1 execute jsa-db --remote --command \
--     "SELECT sql FROM sqlite_master WHERE type='table' AND name='students'"
--   输出的建表语句里应能看到 score_none_flags。
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── STEP 1：新增"确认无相关成绩"标记列 ─────────────────────────────────────
ALTER TABLE students ADD COLUMN score_none_flags TEXT DEFAULT '{}';

-- ─── STEP 2：把历史 NULL 归一为 '{}'，避免前端 JSON.parse(null) 分支 ─────────
-- （新增列已带DEFAULT '{}'，这一条是给"曾手工建过该列但没设默认值"的库兜底）
UPDATE students SET score_none_flags = '{}'
WHERE score_none_flags IS NULL OR TRIM(score_none_flags) = '';

-- ─── STEP 3（只读）：自检───────────────────────────────────────────────────
-- flags_null应为 0；target_level 分布仅用于人工确认历史数据未被改写。
SELECT
  (SELECT COUNT(*) FROM students WHERE score_none_flags IS NULL OR TRIM(score_none_flags) = '') AS flags_null,
  (SELECT COUNT(*) FROM students WHERE target_level = '学部') AS level_gakubu,
  (SELECT COUNT(*) FROM students WHERE target_level = '修士') AS level_shushi,
  (SELECT COUNT(*) FROM students WHERE target_level = '博士') AS level_hakushi,
  (SELECT COUNT(*) FROM students WHERE target_level IS NULL OR TRIM(target_level) = '') AS level_empty;

-- ═══════════════════════════════════════════════════════════════════════════
-- 【新需求105】清理"账号已删除但 students 行残留"的孤儿学生数据
--
-- 背景 / 根因：
--   创建学生账号的两条主要路径都没有回写 users.student_id：
--     - workers/src/routes/students.js  POST  → INSERT INTO users (id, email, password, role, name)
--     - workers/src/routes/auth.js      注册  → INSERT INTO users (id, email, password, role, name)
--   而 DELETE /api/users/:id 的级联清理原先以 `if (target.student_id)` 为入口条件，
--   于是这类账号被删除时级联一次都没执行：users 行被删掉了，students 行却留下来
--   且 is_active 仍为 1 → 学生列表 / 学生信息页照旧显示该学生（如"金亨锡"）。
--
--代码侧已在需求105 中修复（反查兜底 + 列表接口孤儿过滤 + 中间件拒绝已删账号的旧 token），
--   本脚本负责把**库里已经产生的脏数据**清理干净。
--
-- 安全性说明：
--   -只清理 `user_id有值` 但在 users 表里查不到的记录
--   - `user_id IS NULL / ''` 的记录是"未开通账号的学生"（has_account = 0），属于合法数据，
--     脚本绝不会碰它们
--   - users.id 是 PRIMARY KEY，不会有 NULL，因此 NOT IN 子查询不存在 NULL 陷阱
--   - 所有语句可重复执行（幂等）
--
-- 执行方式：
--   # 1) 先在 staging 上跑，确认无误后再上生产
--   cd workers
--   npx wrangler d1 execute jsa-db-staging --remote --file=./migration-needs105-cleanup-orphan-students.sql
--   # 2) 生产
--   npx wrangler d1 execute jsa-db --remote --file=./migration-needs105-cleanup-orphan-students.sql
--
--   ⚠️ 强烈建议执行前先做一次导出备份：
--   npx wrangler d1 export jsa-db --remote --output=./backup-before-needs105.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── STEP 1（只读）：先看看会清掉哪些学生 ───────────────────────────────────
-- 建议单独执行这一条确认名单后，再执行下面的 DELETE：
--   npx wrangler d1 execute jsa-db --remote --command "SELECT student_id, name, user_id, is_active FROM students WHERE user_id IS NOT NULL AND user_id != '' AND user_id NOT IN (SELECT id FROM users);"

-- ─── STEP 2：清理孤儿学生的关联数据（必须先删子表）───────────────────────────
DELETE FROM events
WHERE student_id IN (
  SELECT student_id FROM students
  WHERE user_id IS NOT NULL AND user_id != '' AND user_id NOT IN (SELECT id FROM users)
);

DELETE FROM materials
WHERE student_id IN (
  SELECT student_id FROM students
  WHERE user_id IS NOT NULL AND user_id != '' AND user_id NOT IN (SELECT id FROM users)
);

DELETE FROM schools
WHERE student_id IN (
  SELECT student_id FROM students
  WHERE user_id IS NOT NULL AND user_id != '' AND user_id NOT IN (SELECT id FROM users)
);

DELETE FROM deadline_reminders
WHERE student_id IN (
  SELECT student_id FROM students
  WHERE user_id IS NOT NULL AND user_id != '' AND user_id NOT IN (SELECT id FROM users)
);

-- ─── STEP 3：删除孤儿学生本体 ───────────────────────────────────────────────
DELETE FROM students
WHERE user_id IS NOT NULL
  AND user_id != ''
  AND user_id NOT IN (SELECT id FROM users);

-- ─── STEP 4：顺带清理"学生本体早已不存在"的残留子表数据 ─────────────────────
-- 覆盖历史上部分删除失败 / 手工删表留下的悬空记录。
-- student_id 为 NULL 的行不受影响（NOT IN 对 NULL 返回 NULL，不会被删）。
DELETE FROM events            WHERE student_id NOT IN (SELECT student_id FROM students);
DELETE FROM materials         WHERE student_id NOT IN (SELECT student_id FROM students);
DELETE FROM schools           WHERE student_id NOT IN (SELECT student_id FROM students);
DELETE FROM deadline_reminders WHERE student_id NOT IN (SELECT student_id FROM students);

-- ─── STEP 5（只读）：清理后自检，应全部返回 0 ───────────────────────────────
SELECT
  (SELECT COUNT(*) FROM students
     WHERE user_id IS NOT NULL AND user_id != '' AND user_id NOT IN (SELECT id FROM users)) AS orphan_students,
  (SELECT COUNT(*) FROM events            WHERE student_id NOT IN (SELECT student_id FROM students)) AS orphan_events,
  (SELECT COUNT(*) FROM materials         WHERE student_id NOT IN (SELECT student_id FROM students)) AS orphan_materials,
  (SELECT COUNT(*) FROM schools           WHERE student_id NOT IN (SELECT student_id FROM students)) AS orphan_schools,
  (SELECT COUNT(*) FROM deadline_reminders WHERE student_id NOT IN (SELECT student_id FROM students)) AS orphan_reminders;

-- 新需求82：套餐字段重命名为完整字符串（消除新旧名字面冲突）
-- 把 students.package_name 中所有历史/中间态值统一更新为新版完整字符串。
--
-- 重命名规则：
--   '校内考专家 1+2'   → '校内考专家 1（原 1+2）'
--   '校内考专家 1+2+3' → '校内考专家 1+2（原 1+2+3）'
--   '丁老师规划 1+2'   → '丁老师规划 1（原 1+2）'
--   '丁老师规划 1+2+3' → '丁老师规划 1+2（原 1+2+3）'
--   私塾 / VIP        不变
--
-- 注意执行顺序：先把"更长的"旧名（含 1+2+3）迁好，
-- 再迁"较短的"旧名（含 1+2），避免误伤刚被部分替换出的中间态。
-- （SQLite 的 UPDATE WHERE = 是精确匹配，无 LIKE 模糊问题，但仍按从长到短顺序保险。）
-- D1 不支持 BEGIN TRANSACTION/COMMIT，每条 UPDATE 自动单语句事务。

-- 1. 先迁 1+2+3 系列（避免被 1+2 子串误伤——事实上 = 精确匹配不会，但保持习惯）
UPDATE students SET package_name = '校内考专家 1+2（原 1+2+3）'
  WHERE package_name = '校内考专家 1+2+3';

UPDATE students SET package_name = '丁老师规划 1+2（原 1+2+3）'
  WHERE package_name = '丁老师规划 1+2+3';

-- 2. 再迁 1+2 系列（原始旧名）
UPDATE students SET package_name = '校内考专家 1（原 1+2）'
  WHERE package_name = '校内考专家 1+2';

UPDATE students SET package_name = '丁老师规划 1（原 1+2）'
  WHERE package_name = '丁老师规划 1+2';

-- 3. 兼容上一轮 81 错误归一化产生的中间值（如果有学生在 81 部署后保存过资料）
UPDATE students SET package_name = '校内考专家 1（原 1+2）'
  WHERE package_name = '校内考专家 1';

UPDATE students SET package_name = '丁老师规划 1（原 1+2）'
  WHERE package_name = '丁老师规划 1';

-- 验证（执行后可手动跑一下）：
-- SELECT DISTINCT package_name FROM students ORDER BY package_name;

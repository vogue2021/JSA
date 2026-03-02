-- JSA D1 数据库测试数据初始化
-- 密码使用 PBKDF2(SHA-256, 100000次迭代, 固定salt) 哈希

-- ─── 用户表 ───────────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO users (id, email, password, role, name, teacher_id) VALUES
  ('admin1', 'admin@jsa.com', 'AQIDBAUGBwgJCgsMDQ4PEEZm5ZYsIqIh3Im6/POBAtNLpZndwlJnFDsEmjINp5Qz', 'admin', '系统管理员', NULL);

INSERT OR IGNORE INTO users (id, email, password, role, name, teacher_id) VALUES
  ('teacher1', 'wang@school.com', 'AQIDBAUGBwgJCgsMDQ4PEMhUtpQbtFjp4Zkrwc1AsS6Rxf3+deH/J2wEQxqnFSmL', 'teacher', '王老师', 'teacher_1'),
  ('teacher2', 'li@school.com', 'AQIDBAUGBwgJCgsMDQ4PENkXykH6bkwQUAEKux/blwgF2OcLxIknLHk17LkNh+dK', 'teacher', '李老师', 'teacher_2'),
  ('teacher3', 'zhang@school.com', 'AQIDBAUGBwgJCgsMDQ4PEKOlmKU+csPK4b0074RwsDk4L25eqIUVFW5wI/GyiTXd', 'teacher', '张老师', 'teacher_3'),
  ('teacher4', 'chen@school.com', 'AQIDBAUGBwgJCgsMDQ4PEHlnlh6MbCLypQzuddXiKicYHy88MWAeEgoGIaSTD8lu', 'teacher', '陈老师', 'teacher_4'),
  ('teacher5', 'zhao@school.com', 'AQIDBAUGBwgJCgsMDQ4PEJE3kmkzQasUXld87anxFZQk9T/TS4Ai59wJ7hMa38E/', 'teacher', '赵老师', 'teacher_5'),
  ('teacher6', 'gao@school.com', 'AQIDBAUGBwgJCgsMDQ4PEEbGI6aZXC+gfJsV7t8Tm8Cw3dvR9Njub5LvRKZVtgyv', 'teacher', '高老师（学管）', 'teacher_6'),
  ('teacher7', 'lin@school.com', 'AQIDBAUGBwgJCgsMDQ4PENoUsUuWRstotKqSyNYYl2B9Tej+gofk3rQFjgANdO8U', 'teacher', '林老师（学管）', 'teacher_7');

INSERT OR IGNORE INTO users (id, email, password, role, name, student_id) VALUES
  ('student1', 'zhangsan@student.jsa.com', 'AQIDBAUGBwgJCgsMDQ4PEFhLpErYAI/UYpm1tGXuIosoe8/aehZMmXZA3toB8Ayk', 'student', '张三', '2024001'),
  ('student2', 'lisi@student.jsa.com', 'AQIDBAUGBwgJCgsMDQ4PEBJSoK1NEcAAldKhsDuKDeKBYujMrIk18FHPQQc/3zbO', 'student', '李四', '2024002'),
  ('student3', 'wangwu@student.jsa.com', 'AQIDBAUGBwgJCgsMDQ4PEDqVBnFLs3CnkI2RiPLlHHci9/3b97aogzzZF5kMl5xG', 'student', '王五', '2024003');

-- ─── 老师扩展信息表 ─────────────────────────────────────────────────────────
INSERT OR IGNORE INTO teachers (teacher_id, user_id, department, subject) VALUES
  ('teacher_1', 'teacher1', '学部升学组', '理科'),
  ('teacher_2', 'teacher2', '学部升学组', '文科'),
  ('teacher_3', 'teacher3', '学部升学组', '理科'),
  ('teacher_4', 'teacher4', '教务', ''),
  ('teacher_5', 'teacher5', '学部升学组', '文科'),
  ('teacher_6', 'teacher6', '学管', ''),
  ('teacher_7', 'teacher7', '学管', '');

-- ─── 学生扩展信息表 ────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO students (student_id, user_id, name, email, teacher_id, academic_advisor_id, birthday, high_school, language_school, jlpt_score, eju_scores, english_score, package_name, package_end_date, tags, subject, has_account) VALUES
  ('2024001', 'student1', '张三', 'zhangsan@student.jsa.com', 'teacher_1', 'teacher_6', '2001-05-12', '北京十一中学', '东京日本语学院', 'N1-142', '[{"date":"2025-06","japanese":310,"math":170,"science":145,"total":625}]', 'TOEFL 85', '私塾', '2026-06-30', '["理科","重点关注"]', '理科', 1),
  ('2024002', 'student2', '李四', 'lisi@student.jsa.com', 'teacher_1', 'teacher_6', '2002-01-20', '上海外国语学校', '大阪日本语学校', 'N2-120', '[]', '', '校内考专家 1+2', '2026-03-31', '["文科"]', '文科', 1),
  ('2024003', 'student3', '王五', 'wangwu@student.jsa.com', 'teacher_2', 'teacher_7', '2000-11-03', '广州执信中学', '京都国际学院', 'N1-158', '[{"date":"2025-06","japanese":340,"math":190,"science":160,"total":690}]', 'TOEIC 780', '丁老师规划 1+2+3', '2027-03-31', '["理科","优秀学生"]', '理科', 1),
  ('2024004', NULL, '赵六', '', 'teacher_2', 'teacher_7', '2001-08-15', '成都七中', '名古屋日本语学院', 'N2-105', '[{"date":"2025-06","japanese":280,"math":120,"science":0,"total":400}]', '', '校内考专家 1+2+3', '2026-09-30', '["文科","需加强"]', '文科', 0),
  ('2024005', NULL, '刘七', '', 'teacher_3', 'teacher_6', '2000-03-28', '杭州学军中学', '早稻田日本语学校', 'N1-170', '[{"date":"2025-06","japanese":355,"math":195,"science":170,"total":720}]', 'TOEFL 95', '丁老师规划 1+2', '2026-08-31', '["理科","优秀学生","即将毕业"]', '理科', 0),
  ('2024006', NULL, '孙八', '', 'teacher_1', '', '2003-06-10', '武汉外国语学校', '横滨国际学院', 'N3', '[]', '', '', '', '["文科","新生"]', '文科', 0),
  ('2024007', NULL, '周九', '', 'teacher_4', 'teacher_7', '2001-12-25', '深圳实验学校', '东京外语学院', 'N1-135', '[{"date":"2025-06","japanese":320,"math":165,"science":140,"total":625}]', 'IELTS 6.5', '私塾', '2026-05-31', '["理科"]', '理科', 0),
  ('2024008', NULL, '吴十', '', 'teacher_4', '', '2003-09-01', '南京外国语学校', '神户日本语学校', '', '[]', '', '校内考专家 1+2', '2026-12-31', '["文科","新生","需加强"]', '文科', 0),
  ('2024009', NULL, '郑十一', '', 'teacher_2', 'teacher_6', '1999-07-14', '重庆南开中学', '大阪国际学院', 'N1-165', '[{"date":"2025-06","japanese":350,"math":185,"science":165,"total":700}]', 'TOEFL 100', '丁老师规划 1+2+3', '2025-12-31', '["理科","已合格"]', '理科', 0),
  ('2024010', NULL, '冯十二', '', 'teacher_5', 'teacher_7', '2002-04-22', '天津南开中学', '东京中央日本语学校', 'N2-115', '[{"date":"2025-06","japanese":290,"math":0,"science":0,"total":290}]', 'TOEIC 650', '私塾', '2026-04-30', '["文科"]', '文科', 0),
  ('2024011', NULL, '陈十三', '', 'teacher_3', '', '2002-10-08', '西安高新一中', '京都文化日本语学校', 'N2-98', '[]', '', '', '', '["理科","新生"]', '理科', 0),
  ('2024012', NULL, '林十四', '', '', '', '2003-02-14', '厦门外国语学校', '', '', '[]', '', '', '', '[]', '', 0);

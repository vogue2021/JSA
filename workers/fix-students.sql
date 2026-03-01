-- 修复 students 表：去掉外键约束，user_id 改为 TEXT 类型
DROP TABLE IF EXISTS students;

CREATE TABLE students (
  student_id TEXT PRIMARY KEY,
  user_id TEXT,
  name TEXT NOT NULL,
  email TEXT DEFAULT '',
  teacher_id TEXT DEFAULT '',
  academic_advisor_id TEXT DEFAULT '',
  has_account INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  birthday TEXT DEFAULT '',
  high_school TEXT DEFAULT '',
  language_school TEXT DEFAULT '',
  jlpt_score TEXT DEFAULT '',
  english_score TEXT DEFAULT '',
  eju_scores TEXT DEFAULT '[]',
  follow_up_notes TEXT DEFAULT '',
  photo TEXT DEFAULT '',
  package_name TEXT DEFAULT '',
  package_end_date TEXT DEFAULT '',
  subject TEXT DEFAULT '',
  tags TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_students_student_id ON students(student_id);
CREATE INDEX IF NOT EXISTS idx_students_teacher_id ON students(teacher_id);
CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);

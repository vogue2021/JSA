-- JSA D1 数据库初始化 SQL（与生产环境 schema 同步）
-- 最后更新: 2026-03-02
-- 在 Cloudflare D1 控制台或通过 wrangler 执行

-- 1. 用户表
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'teacher', 'student')),
  name TEXT NOT NULL,
  student_id TEXT,
  teacher_id TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 2. 学生表
CREATE TABLE IF NOT EXISTS students (
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

-- 3. 老师表
CREATE TABLE IF NOT EXISTS teachers (
  teacher_id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department TEXT DEFAULT '',
  subject TEXT DEFAULT '',
  permissions TEXT DEFAULT '[]',
  gender TEXT DEFAULT '',
  birthday TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email_contact TEXT DEFAULT '',
  address TEXT DEFAULT '',
  education TEXT DEFAULT '',
  hire_date TEXT DEFAULT '',
  employment_type TEXT DEFAULT '',
  photo TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

-- 4. 学校申请表
CREATE TABLE IF NOT EXISTS schools (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_ja TEXT DEFAULT '',
  type TEXT NOT NULL CHECK(type IN ('国立','公立','私立')),
  program TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'not_started' CHECK(status IN ('not_started','preparing','applied','submitted','admitted','rejected')),
  application_start_date TEXT,
  application_end_date TEXT,
  exam_date TEXT,
  result_date TEXT,
  requirements_url TEXT DEFAULT '',
  teacher_notes TEXT DEFAULT '',
  difficulty TEXT DEFAULT '',
  ranking INTEGER DEFAULT 0,
  location TEXT DEFAULT '',
  website TEXT DEFAULT '',
  xuexin_cert TEXT DEFAULT '不确定',
  overseas_cert TEXT DEFAULT '不确定',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 5. 学校信息库（公共）
CREATE TABLE IF NOT EXISTS school_database (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_ja TEXT DEFAULT '',
  type TEXT NOT NULL CHECK(type IN ('国立','公立','私立')),
  location TEXT DEFAULT '',
  programs TEXT DEFAULT '[]',
  requirements TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  acceptance_rate TEXT DEFAULT '',
  difficulty TEXT DEFAULT '',
  ranking INTEGER DEFAULT 0,
  xuexin_cert TEXT DEFAULT '不确定',
  overseas_cert TEXT DEFAULT '不确定',
  important_dates TEXT DEFAULT '[]',
  requirements_url TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 6. 事件表
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  school_id INTEGER REFERENCES schools(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK(type IN ('exam','deadline','interview','document','other')),
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  days_left INTEGER DEFAULT 0,
  category TEXT DEFAULT '',
  urgent INTEGER NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 7. 材料表
CREATE TABLE IF NOT EXISTS materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('general','school')),
  deadline TEXT,
  url TEXT DEFAULT '',
  completed INTEGER NOT NULL DEFAULT 0,
  checked_by TEXT DEFAULT '',
  checked_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 8. 反馈表
CREATE TABLE IF NOT EXISTS feedbacks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL DEFAULT 'suggestion',
  content TEXT NOT NULL,
  contact TEXT DEFAULT '',
  user_name TEXT DEFAULT '',
  user_id TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 9. 验证码表
CREATE TABLE IF NOT EXISTS verification_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  verified INTEGER NOT NULL DEFAULT 0,
  last_sent_at INTEGER,
  ip TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

-- 10. 审计日志表
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT,
  user_id INTEGER,
  user_name TEXT DEFAULT '',
  user_role TEXT DEFAULT '',
  method TEXT NOT NULL,
  route TEXT NOT NULL,
  status INTEGER NOT NULL,
  ip TEXT DEFAULT '',
  body_summary TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

-- 11. 索引
CREATE INDEX IF NOT EXISTS idx_students_student_id ON students(student_id);
CREATE INDEX IF NOT EXISTS idx_students_teacher_id ON students(teacher_id);
CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);
CREATE INDEX IF NOT EXISTS idx_teachers_user_id ON teachers(user_id);
CREATE INDEX IF NOT EXISTS idx_schools_student_id ON schools(student_id);
CREATE INDEX IF NOT EXISTS idx_schools_status ON schools(status);
CREATE INDEX IF NOT EXISTS idx_events_student_id ON events(student_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_events_urgent ON events(urgent);
CREATE INDEX IF NOT EXISTS idx_materials_student_id ON materials(student_id);
CREATE INDEX IF NOT EXISTS idx_materials_school_id ON materials(school_id);
CREATE INDEX IF NOT EXISTS idx_materials_type ON materials(type);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_user_time ON audit_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_route_time ON audit_logs(route, created_at);

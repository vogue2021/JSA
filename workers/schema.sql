-- JSA D1 数据库初始化 SQL
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

-- 2. 学生表（扩展信息）
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT UNIQUE NOT NULL,
  user_id TEXT,
  name TEXT NOT NULL,
  email TEXT,
  teacher_id TEXT,
  academic_advisor_id TEXT,
  birthday TEXT,
  high_school TEXT,
  language_school TEXT,
  jlpt_score TEXT,
  eju_scores TEXT DEFAULT '[]',
  english_score TEXT,
  follow_up_notes TEXT DEFAULT '',
  photo TEXT DEFAULT '',
  package_name TEXT DEFAULT '',
  package_end_date TEXT DEFAULT '',
  tags TEXT DEFAULT '[]',
  subject TEXT DEFAULT '',
  has_account INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 3. 学校申请表
CREATE TABLE IF NOT EXISTS schools (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  name TEXT NOT NULL,
  name_ja TEXT DEFAULT '',
  type TEXT NOT NULL,
  program TEXT NOT NULL,
  status TEXT DEFAULT 'preparing',
  application_start_date TEXT,
  application_end_date TEXT,
  exam_date TEXT,
  result_date TEXT,
  requirements_url TEXT DEFAULT '',
  teacher_notes TEXT DEFAULT '',
  materials TEXT DEFAULT '[]',
  location TEXT DEFAULT '',
  acceptance_rate TEXT DEFAULT '',
  requirements TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 4. 事件表
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  school_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  days_left INTEGER DEFAULT 0,
  category TEXT NOT NULL,
  urgent INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  completed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 5. 材料表
CREATE TABLE IF NOT EXISTS materials (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  school_id TEXT,
  item TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('general', 'school')),
  deadline TEXT,
  url TEXT DEFAULT '',
  completed INTEGER DEFAULT 0,
  checked_by TEXT,
  checked_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 6. 反馈表
CREATE TABLE IF NOT EXISTS feedbacks (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  contact TEXT,
  user_name TEXT DEFAULT '匿名',
  user_id TEXT,
  status TEXT DEFAULT 'pending',
  admin_note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 7. 验证码表
CREATE TABLE IF NOT EXISTS verification_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER DEFAULT 0,
  verified INTEGER DEFAULT 0,
  last_sent_at INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 8. 索引
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_students_student_id ON students(student_id);
CREATE INDEX IF NOT EXISTS idx_students_teacher_id ON students(teacher_id);
CREATE INDEX IF NOT EXISTS idx_schools_student_id ON schools(student_id);
CREATE INDEX IF NOT EXISTS idx_events_student_id ON events(student_id);
CREATE INDEX IF NOT EXISTS idx_materials_student_id ON materials(student_id);
CREATE INDEX IF NOT EXISTS idx_verification_codes_email ON verification_codes(email);

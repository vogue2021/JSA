-- JSA D1 数据库初始化 SQL（与生产环境 schema 同步）
-- 最后更新: 2026-03-10
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
  mingxue_id TEXT,
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
  -- 【新需求68】顾问老师 ID（与升学/学管老师并列的第三个老师身份）
  consultant_id TEXT DEFAULT '',
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
  phone TEXT DEFAULT '',
  lang_school_shift TEXT DEFAULT '',
  jlpt_scores TEXT DEFAULT '[]',
  english_scores TEXT DEFAULT '[]',
  xuebang_id TEXT DEFAULT '',
  has_china_high_school_record TEXT DEFAULT '',
  overseas_certifications TEXT DEFAULT '[]',
  -- 【新需求84】目标学位（学部/修士/博士），默认 '修士' 与前端兜底一致
  target_level TEXT DEFAULT '修士',
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
  requirements TEXT DEFAULT '',
  teacher_notes TEXT DEFAULT '',
  difficulty TEXT DEFAULT '',
  ranking INTEGER DEFAULT 0,
  location TEXT DEFAULT '',
  website TEXT DEFAULT '',
  xuexin_cert TEXT DEFAULT '不确定',
  overseas_cert TEXT DEFAULT '不确定',
  -- 【新需求45】一审/二审/发表时间 + 自定义日期字段，JSON 存储
  extra_dates TEXT NOT NULL DEFAULT '{}',
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
  required_materials TEXT DEFAULT '[]',
  requirements_year TEXT DEFAULT '',
  requirements_updated INTEGER DEFAULT 0,
  requirements_updated_at TEXT DEFAULT '',
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

-- 11. 截止日期提醒表
CREATE TABLE IF NOT EXISTS deadline_reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL REFERENCES students(student_id),
  event_id INTEGER,
  event_title TEXT NOT NULL,
  deadline_date TEXT NOT NULL,
  acknowledged INTEGER NOT NULL DEFAULT 0,
  acknowledged_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 12. 学邦同步日志表
CREATE TABLE IF NOT EXISTS xuebang_sync_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  synced_count INTEGER DEFAULT 0,
  result TEXT DEFAULT '',
  message TEXT DEFAULT '',
  synced_at TEXT DEFAULT (datetime('now'))
);

-- 13. 索引
CREATE INDEX IF NOT EXISTS idx_students_student_id ON students(student_id);
CREATE INDEX IF NOT EXISTS idx_students_teacher_id ON students(teacher_id);
CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);
CREATE INDEX IF NOT EXISTS idx_students_consultant_id ON students(consultant_id);
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
CREATE INDEX IF NOT EXISTS idx_students_xuebang_id ON students(xuebang_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_mingxue_id ON users(mingxue_id) WHERE mingxue_id IS NOT NULL;

-- 14. 站内消息发布系统（新需求77）
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  content_type TEXT NOT NULL DEFAULT 'markdown' CHECK(content_type IN ('markdown','html')),
  audience TEXT NOT NULL DEFAULT 'all' CHECK(audience IN ('student','teacher','all')),
  author_id TEXT NOT NULL DEFAULT '',
  author_name TEXT NOT NULL DEFAULT '',
  author_role TEXT NOT NULL DEFAULT '',
  image_urls TEXT NOT NULL DEFAULT '[]',
  pinned INTEGER NOT NULL DEFAULT 0,
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS message_reads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  read_at TEXT DEFAULT (datetime('now')),
  UNIQUE(message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_audience_revoked ON messages(audience, revoked);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_reads_user ON message_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_message_reads_msg ON message_reads(message_id);

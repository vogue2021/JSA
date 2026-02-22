-- Japan Study Abroad Application Database Schema
-- 日本留学考学助手数据库架构

-- Create database
CREATE DATABASE IF NOT EXISTS japan_study_app;
USE japan_study_app;

-- Users table (用户表)
CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('student', 'teacher', 'admin') NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Teachers table (老师表)
CREATE TABLE teachers (
    teacher_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Students table (学生表)
CREATE TABLE students (
    student_id VARCHAR(20) PRIMARY KEY,
    user_id VARCHAR(50),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    teacher_id VARCHAR(50),
    has_account BOOLEAN DEFAULT FALSE,
    target_country VARCHAR(50) DEFAULT '日本',
    target_level ENUM('学部', '修士', '博士') DEFAULT '修士',
    progress INT DEFAULT 0,
    urgent_tasks INT DEFAULT 0,
    avatar VARCHAR(10) DEFAULT '👨‍🎓',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (teacher_id) REFERENCES teachers(teacher_id) ON DELETE SET NULL,
    INDEX idx_teacher (teacher_id),
    INDEX idx_has_account (has_account)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Schools table (学校表)
CREATE TABLE schools (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    type ENUM('国立', '公立', '私立') NOT NULL,
    program VARCHAR(200),
    status ENUM('preparing', 'contacted', 'submitted', 'admitted') DEFAULT 'preparing',
    application_start_date DATE,
    application_end_date DATE,
    exam_date DATE,
    result_date DATE,
    requirements_url TEXT,
    teacher_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    INDEX idx_student (student_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Events table (事件表)
CREATE TABLE events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id VARCHAR(20) NOT NULL,
    school_id INT,
    type ENUM('exam', 'deadline', 'contact', 'document') NOT NULL,
    title VARCHAR(200) NOT NULL,
    date DATE NOT NULL,
    category VARCHAR(50),
    urgent BOOLEAN DEFAULT FALSE,
    notes TEXT,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL,
    INDEX idx_student (student_id),
    INDEX idx_date (date),
    INDEX idx_urgent (urgent)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Materials table (材料表)
CREATE TABLE materials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id VARCHAR(20) NOT NULL,
    school_id INT,
    name VARCHAR(200) NOT NULL,
    type ENUM('general', 'school_specific') NOT NULL,
    deadline DATE,
    url TEXT,
    completed BOOLEAN DEFAULT FALSE,
    checked_by ENUM('student', 'teacher', 'admin'),
    checked_at DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    INDEX idx_student (student_id),
    INDEX idx_school (school_id),
    INDEX idx_type (type),
    INDEX idx_completed (completed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Parent emails table (家长邮箱表)
CREATE TABLE parent_emails (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id VARCHAR(20) NOT NULL,
    email VARCHAR(255) NOT NULL,
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    UNIQUE KEY unique_student_email (student_id, email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Session table (会话表)
CREATE TABLE sessions (
    id VARCHAR(128) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    payload TEXT,
    last_activity INT UNSIGNED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_last_activity (last_activity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default admin account
INSERT INTO users (id, email, password, role, name) VALUES
('admin1', 'admin@jsa.com', '$2y$10$YourHashedPasswordHere', 'admin', '系统管理员');

-- Insert sample teacher accounts
INSERT INTO users (id, email, password, role, name) VALUES
('teacher1', 'wang@school.com', '$2y$10$YourHashedPasswordHere', 'teacher', '王老师'),
('teacher2', 'li@school.com', '$2y$10$YourHashedPasswordHere', 'teacher', '李老师');

INSERT INTO teachers (teacher_id, user_id) VALUES
('teacher_1', 'teacher1'),
('teacher_2', 'teacher2');

-- Insert sample student account
INSERT INTO users (id, email, password, role, name) VALUES
('student1', 'zhangsan@example.com', '$2y$10$YourHashedPasswordHere', 'student', '张三');

INSERT INTO students (student_id, user_id, name, email, teacher_id, has_account) VALUES
('2024001', 'student1', '张三', 'zhangsan@example.com', 'teacher_1', TRUE),
('2024002', NULL, '李四', NULL, 'teacher_1', FALSE),
('2024003', NULL, '王五', NULL, 'teacher_2', FALSE);
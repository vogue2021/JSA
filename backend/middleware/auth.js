// Authentication Middleware
// 认证中间件

const jwt = require('jsonwebtoken');

// Verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: '未提供认证令牌'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: '令牌无效或已过期'
      });
    }
    req.user = user;
    next();
  });
};

// Check if user has required role
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '未认证'
      });
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }

    next();
  };
};

// Check if user is admin
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: '需要管理员权限'
    });
  }
  next();
};

// Check if user is teacher or admin
const requireTeacherOrAdmin = (req, res, next) => {
  if (!req.user || (req.user.role !== 'teacher' && req.user.role !== 'admin')) {
    return res.status(403).json({
      success: false,
      message: '需要老师或管理员权限'
    });
  }
  next();
};

// Check if user can access student data
const canAccessStudent = async (req, res, next) => {
  const { studentId } = req.params;
  const user = req.user;

  if (!user) {
    return res.status(401).json({
      success: false,
      message: '未认证'
    });
  }

  // Admin can access all students
  if (user.role === 'admin') {
    return next();
  }

  // Student can only access their own data
  if (user.role === 'student') {
    if (user.studentId !== studentId) {
      return res.status(403).json({
        success: false,
        message: '无权访问其他学生数据'
      });
    }
    return next();
  }

  // Teacher can only access their assigned students
  if (user.role === 'teacher') {
    const db = require('../config/db');
    const student = await db('students')
      .where({
        student_id: studentId,
        teacher_id: user.teacherId
      })
      .first();

    if (!student) {
      return res.status(403).json({
        success: false,
        message: '无权访问该学生数据'
      });
    }
    return next();
  }

  return res.status(403).json({
    success: false,
    message: '权限不足'
  });
};

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  requireTeacherOrAdmin,
  canAccessStudent
};
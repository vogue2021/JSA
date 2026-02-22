// Authentication Routes
// 认证路由

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { validateLogin, validateRegister } = require('../validators/auth');

// Login endpoint
// 登录接口
router.post('/login', async (req, res) => {
  try {
    // Validate input
    const { error, value } = validateLogin(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { email, password } = value;

    // Find user by email
    const user = await db('users')
      .where({ email })
      .first();

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '邮箱或密码错误'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: '邮箱或密码错误'
      });
    }

    // Get additional user data based on role
    let additionalData = {};
    if (user.role === 'student') {
      const student = await db('students')
        .where({ user_id: user.id })
        .first();
      additionalData = { studentId: student?.student_id };
    } else if (user.role === 'teacher') {
      const teacher = await db('teachers')
        .where({ user_id: user.id })
        .first();
      additionalData = { teacherId: teacher?.teacher_id };
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        ...additionalData
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Save session
    req.session.userId = user.id;
    req.session.userRole = user.role;

    res.json({
      success: true,
      message: '登录成功',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        ...additionalData
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: '登录失败，请稍后再试'
    });
  }
});

// Student registration endpoint
// 学生注册接口
router.post('/register', async (req, res) => {
  try {
    // Validate input
    const { error, value } = validateRegister(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { studentId, email, password, name } = value;

    // Check if student ID exists and is not registered
    const student = await db('students')
      .where({ student_id: studentId })
      .first();

    if (!student) {
      return res.status(400).json({
        success: false,
        message: '学号不存在，请联系管理员'
      });
    }

    if (student.has_account) {
      return res.status(400).json({
        success: false,
        message: '该学号已被注册'
      });
    }

    // Check if email already exists
    const existingUser = await db('users')
      .where({ email })
      .first();

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: '该邮箱已被使用'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user account
    const userId = `student_${Date.now()}`;

    await db.transaction(async (trx) => {
      // Insert user
      await trx('users').insert({
        id: userId,
        email,
        password: hashedPassword,
        role: 'student',
        name: name || student.name
      });

      // Update student record
      await trx('students')
        .where({ student_id: studentId })
        .update({
          user_id: userId,
          email,
          has_account: true,
          updated_at: db.fn.now()
        });
    });

    res.json({
      success: true,
      message: '注册成功'
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: '注册失败，请稍后再试'
    });
  }
});

// Logout endpoint
// 登出接口
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: '登出失败'
      });
    }
    res.json({
      success: true,
      message: '登出成功'
    });
  });
});

// Verify token endpoint
// 验证令牌接口
router.get('/verify', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: '未提供认证令牌'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    res.json({
      success: true,
      user: decoded
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: '令牌无效或已过期'
    });
  }
});

// Change password endpoint
// 修改密码接口
router.post('/change-password', async (req, res) => {
  try {
    const { userId, oldPassword, newPassword } = req.body;

    // Find user
    const user = await db('users')
      .where({ id: userId })
      .first();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // Verify old password
    const isValidPassword = await bcrypt.compare(oldPassword, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: '原密码错误'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await db('users')
      .where({ id: userId })
      .update({
        password: hashedPassword,
        updated_at: db.fn.now()
      });

    res.json({
      success: true,
      message: '密码修改成功'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: '密码修改失败'
    });
  }
});

module.exports = router;
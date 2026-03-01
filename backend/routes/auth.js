// Authentication Routes
// 认证路由

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const db = require('../config/db');
const { validateLogin, validateRegister } = require('../validators/auth');
const { authenticateToken } = require('../middleware/auth');

// ─── 验证码持久化辅助函数（SQLite，替代内存 Map）────────────────────────────
// 清理过期验证码（定期调用，防止表膨胀）
async function cleanExpiredCodes() {
  try {
    await db('verification_codes').where('expires_at', '<', Date.now()).delete();
  } catch (e) { /* 忽略清理失败 */ }
}
// 每小时清理一次（.unref() 确保测试环境下 Jest 可以正常退出）
setInterval(cleanExpiredCodes, 60 * 60 * 1000).unref();

// 邮箱传输器配置
const createTransporter = () => {
  // 如果配置了 SMTP，使用真实邮箱
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }
  // 否则返回 null，使用演示模式
  return null;
};

// 发送验证码邮件接口
router.post('/send-verification', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: '请提供有效的邮箱地址' });
    }

    // ── 频率限制：同一邮箱 60 秒内只能发送一次 ──
    const existing = await db('verification_codes')
      .where({ email })
      .orderBy('created_at', 'desc')
      .first();
    if (existing && existing.last_sent_at && Date.now() - existing.last_sent_at < 60 * 1000) {
      const waitSec = Math.ceil((60 * 1000 - (Date.now() - existing.last_sent_at)) / 1000);
      return res.status(429).json({ success: false, message: `发送过于频繁，请 ${waitSec} 秒后重试` });
    }

    // 生成 6 位数字验证码
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10分钟过期
    const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';

    // 持久化存储验证码（先删除旧记录，再插入新记录）
    await db('verification_codes').where({ email }).delete();
    await db('verification_codes').insert({
      email,
      code,
      expires_at: expiresAt,
      attempts: 0,
      verified: false,
      last_sent_at: Date.now(),
      ip: clientIp,
    });

    // 尝试发送真实邮件
    const transporter = createTransporter();
    if (transporter) {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'JSA 留学助手 <noreply@jsa.com>',
        to: email,
        subject: 'JSA 日本留学助手 - 邮箱验证码',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #4f46e5;">🎓 JSA 日本留学助手</h2>
            <p>您好，您正在注册 JSA 账号，以下是您的邮箱验证码：</p>
            <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center; margin: 16px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #4f46e5;">${code}</span>
            </div>
            <p style="color: #6b7280; font-size: 14px;">验证码 10 分钟内有效，请勿泄露给他人。</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
            <p style="color: #9ca3af; font-size: 12px;">如果这不是您本人的操作，请忽略此邮件。</p>
          </div>
        `,
      });
      console.log(`✉️  验证码邮件已发送至 ${email}`);
      return res.json({ success: true, message: '验证码已发送到您的邮箱', mode: 'email' });
    }

    // 演示模式：无 SMTP 配置，直接返回验证码
    console.log(`📧 [演示模式] 邮箱 ${email} 的验证码: ${code}`);
    return res.json({ success: true, message: '演示模式：验证码已生成', mode: 'demo', demoCode: code });
  } catch (error) {
    console.error('Send verification error:', error);
    res.status(500).json({ success: false, message: '发送验证码失败，请稍后重试' });
  }
});

// 清理过期验证码（启动时执行一次）
cleanExpiredCodes();

// 验证验证码接口
router.post('/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    const record = await db('verification_codes').where({ email }).first();

    if (!record) {
      return res.status(400).json({ success: false, message: '请先获取验证码' });
    }

    if (Date.now() > record.expires_at) {
      await db('verification_codes').where({ email }).delete();
      return res.status(400).json({ success: false, message: '验证码已过期，请重新获取' });
    }

    if (record.attempts >= 5) {
      await db('verification_codes').where({ email }).delete();
      return res.status(400).json({ success: false, message: '验证尝试次数过多，请重新获取验证码' });
    }

    // 递增尝试次数
    await db('verification_codes').where({ email }).update({ attempts: record.attempts + 1 });

    if (record.code !== String(code)) {
      return res.status(400).json({ success: false, message: '验证码错误' });
    }

    // 验证成功，标记已验证
    await db('verification_codes').where({ email }).update({ verified: true });
    res.json({ success: true, message: '邮箱验证成功' });
  } catch (error) {
    console.error('Verify code error:', error);
    res.status(500).json({ success: false, message: '验证失败' });
  }
});

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
      process.env.JWT_SECRET || 'dev-jwt-secret-do-not-use-in-production',
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

    const { studentId, email, password, name, verificationCode } = value;

    // 验证邮箱验证码（从数据库查询）
    const codeRecord = await db('verification_codes').where({ email }).first();
    if (codeRecord) {
      if (!codeRecord.verified) {
        // 有记录但未验证：检查验证码是否匹配
        if (!verificationCode || codeRecord.code !== String(verificationCode)) {
          return res.status(400).json({ success: false, message: '邮箱验证码错误或未验证' });
        }
      }
      // 注册成功后清理验证码记录
      await db('verification_codes').where({ email }).delete();
    }

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
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-jwt-secret-do-not-use-in-production');
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
// 修改密码接口（必须携带有效 JWT，后端从 token 中取 userId，防止越权改密）
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    // 从 JWT 中取 userId，忽略 body 中的 userId 参数（防越权）
    const userId = req.user.id;
    const { oldPassword, newPassword } = req.body;

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
/**
 * 反馈路由
 * 提供反馈提交（公开）和管理员查询/更新（需鉴权）接口
 */
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// ─── 提交反馈（登录用户或匿名均可，不强制鉴权） ───────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { type, content, contact } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: '反馈内容不能为空' });
    }

    const validTypes = ['suggestion', 'bug', 'other'];
    const feedbackType = validTypes.includes(type) ? type : 'suggestion';

    // 尝试从 Authorization header 中解析用户信息（可选）
    let userName = '匿名';
    let userId = null;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-jwt-secret-do-not-use-in-production');
        userName = decoded.name || decoded.email || '匿名';
        userId = decoded.id ? String(decoded.id) : null;
      } catch (_) { /* token 无效时忽略，允许匿名提交 */ }
    }

    const [id] = await db('feedbacks').insert({
      type: feedbackType,
      content: content.trim(),
      contact: contact ? contact.trim() : null,
      user_name: userName,
      user_id: userId,
      status: 'pending',
    });

    res.status(201).json({
      success: true,
      message: '反馈提交成功，感谢您的反馈！',
      id,
    });
  } catch (error) {
    console.error('提交反馈失败:', error);
    res.status(500).json({ success: false, message: '提交失败，请稍后重试' });
  }
});

// ─── 管理员：查询反馈列表（需鉴权 + admin 角色） ──────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '无权限查看反馈记录' });
    }

    const { status, type, page = 1, pageSize = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    let query = db('feedbacks').orderBy('created_at', 'desc');
    if (status) query = query.where({ status });
    if (type) query = query.where({ type });

    const [{ total }] = await query.clone().count('id as total');
    const items = await query.limit(parseInt(pageSize)).offset(offset);

    res.json({
      success: true,
      data: items,
      pagination: {
        total: Number(total),
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(Number(total) / parseInt(pageSize)),
      },
    });
  } catch (error) {
    console.error('查询反馈失败:', error);
    res.status(500).json({ success: false, message: '查询失败' });
  }
});

// ─── 管理员：更新反馈状态/备注（需鉴权 + admin 角色） ────────────────────────
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '无权限操作' });
    }

    const { status, admin_note } = req.body;
    const validStatuses = ['pending', 'reviewed', 'resolved'];
    const updates = {};
    if (status && validStatuses.includes(status)) updates.status = status;
    if (admin_note !== undefined) updates.admin_note = admin_note;
    updates.updated_at = db.fn.now();

    const count = await db('feedbacks').where({ id: req.params.id }).update(updates);
    if (!count) return res.status(404).json({ success: false, message: '反馈记录不存在' });

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新反馈失败:', error);
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

module.exports = router;

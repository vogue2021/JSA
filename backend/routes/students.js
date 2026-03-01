// Students Routes - Enhanced
// 学生路由 - 增强版（含角色权限控制）

const express = require('express');
const router = express.Router();
const db = require('../config/db');

const isAdmin = (user) => user?.role === 'admin';
const isTeacher = (user) => user?.role === 'teacher';
const isStudent = (user) => user?.role === 'student';

// ─── 搜索接口（放在 /:id 前面避免被参数路由遮蔽）─────────────────────────────

// Search students
router.get('/search/query', async (req, res, next) => {
  try {
    if (!isAdmin(req.user) && !isTeacher(req.user)) {
      return res.status(403).json({ success: false, message: '权限不足' });
    }

    const { q, teacher_id } = req.query;
    let query = db('users').where('role', 'student');

    // 老师只能搜索自己的学生
    if (isTeacher(req.user)) {
      query = query.where('teacher_id', req.user.teacherId || '__none__');
    }

    if (q) {
      query = query.where(function () {
        this.where('name', 'like', `%${q}%`)
          .orWhere('email', 'like', `%${q}%`)
          .orWhere('student_id', 'like', `%${q}%`);
      });
    }
    // 管理员可按 teacher_id 筛选
    if (teacher_id && isAdmin(req.user)) {
      query = query.where('teacher_id', teacher_id);
    }

    const students = await query.select('*');
    res.json({ success: true, data: students });
  } catch (error) {
    next(error);
  }
});

// ─── 列表接口 ──────────────────────────────────────────────────────────────

// Get all students
// 管理员可见全部，老师仅可见所带学生，学生仅可见自己
router.get('/', async (req, res, next) => {
  try {
    let query = db('users').where('role', 'student');

    if (isAdmin(req.user)) {
      // 全部可见
    } else if (isTeacher(req.user)) {
      query = query.where('teacher_id', req.user.teacherId || '__none__');
    } else if (isStudent(req.user)) {
      query = query.where('id', req.user.id);
    } else {
      return res.status(403).json({ success: false, message: '权限不足' });
    }

    const students = await query.select('*');
    res.json({ success: true, data: students });
  } catch (error) {
    next(error);
  }
});

// Get students by teacher
// 管理员可查看任意老师的学生，老师仅可查看自己的学生
router.get('/teacher/:teacherId', async (req, res, next) => {
  try {
    const { teacherId } = req.params;

    if (!isAdmin(req.user) && !(isTeacher(req.user) && req.user.teacherId === teacherId)) {
      return res.status(403).json({ success: false, message: '无权查看该老师的学生' });
    }

    const students = await db('users')
      .where('role', 'student')
      .where('teacher_id', teacherId)
      .select('*');
    res.json({ success: true, data: students });
  } catch (error) {
    next(error);
  }
});

// ─── 单个学生接口 ──────────────────────────────────────────────────────────

// Get student by ID with stats
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const student = await db('users').where('id', id).where('role', 'student').first();
    if (!student) {
      return res.status(404).json({ success: false, message: '学生不存在' });
    }

    // 权限校验
    if (isStudent(req.user) && req.user.id !== id) {
      return res.status(403).json({ success: false, message: '无权查看该学生信息' });
    }
    if (isTeacher(req.user) && student.teacher_id !== req.user.teacherId) {
      return res.status(403).json({ success: false, message: '无权查看该学生信息' });
    }

    const studentId = student.student_id;
    const [schoolCount, eventCount, materials] = await Promise.all([
      db('schools').where('student_id', studentId).count('* as count').first(),
      db('events').where('student_id', studentId).where('completed', false).count('* as count').first(),
      db('materials').where('student_id', studentId),
    ]);

    const totalMaterials = materials.length;
    const completedMaterials = materials.filter(m => m.completed).length;

    res.json({
      success: true,
      data: {
        ...student,
        stats: {
          schoolCount: schoolCount?.count || 0,
          pendingEvents: eventCount?.count || 0,
          totalMaterials,
          completedMaterials,
          materialProgress: totalMaterials > 0 ? Math.round(completedMaterials / totalMaterials * 100) : 0
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Update student info
// 管理员可修改任意学生，老师仅可修改自己所带学生（不可修改 teacher_id），学生仅可修改自己的基本信息
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, student_id, teacher_id, is_active } = req.body;

    const student = await db('users').where('id', id).where('role', 'student').first();
    if (!student) {
      return res.status(404).json({ success: false, message: '学生不存在' });
    }

    // 权限校验
    if (isStudent(req.user) && req.user.id !== id) {
      return res.status(403).json({ success: false, message: '无权修改该学生信息' });
    }
    if (isTeacher(req.user) && student.teacher_id !== req.user.teacherId) {
      return res.status(403).json({ success: false, message: '无权修改该学生信息' });
    }

    const updateData = { updated_at: db.fn.now() };
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;

    // 仅管理员可修改 student_id、teacher_id、is_active
    if (isAdmin(req.user)) {
      if (student_id !== undefined) updateData.student_id = student_id;
      if (teacher_id !== undefined) updateData.teacher_id = teacher_id;
      if (is_active !== undefined) updateData.is_active = is_active;
    }

    await db('users').where('id', id).update(updateData);
    const updated = await db('users').where('id', id).first();
    res.json({ success: true, data: updated, message: '学生信息更新成功' });
  } catch (error) {
    next(error);
  }
});

// Delete student (admin only)
// 仅管理员可删除学生
router.delete('/:id', async (req, res, next) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ success: false, message: '仅管理员可删除学生' });
    }

    const { id } = req.params;
    const student = await db('users').where('id', id).where('role', 'student').first();
    if (!student) {
      return res.status(404).json({ success: false, message: '学生不存在' });
    }
    await db('users').where('id', id).delete();
    res.json({ success: true, message: '学生已删除' });
  } catch (error) {
    next(error);
  }
});

// Transfer student to another teacher (admin only)
// 仅管理员可转移学生
router.put('/:id/transfer', async (req, res, next) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ success: false, message: '仅管理员可转移学生' });
    }

    const { id } = req.params;
    const { teacher_id } = req.body;

    if (!teacher_id) {
      return res.status(400).json({ success: false, message: '请指定目标老师ID' });
    }

    const student = await db('users').where('id', id).where('role', 'student').first();
    if (!student) {
      return res.status(404).json({ success: false, message: '学生不存在' });
    }

    await db('users').where('id', id).update({ teacher_id, updated_at: db.fn.now() });
    res.json({ success: true, message: `学生已转移到教师 ${teacher_id}` });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

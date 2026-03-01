// Teachers Routes - Enhanced
// 老师路由 - 增强版（含角色权限控制）

const express = require('express');
const router = express.Router();
const db = require('../config/db');

const isAdmin = (user) => user?.role === 'admin';
const isTeacher = (user) => user?.role === 'teacher';

// Get all teachers
// 管理员可见全部，老师可见全部（仅基本信息），学生无权
router.get('/', async (req, res, next) => {
  try {
    if (!isAdmin(req.user) && !isTeacher(req.user)) {
      return res.status(403).json({ success: false, message: '权限不足' });
    }

    const teachers = await db('users')
      .where('role', 'teacher')
      .select('id', 'name', 'email', 'teacher_id', 'is_active', 'created_at');
    res.json({ success: true, data: teachers });
  } catch (error) {
    next(error);
  }
});

// Get teacher by ID with student count
// 管理员可查看任意老师，老师仅可查看自己
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isAdmin(req.user) && !(isTeacher(req.user) && req.user.id === id)) {
      return res.status(403).json({ success: false, message: '无权查看该老师信息' });
    }

    const teacher = await db('users')
      .where('id', id)
      .where('role', 'teacher')
      .select('id', 'name', 'email', 'teacher_id', 'is_active', 'created_at')
      .first();

    if (!teacher) {
      return res.status(404).json({ success: false, message: '老师不存在' });
    }

    const studentCount = await db('users')
      .where('role', 'student')
      .where('teacher_id', teacher.teacher_id)
      .count('* as count')
      .first();

    res.json({
      success: true,
      data: { ...teacher, studentCount: studentCount?.count || 0 }
    });
  } catch (error) {
    next(error);
  }
});

// Get teacher's students with details
// 管理员可查看任意老师的学生，老师仅可查看自己的学生
router.get('/:id/students', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isAdmin(req.user) && !(isTeacher(req.user) && req.user.id === id)) {
      return res.status(403).json({ success: false, message: '无权查看该老师的学生' });
    }

    const teacher = await db('users').where('id', id).where('role', 'teacher').first();
    if (!teacher) {
      return res.status(404).json({ success: false, message: '老师不存在' });
    }

    const students = await db('users')
      .where('role', 'student')
      .where('teacher_id', teacher.teacher_id)
      .select('*');

    const studentsWithStats = await Promise.all(students.map(async (student) => {
      const studentId = student.student_id;
      const [schoolCount, eventCount, materials] = await Promise.all([
        db('schools').where('student_id', studentId).count('* as count').first(),
        db('events').where('student_id', studentId).where('completed', false).count('* as count').first(),
        db('materials').where('student_id', studentId),
      ]);

      const totalMaterials = materials.length;
      const completedMaterials = materials.filter(m => m.completed).length;

      return {
        ...student,
        stats: {
          schoolCount: schoolCount?.count || 0,
          pendingEvents: eventCount?.count || 0,
          totalMaterials,
          completedMaterials,
          materialProgress: totalMaterials > 0 ? Math.round(completedMaterials / totalMaterials * 100) : 0
        }
      };
    }));

    res.json({ success: true, data: studentsWithStats });
  } catch (error) {
    next(error);
  }
});

// Update teacher info
// 管理员可修改任意老师，老师仅可修改自己（不可修改 is_active）
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, is_active } = req.body;

    if (!isAdmin(req.user) && !(isTeacher(req.user) && req.user.id === id)) {
      return res.status(403).json({ success: false, message: '无权修改该老师信息' });
    }

    const teacher = await db('users').where('id', id).where('role', 'teacher').first();
    if (!teacher) {
      return res.status(404).json({ success: false, message: '老师不存在' });
    }

    const updateData = { updated_at: db.fn.now() };
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    // 仅管理员可修改 is_active 字段（启停账号）
    if (is_active !== undefined && isAdmin(req.user)) {
      updateData.is_active = is_active;
    }

    await db('users').where('id', id).update(updateData);
    const updated = await db('users')
      .where('id', id)
      .select('id', 'name', 'email', 'teacher_id', 'is_active', 'created_at')
      .first();
    res.json({ success: true, data: updated, message: '老师信息更新成功' });
  } catch (error) {
    next(error);
  }
});

// Delete teacher (admin only)
// 仅管理员可删除老师
router.delete('/:id', async (req, res, next) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ success: false, message: '仅管理员可删除老师账号' });
    }

    const { id } = req.params;
    const teacher = await db('users').where('id', id).where('role', 'teacher').first();

    if (!teacher) {
      return res.status(404).json({ success: false, message: '老师不存在' });
    }

    const studentCount = await db('users')
      .where('role', 'student')
      .where('teacher_id', teacher.teacher_id)
      .count('* as count')
      .first();

    if (studentCount?.count > 0) {
      return res.status(400).json({
        success: false,
        message: `该老师还有 ${studentCount.count} 个学生，请先转移学生后再删除`
      });
    }

    await db('users').where('id', id).delete();
    res.json({ success: true, message: '老师账号已删除' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

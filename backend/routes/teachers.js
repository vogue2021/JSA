// Teachers Routes - Enhanced
// 老师路由 - 增强版

const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Get all teachers
router.get('/', async (req, res, next) => {
  try {
    const teachers = await db('users')
      .where('role', 'teacher')
      .select('id', 'name', 'email', 'teacher_id', 'is_active', 'created_at');
    res.json({ success: true, data: teachers });
  } catch (error) {
    next(error);
  }
});

// Get teacher by ID with student count
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
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
      data: {
        ...teacher,
        studentCount: studentCount?.count || 0
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get teacher's students with details
router.get('/:id/students', async (req, res, next) => {
  try {
    const { id } = req.params;
    const teacher = await db('users').where('id', id).where('role', 'teacher').first();

    if (!teacher) {
      return res.status(404).json({ success: false, message: '老师不存在' });
    }

    const students = await db('users')
      .where('role', 'student')
      .where('teacher_id', teacher.teacher_id)
      .select('*');

    // 为每个学生获取统计数据
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
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, is_active } = req.body;

    const teacher = await db('users').where('id', id).where('role', 'teacher').first();
    if (!teacher) {
      return res.status(404).json({ success: false, message: '老师不存在' });
    }

    const updateData = { updated_at: db.fn.now() };
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (is_active !== undefined) updateData.is_active = is_active;

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
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const teacher = await db('users').where('id', id).where('role', 'teacher').first();

    if (!teacher) {
      return res.status(404).json({ success: false, message: '老师不存在' });
    }

    // Check if teacher has students
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

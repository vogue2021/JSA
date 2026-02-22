// Students Routes - Enhanced
// 学生路由 - 增强版

const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Get all students
router.get('/', async (req, res, next) => {
  try {
    const students = await db('users')
      .where('role', 'student')
      .select('*');
    res.json({ success: true, data: students });
  } catch (error) {
    next(error);
  }
});

// Get students by teacher
router.get('/teacher/:teacherId', async (req, res, next) => {
  try {
    const { teacherId } = req.params;
    const students = await db('users')
      .where('role', 'student')
      .where('teacher_id', teacherId)
      .select('*');
    res.json({ success: true, data: students });
  } catch (error) {
    next(error);
  }
});

// Get student by ID with stats
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const student = await db('users').where('id', id).where('role', 'student').first();
    if (!student) {
      return res.status(404).json({ success: false, message: '学生不存在' });
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
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, student_id, teacher_id, is_active } = req.body;

    const student = await db('users').where('id', id).where('role', 'student').first();
    if (!student) {
      return res.status(404).json({ success: false, message: '学生不存在' });
    }

    const updateData = { updated_at: db.fn.now() };
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (student_id !== undefined) updateData.student_id = student_id;
    if (teacher_id !== undefined) updateData.teacher_id = teacher_id;
    if (is_active !== undefined) updateData.is_active = is_active;

    await db('users').where('id', id).update(updateData);
    const updated = await db('users').where('id', id).first();
    res.json({ success: true, data: updated, message: '学生信息更新成功' });
  } catch (error) {
    next(error);
  }
});

// Delete student
router.delete('/:id', async (req, res, next) => {
  try {
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

// Transfer student to another teacher
router.put('/:id/transfer', async (req, res, next) => {
  try {
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

// Search students
router.get('/search/query', async (req, res, next) => {
  try {
    const { q, teacher_id } = req.query;
    let query = db('users').where('role', 'student');

    if (q) {
      query = query.where(function() {
        this.where('name', 'like', `%${q}%`)
          .orWhere('email', 'like', `%${q}%`)
          .orWhere('student_id', 'like', `%${q}%`);
      });
    }
    if (teacher_id) {
      query = query.where('teacher_id', teacher_id);
    }

    const students = await query.select('*');
    res.json({ success: true, data: students });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

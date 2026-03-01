// Events Routes
// 时间线事件路由

const express = require('express');
const router = express.Router();
const db = require('../config/db');

const isAdmin = (user) => user?.role === 'admin';
const isTeacher = (user) => user?.role === 'teacher';
const isStudent = (user) => user?.role === 'student';

// Calculate days left
const calculateDaysLeft = (dateString) => {
  const targetDate = new Date(dateString);
  const today = new Date();
  const diffTime = targetDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

const getStudentByIdentifier = async (identifier) => {
  return db('users')
    .where('role', 'student')
    .andWhere(function () {
      this.where('id', identifier).orWhere('student_id', identifier);
    })
    .first();
};

const canAccessStudent = (user, student) => {
  if (!user || !student) return false;
  if (isAdmin(user)) return true;
  if (isTeacher(user)) return !!student.teacher_id && !!user.teacherId && student.teacher_id === user.teacherId;
  if (isStudent(user)) return Number(student.id) === Number(user.id);
  return false;
};

const ensureStudentAccess = async (req, studentIdentifier) => {
  const student = await getStudentByIdentifier(studentIdentifier);
  if (!student) return { ok: false, status: 404, message: '学生不存在' };
  if (!canAccessStudent(req.user, student)) return { ok: false, status: 403, message: '无权访问该学生数据' };
  return { ok: true, student };
};

const applyEventScope = (query, user) => {
  if (isAdmin(user)) return query;
  if (isTeacher(user)) {
    return query
      .join('users as u_scope', 'events.student_id', 'u_scope.id')
      .where('u_scope.teacher_id', user.teacherId || '__none__');
  }
  if (isStudent(user)) return query.where('events.student_id', user.id);
  return query.whereRaw('1 = 0');
};

// Get all events for a student
// 获取学生的所有时间线事件
router.get('/student/:studentId', async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const access = await ensureStudentAccess(req, studentId);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    const events = await db('events')
      .where('student_id', access.student.id)
      .orderBy('date', 'asc');

    events.forEach(event => {
      event.days_left = calculateDaysLeft(event.date);
      event.urgent = event.days_left <= 7 && event.days_left >= 0;
    });

    res.json({ success: true, data: events });
  } catch (error) {
    next(error);
  }
});

// Get single event
// 获取单个事件详情
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    let query = db('events').where('events.id', id);
    query = applyEventScope(query, req.user);
    const event = await query.first('events.*');

    if (!event) {
      return res.status(404).json({ success: false, message: '事件不存在或无权访问' });
    }

    event.days_left = calculateDaysLeft(event.date);
    event.urgent = event.days_left <= 7 && event.days_left >= 0;

    res.json({ success: true, data: event });
  } catch (error) {
    next(error);
  }
});

// Create new event
// 添加新事件
router.post('/', async (req, res, next) => {
  try {
    const {
      student_id,
      school_id,
      type,
      title,
      date,
      category,
      urgent,
      notes,
      completed
    } = req.body;

    if (!student_id || !type || !title || !date || !category) {
      return res.status(400).json({ success: false, message: '缺少必填字段' });
    }

    // 验证当前用户是否有权为该学生创建事件
    const access = await ensureStudentAccess(req, student_id);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }
    const studentUserId = access.student.id;

    const days_left = calculateDaysLeft(date);

    const [eventId] = await db('events').insert({
      student_id: studentUserId,
      school_id: school_id || null,
      type,
      title,
      date,
      days_left,
      category,
      urgent: urgent !== undefined ? urgent : (days_left <= 7 && days_left >= 0),
      notes: notes || null,
      completed: completed || false
    });

    const event = await db('events').where('id', eventId).first();

    res.status(201).json({ success: true, message: '事件添加成功', data: event });
  } catch (error) {
    next(error);
  }
});

// Update event
// 更新事件信息
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type, title, date, category, urgent, notes, completed } = req.body;

    // 通过作用域查询确认权限
    let eventQuery = db('events').where('events.id', id);
    eventQuery = applyEventScope(eventQuery, req.user);
    const event = await eventQuery.first('events.*');

    if (!event) {
      return res.status(404).json({ success: false, message: '事件不存在或无权修改' });
    }

    const updateData = {
      type: type || event.type,
      title: title || event.title,
      date: date || event.date,
      category: category || event.category,
      notes: notes !== undefined ? notes : event.notes,
      completed: completed !== undefined ? completed : event.completed
    };

    updateData.days_left = calculateDaysLeft(updateData.date);
    updateData.urgent = urgent !== undefined ? urgent : (updateData.days_left <= 7 && updateData.days_left >= 0);

    await db('events').where('id', id).update(updateData);
    const updatedEvent = await db('events').where('id', id).first();

    res.json({ success: true, message: '事件更新成功', data: updatedEvent });
  } catch (error) {
    next(error);
  }
});

// Delete event
// 删除事件
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    let eventQuery = db('events').where('events.id', id);
    eventQuery = applyEventScope(eventQuery, req.user);
    const event = await eventQuery.first('events.*');

    if (!event) {
      return res.status(404).json({ success: false, message: '事件不存在或无权删除' });
    }

    if (event.school_id) {
      return res.status(400).json({
        success: false,
        message: '学校关联事件不能单独删除，请通过学校管理删除'
      });
    }

    await db('events').where('id', id).del();
    res.json({ success: true, message: '事件删除成功' });
  } catch (error) {
    next(error);
  }
});

// Toggle event completion
// 切换事件完成状态
router.patch('/:id/toggle', async (req, res, next) => {
  try {
    const { id } = req.params;

    let eventQuery = db('events').where('events.id', id);
    eventQuery = applyEventScope(eventQuery, req.user);
    const event = await eventQuery.first('events.*');

    if (!event) {
      return res.status(404).json({ success: false, message: '事件不存在或无权操作' });
    }

    await db('events').where('id', id).update({ completed: !event.completed });
    const updatedEvent = await db('events').where('id', id).first();

    res.json({ success: true, message: '事件状态更新成功', data: updatedEvent });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

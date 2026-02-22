// Events Routes
// 时间线事件路由

const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Calculate days left
const calculateDaysLeft = (dateString) => {
  const targetDate = new Date(dateString);
  const today = new Date();
  const diffTime = targetDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Get all events for a student
// 获取学生的所有时间线事件
router.get('/student/:studentId', async (req, res, next) => {
  try {
    const { studentId } = req.params;

    const events = await db('events')
      .where('student_id', studentId)
      .orderBy('date', 'asc');

    // Calculate days_left for each event
    events.forEach(event => {
      event.days_left = calculateDaysLeft(event.date);
      // Update urgent status based on days left
      event.urgent = event.days_left <= 7 && event.days_left >= 0;
    });

    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    next(error);
  }
});

// Get single event
// 获取单个事件详情
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const event = await db('events')
      .where('id', id)
      .first();

    if (!event) {
      return res.status(404).json({
        success: false,
        message: '事件不存在'
      });
    }

    event.days_left = calculateDaysLeft(event.date);
    event.urgent = event.days_left <= 7 && event.days_left >= 0;

    res.json({
      success: true,
      data: event
    });
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

    // Validation
    if (!student_id || !type || !title || !date || !category) {
      return res.status(400).json({
        success: false,
        message: '缺少必填字段'
      });
    }

    const days_left = calculateDaysLeft(date);

    const [eventId] = await db('events').insert({
      student_id,
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

    res.status(201).json({
      success: true,
      message: '事件添加成功',
      data: event
    });
  } catch (error) {
    next(error);
  }
});

// Update event
// 更新事件信息
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      type,
      title,
      date,
      category,
      urgent,
      notes,
      completed
    } = req.body;

    const event = await db('events').where('id', id).first();

    if (!event) {
      return res.status(404).json({
        success: false,
        message: '事件不存在'
      });
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

    res.json({
      success: true,
      message: '事件更新成功',
      data: updatedEvent
    });
  } catch (error) {
    next(error);
  }
});

// Delete event
// 删除事件
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const event = await db('events').where('id', id).first();

    if (!event) {
      return res.status(404).json({
        success: false,
        message: '事件不存在'
      });
    }

    // Only allow deletion of non-school events (school events are managed via schools)
    if (event.school_id) {
      return res.status(400).json({
        success: false,
        message: '学校关联事件不能单独删除，请通过学校管理删除'
      });
    }

    await db('events').where('id', id).del();

    res.json({
      success: true,
      message: '事件删除成功'
    });
  } catch (error) {
    next(error);
  }
});

// Toggle event completion
// 切换事件完成状态
router.patch('/:id/toggle', async (req, res, next) => {
  try {
    const { id } = req.params;

    const event = await db('events').where('id', id).first();

    if (!event) {
      return res.status(404).json({
        success: false,
        message: '事件不存在'
      });
    }

    await db('events')
      .where('id', id)
      .update({ completed: !event.completed });

    const updatedEvent = await db('events').where('id', id).first();

    res.json({
      success: true,
      message: '事件状态更新成功',
      data: updatedEvent
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

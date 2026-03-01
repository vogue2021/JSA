// Schools Routes
// 学校管理路由

const express = require('express');
const router = express.Router();
const db = require('../config/db');

// ─── 统计接口 ────────────────────────────────────────────────────────────────

// GET /api/schools/stats
// 获取全局学校报考统计（按学校名聚合，供仪表盘使用）
// 支持 ?teacher_id=xxx 按老师筛选
router.get('/stats', async (req, res, next) => {
  try {
    const { teacher_id } = req.query;

    // 构建基础查询：关联 students 表以支持按老师筛选
    let query = db('schools as s')
      .join('students as st', 's.student_id', 'st.student_id')
      .select(
        's.name',
        's.type',
        's.program',
        's.status',
        db.raw('COUNT(*) as count')
      )
      .groupBy('s.name', 's.type', 's.program', 's.status');

    if (teacher_id) {
      query = query.where('st.teacher_id', teacher_id);
    }

    const rows = await query;

    // 聚合：按学校名汇总各状态数量
    const schoolMap = {};
    rows.forEach(row => {
      const name = row.name;
      if (!schoolMap[name]) {
        schoolMap[name] = {
          name,
          type: row.type || '',
          total: 0,
          not_started: 0,
          preparing: 0,
          applied: 0,
          submitted: 0,
          admitted: 0,
          rejected: 0,
        };
      }
      const status = row.status || 'preparing';
      const cnt = Number(row.count) || 0;
      schoolMap[name].total += cnt;
      if (schoolMap[name][status] !== undefined) {
        schoolMap[name][status] += cnt;
      }
    });

    // 按报考总数降序排列
    const sortedSchools = Object.values(schoolMap).sort((a, b) => b.total - a.total);

    // 全局状态汇总
    const statusCounts = { not_started: 0, preparing: 0, applied: 0, submitted: 0, admitted: 0, rejected: 0 };
    const schoolTypeMap = {};
    sortedSchools.forEach(s => {
      Object.keys(statusCounts).forEach(k => { statusCounts[k] += s[k] || 0; });
      if (s.type) schoolTypeMap[s.type] = (schoolTypeMap[s.type] || 0) + s.total;
    });

    res.json({
      success: true,
      data: {
        sortedSchools,
        statusCounts,
        schoolTypeMap,
        totalApplications: sortedSchools.reduce((sum, s) => sum + s.total, 0),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/schools/stats/events
// 获取全局事件统计（紧急/即将到期，供仪表盘使用）
router.get('/stats/events', async (req, res, next) => {
  try {
    const { teacher_id } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let query = db('events as e')
      .join('students as st', 'e.student_id', 'st.student_id')
      .where('e.completed', false);

    if (teacher_id) {
      query = query.where('st.teacher_id', teacher_id);
    }

    const allEvents = await query.select('e.*', 'st.name as student_name');

    const urgentEvents = allEvents.filter(e => e.urgent).length;
    const upcomingEvents = allEvents.filter(e => {
      const d = e.date;
      return d >= today && d <= sevenDaysLater;
    }).length;

    res.json({
      success: true,
      data: { totalEvents: allEvents.length, urgentEvents, upcomingEvents },
    });
  } catch (error) {
    next(error);
  }
});

// ─── 学生维度接口 ─────────────────────────────────────────────────────────────

// Get all schools for a student
// 获取学生的所有志愿学校
router.get('/student/:studentId', async (req, res, next) => {
  try {
    const { studentId } = req.params;

    const schools = await db('schools')
      .where('student_id', studentId)
      .orderBy('created_at', 'desc');

    // Parse materials JSON
    schools.forEach(school => {
      if (school.materials) {
        school.materials = JSON.parse(school.materials);
      }
    });

    res.json({
      success: true,
      data: schools
    });
  } catch (error) {
    next(error);
  }
});

// Get single school
// 获取单个学校详情
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const school = await db('schools')
      .where('id', id)
      .first();

    if (!school) {
      return res.status(404).json({
        success: false,
        message: '学校不存在'
      });
    }

    // Parse materials JSON
    if (school.materials) {
      school.materials = JSON.parse(school.materials);
    }

    res.json({
      success: true,
      data: school
    });
  } catch (error) {
    next(error);
  }
});

// Create new school
// 添加新学校
router.post('/', async (req, res, next) => {
  try {
    const {
      student_id,
      name,
      type,
      program,
      status,
      application_start_date,
      application_end_date,
      exam_date,
      result_date,
      requirements_url,
      teacher_notes,
      materials
    } = req.body;

    // Validation
    if (!student_id || !name || !type || !program || !application_start_date ||
        !application_end_date || !exam_date || !result_date) {
      return res.status(400).json({
        success: false,
        message: '缺少必填字段'
      });
    }

    const [schoolId] = await db('schools').insert({
      student_id,
      name,
      type,
      program,
      status: status || 'preparing',
      application_start_date,
      application_end_date,
      exam_date,
      result_date,
      requirements_url,
      teacher_notes,
      materials: materials ? JSON.stringify(materials) : null
    });

    // Get the created school
    const school = await db('schools').where('id', schoolId).first();

    if (school.materials) {
      school.materials = JSON.parse(school.materials);
    }

    // Auto-create timeline events
    const events = [];

    if (application_start_date) {
      events.push({
        student_id,
        school_id: schoolId,
        type: 'deadline',
        title: `${name} 出愿开始`,
        date: application_start_date,
        category: '出愿',
        notes: `${program} 出愿开始，请准备材料`,
        completed: false
      });
    }

    if (application_end_date) {
      events.push({
        student_id,
        school_id: schoolId,
        type: 'deadline',
        title: `${name} 出愿截止`,
        date: application_end_date,
        category: '出愿',
        urgent: true,
        notes: `${program} 出愿截止，务必在此之前提交`,
        completed: false
      });
    }

    if (exam_date) {
      events.push({
        student_id,
        school_id: schoolId,
        type: 'exam',
        title: `${name} 入学考试`,
        date: exam_date,
        category: '考试',
        notes: `${program} 入学考试`,
        completed: false
      });
    }

    if (result_date) {
      events.push({
        student_id,
        school_id: schoolId,
        type: 'deadline',
        title: `${name} 合格发表`,
        date: result_date,
        category: '合格发表',
        notes: `${program} 合格发表日`,
        completed: false
      });
    }

    if (events.length > 0) {
      await db('events').insert(events);
    }

    // Auto-create materials if provided
    if (materials && materials.length > 0) {
      const materialRecords = materials.map(mat => ({
        student_id,
        school_id: schoolId,
        item: mat.name,
        type: 'school',
        deadline: mat.deadline || application_end_date,
        url: mat.url || null,
        completed: false
      }));
      await db('materials').insert(materialRecords);
    }

    res.status(201).json({
      success: true,
      message: '学校添加成功',
      data: school
    });
  } catch (error) {
    next(error);
  }
});

// Update school
// 更新学校信息
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      type,
      program,
      status,
      application_start_date,
      application_end_date,
      exam_date,
      result_date,
      requirements_url,
      teacher_notes,
      materials
    } = req.body;

    const school = await db('schools').where('id', id).first();

    if (!school) {
      return res.status(404).json({
        success: false,
        message: '学校不存在'
      });
    }

    const updateData = {
      name: name || school.name,
      type: type || school.type,
      program: program || school.program,
      status: status || school.status,
      application_start_date: application_start_date || school.application_start_date,
      application_end_date: application_end_date || school.application_end_date,
      exam_date: exam_date || school.exam_date,
      result_date: result_date || school.result_date,
      requirements_url: requirements_url !== undefined ? requirements_url : school.requirements_url,
      teacher_notes: teacher_notes !== undefined ? teacher_notes : school.teacher_notes,
      materials: materials ? JSON.stringify(materials) : school.materials
    };

    await db('schools').where('id', id).update(updateData);

    // Update related timeline events
    await db('events').where('school_id', id).del();

    const events = [];
    const student_id = school.student_id;

    if (updateData.application_start_date) {
      events.push({
        student_id,
        school_id: id,
        type: 'deadline',
        title: `${updateData.name} 出愿开始`,
        date: updateData.application_start_date,
        category: '出愿',
        notes: `${updateData.program} 出愿开始，请准备材料`,
        completed: false
      });
    }

    if (updateData.application_end_date) {
      events.push({
        student_id,
        school_id: id,
        type: 'deadline',
        title: `${updateData.name} 出愿截止`,
        date: updateData.application_end_date,
        category: '出愿',
        urgent: true,
        notes: `${updateData.program} 出愿截止，务必在此之前提交`,
        completed: false
      });
    }

    if (updateData.exam_date) {
      events.push({
        student_id,
        school_id: id,
        type: 'exam',
        title: `${updateData.name} 入学考试`,
        date: updateData.exam_date,
        category: '考试',
        notes: `${updateData.program} 入学考试`,
        completed: false
      });
    }

    if (updateData.result_date) {
      events.push({
        student_id,
        school_id: id,
        type: 'deadline',
        title: `${updateData.name} 合格发表`,
        date: updateData.result_date,
        category: '合格发表',
        notes: `${updateData.program} 合格发表日`,
        completed: false
      });
    }

    if (events.length > 0) {
      await db('events').insert(events);
    }

    const updatedSchool = await db('schools').where('id', id).first();
    if (updatedSchool.materials) {
      updatedSchool.materials = JSON.parse(updatedSchool.materials);
    }

    res.json({
      success: true,
      message: '学校信息更新成功',
      data: updatedSchool
    });
  } catch (error) {
    next(error);
  }
});

// Delete school
// 删除学校（级联删除相关事件和材料）
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const school = await db('schools').where('id', id).first();

    if (!school) {
      return res.status(404).json({
        success: false,
        message: '学校不存在'
      });
    }

    // Delete related events and materials (cascade handled by foreign key)
    await db('schools').where('id', id).del();

    res.json({
      success: true,
      message: '学校删除成功'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

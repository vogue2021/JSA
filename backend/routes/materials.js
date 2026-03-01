// Materials Routes
// 材料清单路由

const express = require('express');
const router = express.Router();
const db = require('../config/db');

const isAdmin = (user) => user?.role === 'admin';
const isTeacher = (user) => user?.role === 'teacher';
const isStudent = (user) => user?.role === 'student';

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

const applyMaterialScope = (query, user) => {
  if (isAdmin(user)) return query;
  if (isTeacher(user)) {
    return query
      .join('users as u_scope', 'materials.student_id', 'u_scope.id')
      .where('u_scope.teacher_id', user.teacherId || '__none__');
  }
  if (isStudent(user)) return query.where('materials.student_id', user.id);
  return query.whereRaw('1 = 0');
};

// Get all materials for a student
// 获取学生的所有材料
router.get('/student/:studentId', async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { type, school_id } = req.query;

    const access = await ensureStudentAccess(req, studentId);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    let query = db('materials').where('student_id', access.student.id);

    if (type) {
      query = query.where('type', type);
    }
    if (school_id) {
      query = query.where('school_id', school_id);
    }

    const materials = await query.orderBy('deadline', 'asc');

    // Group materials by type and school
    const groupedMaterials = {
      general: materials.filter(m => m.type === 'general'),
      schoolSpecific: {}
    };

    const schoolMaterials = materials.filter(m => m.type === 'school' && m.school_id);

    if (schoolMaterials.length > 0) {
      const schoolIds = [...new Set(schoolMaterials.map(m => m.school_id))];
      const schools = await db('schools')
        .whereIn('id', schoolIds)
        .select('id', 'name');

      const schoolMap = {};
      schools.forEach(s => { schoolMap[s.id] = s.name; });

      schoolMaterials.forEach(mat => {
        const schoolName = schoolMap[mat.school_id];
        if (schoolName) {
          if (!groupedMaterials.schoolSpecific[schoolName]) {
            groupedMaterials.schoolSpecific[schoolName] = [];
          }
          groupedMaterials.schoolSpecific[schoolName].push(mat);
        }
      });
    }

    res.json({ success: true, data: groupedMaterials });
  } catch (error) {
    next(error);
  }
});

// Get material statistics for a student
// 获取学生的材料统计信息（放在 /:id 前面避免被参数路由遮蔽）
router.get('/student/:studentId/stats', async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const access = await ensureStudentAccess(req, studentId);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    const materials = await db('materials').where('student_id', access.student.id);

    const stats = {
      total: materials.length,
      completed: materials.filter(m => m.completed).length,
      general: {
        total: materials.filter(m => m.type === 'general').length,
        completed: materials.filter(m => m.type === 'general' && m.completed).length
      },
      school: {
        total: materials.filter(m => m.type === 'school').length,
        completed: materials.filter(m => m.type === 'school' && m.completed).length
      }
    };

    stats.percentage = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
    stats.general.percentage = stats.general.total > 0 ? Math.round((stats.general.completed / stats.general.total) * 100) : 0;
    stats.school.percentage = stats.school.total > 0 ? Math.round((stats.school.completed / stats.school.total) * 100) : 0;

    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

// Get single material
// 获取单个材料详情
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    let query = db('materials').where('materials.id', id);
    query = applyMaterialScope(query, req.user);
    const material = await query.first('materials.*');

    if (!material) {
      return res.status(404).json({ success: false, message: '材料不存在或无权访问' });
    }

    res.json({ success: true, data: material });
  } catch (error) {
    next(error);
  }
});

// Create new material
// 添加新材料
router.post('/', async (req, res, next) => {
  try {
    const {
      student_id,
      school_id,
      item,
      type,
      deadline,
      url,
      completed,
      checked_by,
      checked_at
    } = req.body;

    if (!student_id || !item || !type || !deadline) {
      return res.status(400).json({ success: false, message: '缺少必填字段' });
    }

    if (type === 'school' && !school_id) {
      return res.status(400).json({ success: false, message: '学校专用材料必须关联学校' });
    }

    // 验证当前用户是否有权为该学生创建材料
    const access = await ensureStudentAccess(req, student_id);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }
    const studentUserId = access.student.id;

    const [materialId] = await db('materials').insert({
      student_id: studentUserId,
      school_id: school_id || null,
      item,
      type,
      deadline,
      url: url || null,
      completed: completed || false,
      checked_by: checked_by || null,
      checked_at: checked_at || null
    });

    const material = await db('materials').where('id', materialId).first();

    res.status(201).json({ success: true, message: '材料添加成功', data: material });
  } catch (error) {
    next(error);
  }
});

// Update material
// 更新材料信息
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { item, deadline, url, completed, checked_by, checked_at } = req.body;

    let matQuery = db('materials').where('materials.id', id);
    matQuery = applyMaterialScope(matQuery, req.user);
    const material = await matQuery.first('materials.*');

    if (!material) {
      return res.status(404).json({ success: false, message: '材料不存在或无权修改' });
    }

    const updateData = {
      item: item || material.item,
      deadline: deadline || material.deadline,
      url: url !== undefined ? url : material.url,
      completed: completed !== undefined ? completed : material.completed,
      checked_by: checked_by !== undefined ? checked_by : material.checked_by,
      checked_at: checked_at !== undefined ? checked_at : material.checked_at
    };

    await db('materials').where('id', id).update(updateData);
    const updatedMaterial = await db('materials').where('id', id).first();

    res.json({ success: true, message: '材料更新成功', data: updatedMaterial });
  } catch (error) {
    next(error);
  }
});

// Delete material
// 删除材料
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    let matQuery = db('materials').where('materials.id', id);
    matQuery = applyMaterialScope(matQuery, req.user);
    const material = await matQuery.first('materials.*');

    if (!material) {
      return res.status(404).json({ success: false, message: '材料不存在或无权删除' });
    }

    await db('materials').where('id', id).del();
    res.json({ success: true, message: '材料删除成功' });
  } catch (error) {
    next(error);
  }
});

// Toggle material completion (check/uncheck)
// 切换材料完成状态
router.patch('/:id/toggle', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { checked_by } = req.body;

    let matQuery = db('materials').where('materials.id', id);
    matQuery = applyMaterialScope(matQuery, req.user);
    const material = await matQuery.first('materials.*');

    if (!material) {
      return res.status(404).json({ success: false, message: '材料不存在或无权操作' });
    }

    const newCompleted = !material.completed;

    await db('materials')
      .where('id', id)
      .update({
        completed: newCompleted,
        checked_by: newCompleted ? checked_by : null,
        checked_at: newCompleted ? new Date().toISOString().split('T')[0] : null
      });

    const updatedMaterial = await db('materials').where('id', id).first();

    res.json({ success: true, message: '材料状态更新成功', data: updatedMaterial });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

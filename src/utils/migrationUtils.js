/**
 * localStorage → 后端 API 数据迁移工具
 *
 * 使用方法：
 *   1. 在浏览器控制台中运行此脚本（或通过 SettingsPage 的"数据迁移"按钮触发）
 *   2. 脚本会读取 localStorage 中的学生、学校、事件、材料数据
 *   3. 逐条调用后端 API 写入数据库
 *   4. 迁移完成后输出报告
 *
 * 注意：迁移前请确保已登录（需要有效 JWT Token）
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// ─── 获取当前 JWT Token ───────────────────────────────────────────────────────
const getToken = () => {
  return localStorage.getItem('jsa_token') || localStorage.getItem('token') || '';
};

// ─── 通用 API 请求 ────────────────────────────────────────────────────────────
const apiCall = async (method, path, body) => {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
};

// ─── 迁移报告 ─────────────────────────────────────────────────────────────────
const createReport = () => ({
  students: { total: 0, success: 0, failed: 0, errors: [] },
  schools: { total: 0, success: 0, failed: 0, errors: [] },
  events: { total: 0, success: 0, failed: 0, errors: [] },
  materials: { total: 0, success: 0, failed: 0, errors: [] },
  startTime: new Date().toISOString(),
  endTime: null,
});

// ─── 迁移学生数据 ─────────────────────────────────────────────────────────────
const migrateStudents = async (report) => {
  let studentList = [];
  try {
    studentList = JSON.parse(localStorage.getItem('studentList') || '[]');
  } catch (e) {
    console.warn('[迁移] 读取 studentList 失败:', e.message);
    return {};
  }

  report.students.total = studentList.length;
  const idMap = {}; // 旧 studentId → 新 DB id

  for (const student of studentList) {
    try {
      const result = await apiCall('POST', '/students', {
        student_id: student.studentId,
        name: student.name,
        email: student.email || '',
        birthday: student.birthday || null,
        high_school: student.highSchool || '',
        language_school: student.languageSchool || '',
        target_level: student.targetLevel || '',
        subject: student.subject || '',
        jlpt_score: student.jlptScore || '',
        english_score: student.englishScore || '',
        eju_scores: JSON.stringify(student.ejuScores || []),
        tags: JSON.stringify(student.tags || []),
        package_name: student.packageName || '',
        package_end_date: student.packageEndDate || null,
        teacher_id: student.teacherId || null,
        academic_advisor_id: student.academicAdvisorId || null,
        follow_up_notes: student.followUpNotes || '',
        progress: student.progress || 0,
      });
      idMap[student.studentId] = result.id || student.studentId;
      report.students.success++;
      console.log(`✅ 学生迁移成功: ${student.name} (${student.studentId})`);
    } catch (e) {
      report.students.failed++;
      report.students.errors.push({ id: student.studentId, name: student.name, error: e.message });
      console.error(`❌ 学生迁移失败: ${student.name} (${student.studentId}) - ${e.message}`);
    }
  }

  return idMap;
};

// ─── 迁移学校申请数据 ─────────────────────────────────────────────────────────
const migrateSchools = async (report, studentIdMap) => {
  // 学校数据按学生 ID 存储在 studentData_${studentId} 中
  const allStudentIds = Object.keys(studentIdMap);

  for (const studentId of allStudentIds) {
    let studentData = {};
    try {
      studentData = JSON.parse(localStorage.getItem(`studentData_${studentId}`) || '{}');
    } catch (e) { continue; }

    const schools = studentData.schools || [];
    report.schools.total += schools.length;

    for (const school of schools) {
      try {
        await apiCall('POST', '/schools', {
          student_id: studentId,
          name: school.name,
          type: school.type || '',
          program: school.program || '',
          status: school.status || 'preparing',
          application_start_date: school.applicationStartDate || null,
          application_end_date: school.applicationEndDate || null,
          exam_date: school.examDate || null,
          result_date: school.resultDate || null,
          notes: school.notes || '',
          url: school.url || '',
          difficulty: school.difficulty || '',
          ranking: school.ranking || null,
          acceptance_rate: school.acceptanceRate || null,
        });
        report.schools.success++;
        console.log(`  ✅ 学校迁移成功: ${school.name} (学生: ${studentId})`);
      } catch (e) {
        report.schools.failed++;
        report.schools.errors.push({ studentId, school: school.name, error: e.message });
        console.error(`  ❌ 学校迁移失败: ${school.name} - ${e.message}`);
      }
    }
  }
};

// ─── 迁移时间线事件数据 ───────────────────────────────────────────────────────
const migrateEvents = async (report, studentIdMap) => {
  const allStudentIds = Object.keys(studentIdMap);

  for (const studentId of allStudentIds) {
    let studentData = {};
    try {
      studentData = JSON.parse(localStorage.getItem(`studentData_${studentId}`) || '{}');
    } catch (e) { continue; }

    const events = studentData.events || [];
    report.events.total += events.length;

    for (const event of events) {
      try {
        await apiCall('POST', '/events', {
          student_id: studentId,
          title: event.title,
          date: event.date,
          type: event.type || 'other',
          category: event.category || '',
          school: event.school || '',
          notes: event.notes || '',
          completed: event.completed || false,
          urgent: event.urgent || false,
          days_left: event.daysLeft || 0,
        });
        report.events.success++;
      } catch (e) {
        report.events.failed++;
        report.events.errors.push({ studentId, event: event.title, error: e.message });
        console.error(`  ❌ 事件迁移失败: ${event.title} - ${e.message}`);
      }
    }
    if (events.length > 0) {
      console.log(`  ✅ 学生 ${studentId} 的 ${events.length} 个事件已迁移`);
    }
  }
};

// ─── 迁移材料清单数据 ─────────────────────────────────────────────────────────
const migrateMaterials = async (report, studentIdMap) => {
  const allStudentIds = Object.keys(studentIdMap);

  for (const studentId of allStudentIds) {
    let studentData = {};
    try {
      studentData = JSON.parse(localStorage.getItem(`studentData_${studentId}`) || '{}');
    } catch (e) { continue; }

    const checklist = studentData.checklist || {};
    const generalMaterials = checklist.general || [];
    report.materials.total += generalMaterials.length;

    for (const material of generalMaterials) {
      try {
        await apiCall('POST', '/materials', {
          student_id: studentId,
          item: material.item,
          deadline: material.deadline || null,
          completed: material.completed || false,
          checked_by: material.checkedBy || null,
          checked_at: material.checkedAt || null,
          school_specific: false,
          school_name: null,
        });
        report.materials.success++;
      } catch (e) {
        report.materials.failed++;
        report.materials.errors.push({ studentId, item: material.item, error: e.message });
      }
    }

    // 学校专用材料
    const schoolSpecific = checklist.schoolSpecific || {};
    for (const [schoolName, materials] of Object.entries(schoolSpecific)) {
      report.materials.total += materials.length;
      for (const material of materials) {
        try {
          await apiCall('POST', '/materials', {
            student_id: studentId,
            item: material.item,
            deadline: material.deadline || null,
            completed: material.completed || false,
            checked_by: material.checkedBy || null,
            checked_at: material.checkedAt || null,
            school_specific: true,
            school_name: schoolName,
          });
          report.materials.success++;
        } catch (e) {
          report.materials.failed++;
          report.materials.errors.push({ studentId, item: material.item, school: schoolName, error: e.message });
        }
      }
    }
  }
};

// ─── 主迁移函数 ───────────────────────────────────────────────────────────────
export const runMigration = async (options = {}) => {
  const { dryRun = false, onProgress } = options;

  console.log('🚀 开始 localStorage → 后端数据库迁移...');
  console.log(`   模式: ${dryRun ? '演练（不实际写入）' : '正式迁移'}`);
  console.log(`   API: ${API_BASE}`);

  if (!getToken()) {
    throw new Error('未找到登录 Token，请先登录后再执行迁移');
  }

  const report = createReport();

  if (!dryRun) {
    // 1. 迁移学生
    onProgress?.('正在迁移学生数据...');
    const studentIdMap = await migrateStudents(report);

    // 2. 迁移学校申请
    onProgress?.('正在迁移学校申请数据...');
    await migrateSchools(report, studentIdMap);

    // 3. 迁移时间线事件
    onProgress?.('正在迁移时间线事件...');
    await migrateEvents(report, studentIdMap);

    // 4. 迁移材料清单
    onProgress?.('正在迁移材料清单...');
    await migrateMaterials(report, studentIdMap);
  } else {
    // 演练模式：只统计数量，不实际写入
    const studentList = JSON.parse(localStorage.getItem('studentList') || '[]');
    report.students.total = studentList.length;
    console.log(`[演练] 发现 ${studentList.length} 个学生待迁移`);
  }

  report.endTime = new Date().toISOString();

  // 输出迁移报告
  console.log('\n📊 迁移报告:');
  console.log(`   学生: ${report.students.success}/${report.students.total} 成功`);
  console.log(`   学校: ${report.schools.success}/${report.schools.total} 成功`);
  console.log(`   事件: ${report.events.success}/${report.events.total} 成功`);
  console.log(`   材料: ${report.materials.success}/${report.materials.total} 成功`);

  const totalFailed = report.students.failed + report.schools.failed +
    report.events.failed + report.materials.failed;

  if (totalFailed > 0) {
    console.warn(`\n⚠️  共 ${totalFailed} 条记录迁移失败，详见 report.errors`);
  } else {
    console.log('\n✅ 所有数据迁移成功！');
  }

  return report;
};

// ─── 迁移前数据统计（不写入，仅统计） ────────────────────────────────────────
export const getMigrationStats = () => {
  const studentList = JSON.parse(localStorage.getItem('studentList') || '[]');
  let totalSchools = 0, totalEvents = 0, totalMaterials = 0;

  for (const student of studentList) {
    const data = JSON.parse(localStorage.getItem(`studentData_${student.studentId}`) || '{}');
    totalSchools += (data.schools || []).length;
    totalEvents += (data.events || []).length;
    const checklist = data.checklist || {};
    totalMaterials += (checklist.general || []).length;
    Object.values(checklist.schoolSpecific || {}).forEach(m => { totalMaterials += m.length; });
  }

  return {
    students: studentList.length,
    schools: totalSchools,
    events: totalEvents,
    materials: totalMaterials,
    feedbacks: JSON.parse(localStorage.getItem('feedbackHistory') || '[]').length,
  };
};

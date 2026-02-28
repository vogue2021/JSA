/**
 * 测试数据生成脚本
 * 在浏览器控制台中运行此脚本，或导入后调用 generateTestData()
 * 
 * 生成内容：
 * - 20+ 名学生（分布在不同老师名下）
 * - 每个学生有 1-4 所志愿学校（分布在不同状态）
 * - 每个学生有时间线事件
 * - 每个学生有材料清单
 */

const SCHOOL_DATA = [
  { name: '东京大学', type: '国立', program: '工学研究科' },
  { name: '京都大学', type: '国立', program: '理学研究科' },
  { name: '大阪大学', type: '国立', program: '経済学研究科' },
  { name: '東北大学', type: '国立', program: '情報科学研究科' },
  { name: '名古屋大学', type: '国立', program: '環境学研究科' },
  { name: '九州大学', type: '国立', program: '人文科学研究院' },
  { name: '北海道大学', type: '国立', program: '農学研究院' },
  { name: '東京工業大学', type: '国立', program: '工学院' },
  { name: '筑波大学', type: '国立', program: '人文社会科学研究科' },
  { name: '一橋大学', type: '国立', program: '経営管理研究科' },
  { name: '早稲田大学', type: '私立', program: '政治学研究科' },
  { name: '慶應義塾大学', type: '私立', program: '経済学研究科' },
  { name: '上智大学', type: '私立', program: '外国語学研究科' },
  { name: '明治大学', type: '私立', program: '商学研究科' },
  { name: '立教大学', type: '私立', program: '社会学研究科' },
  { name: '横浜国立大学', type: '国立', program: '国際社会科学研究院' },
  { name: '神戸大学', type: '国立', program: '法学研究科' },
  { name: '大阪公立大学', type: '公立', program: '経営学研究科' },
  { name: '東京都立大学', type: '公立', program: '人文科学研究科' },
  { name: '横浜市立大学', type: '公立', program: '医学研究科' },
];

const STUDENT_NAMES = [
  '张三', '李四', '王五', '赵六', '陈七',
  '刘芳', '杨伟', '黄丽', '周强', '吴敏',
  '郑浩', '孙静', '朱伟', '马丽', '胡强',
  '郭芳', '林敏', '何伟', '高丽', '罗强',
  '许芳', '邓伟', '苏丽', '唐强',
];

// 学生拼音名（用于生成邮箱）
const STUDENT_PINYIN = [
  'zhangsan', 'lisi', 'wangwu', 'zhaoliu', 'chenqi',
  'liufang', 'yangwei', 'huangli', 'zhouqiang', 'wumin',
  'zhenghao', 'sunjing', 'zhuwei', 'mali', 'huqiang',
  'guofang', 'linmin', 'hewei', 'gaoli', 'luoqiang',
  'xufang', 'dengwei', 'suli', 'tangqiang',
];

// 老师数据
const TEACHER_DATA = [
  { name: '王老师', pinyin: 'wang', department: '升学指导部', subject: '文科', gender: '男', education: '硕士', school: '早稲田大学', faculty: '教育学研究科' },
  { name: '李老师', pinyin: 'li', department: '升学指导部', subject: '理科', gender: '女', education: '博士', school: '東京大学', faculty: '工学研究科' },
  { name: '张老师', pinyin: 'zhang', department: '日语教学部', subject: '文科', gender: '男', education: '硕士', school: '京都大学', faculty: '文学研究科' },
];

const AVATARS = ['👨‍🎓', '👩‍🎓', '🧑‍🎓', '👨‍💻', '👩‍💻'];
const SUBJECTS = ['文科', '理科', '文科', '理科']; // 均匀分布
const STATUSES = ['preparing', 'applied', 'submitted', 'admitted'];
const EVENT_TYPES = ['exam', 'deadline', 'interview', 'document', 'material'];
const EVENT_CATEGORIES = ['考试', '出愿', '面试', '校内考', '材料'];

const TAGS_POOL = [
  '重点关注', '成绩优秀', '需要辅导', '日语N1', '日语N2',
  'EJU高分', '有奖学金', '在职考研', '跨专业', '二次出愿',
  '面试辅导', '志望理由书', '英语授课', '10月入学', '4月入学',
];

const GENERAL_MATERIALS = [
  { id: 1, name: '护照复印件', category: '基本材料' },
  { id: 2, name: '毕业证书', category: '基本材料' },
  { id: 3, name: '成绩单', category: '基本材料' },
  { id: 4, name: '在留卡复印件', category: '基本材料' },
  { id: 5, name: 'JLPT成绩证明', category: '成绩材料' },
  { id: 6, name: 'EJU成绩证明', category: '成绩材料' },
  { id: 7, name: '志望理由书', category: '申请材料' },
  { id: 8, name: '志望理由书', category: '申请材料' },
  { id: 9, name: '推荐信', category: '申请材料' },
  { id: 10, name: '照片（3x4）', category: '基本材料' },
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomSubset(arr, min, max) {
  const count = randomInt(min, max);
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, arr.length));
}

function randomDate(startMonths, endMonths) {
  const now = new Date();
  const start = new Date(now);
  start.setMonth(start.getMonth() + startMonths);
  const end = new Date(now);
  end.setMonth(end.getMonth() + endMonths);
  const diff = end.getTime() - start.getTime();
  const d = new Date(start.getTime() + Math.random() * diff);
  return d.toISOString().split('T')[0];
}

function generateStudentSchools(studentIndex) {
  const numSchools = randomInt(1, 4);
  const selectedSchools = randomSubset(SCHOOL_DATA, numSchools, numSchools);

  return selectedSchools.map((school, i) => {
    // 越靠后的学生越可能有更高的申请状态
    const statusWeight = Math.min(studentIndex / 20, 1);
    let status;
    const r = Math.random();
    if (r < 0.3 - statusWeight * 0.15) status = 'preparing';
    else if (r < 0.55 - statusWeight * 0.1) status = 'applied';
    else if (r < 0.8) status = 'submitted';
    else status = 'admitted';

    const appStart = randomDate(-2, 2);
    const appEnd = randomDate(0, 3);
    const examDate = randomDate(1, 5);

    return {
      id: Date.now() + Math.random() + i,
      name: school.name,
      program: school.program,
      type: school.type,
      status: status,
      applicationStartDate: appStart,
      applicationEndDate: appEnd,
      examDate: examDate,
      notes: `${school.name}${school.program}申请`,
    };
  });
}

function generateStudentEvents(studentName, schools) {
  const events = [];
  let id = Date.now() + Math.random();

  schools.forEach(school => {
    if (school.applicationEndDate) {
      events.push({
        id: id++,
        type: 'deadline',
        title: `${school.name} 出愿截止`,
        date: school.applicationEndDate,
        daysLeft: Math.ceil((new Date(school.applicationEndDate) - new Date()) / (1000 * 60 * 60 * 24)),
        category: '出愿',
        urgent: Math.random() > 0.5,
        notes: `${school.program} 出愿截止日`,
        completed: school.status === 'submitted' || school.status === 'admitted',
        schoolId: school.id,
      });
    }
    if (school.examDate) {
      events.push({
        id: id++,
        type: 'exam',
        title: `${school.name} 入学考试`,
        date: school.examDate,
        daysLeft: Math.ceil((new Date(school.examDate) - new Date()) / (1000 * 60 * 60 * 24)),
        category: '考试',
        urgent: false,
        notes: `${school.program} 入学考试`,
        completed: school.status === 'admitted',
        schoolId: school.id,
      });
    }
  });

  // 添加一些通用事件
  const extraEvents = randomInt(1, 3);
  for (let i = 0; i < extraEvents; i++) {
    const cat = randomPick(EVENT_CATEGORIES);
    events.push({
      id: id++,
      type: randomPick(EVENT_TYPES),
      title: `${studentName} - ${cat}准备`,
      date: randomDate(-1, 3),
      daysLeft: randomInt(-5, 30),
      category: cat,
      urgent: Math.random() > 0.7,
      notes: '',
      completed: Math.random() > 0.6,
    });
  }

  return events;
}

function generateChecklist() {
  const general = GENERAL_MATERIALS.map(m => ({
    ...m,
    completed: Math.random() > 0.4,
  }));
  return { general };
}

export function generateTestData() {
  // 1. 生成学生列表
  const students = STUDENT_NAMES.map((name, i) => {
    // 分配给3个老师: 0-7给teacher_1, 8-15给teacher_2, 16-23给teacher_3
    const teacherId = i < 8 ? 'teacher_1' : i < 16 ? 'teacher_2' : 'teacher_3';
    const subject = SUBJECTS[i % SUBJECTS.length];
    const tags = randomSubset(TAGS_POOL, 0, 3);
    const progress = randomInt(10, 95);
    const urgentTasks = Math.random() > 0.5 ? randomInt(1, 4) : 0;

    return {
      id: i + 1,
      name: name,
      studentId: `2024${String(i + 1).padStart(3, '0')}`,
      progress,
      urgentTasks,
      avatar: randomPick(AVATARS),
      teacherId,
      subject,
      tags,
      birthday: `200${randomInt(0, 4)}-${String(randomInt(1, 12)).padStart(2, '0')}-${String(randomInt(1, 28)).padStart(2, '0')}`,
      highSchool: `${randomPick(['北京', '上海', '广州', '深圳', '成都', '武汉', '南京', '杭州'])}第${randomPick(['一', '二', '三'])}中学`,
      languageSchool: `${randomPick(['東京', '大阪', '横浜', '名古屋', '京都'])}${randomPick(['国際', '日本語', 'アジア', '中央'])}学院`,
      jlptScore: randomPick(['N1', 'N2', 'N1', '']),
      ejuScores: Math.random() > 0.3 ? [{ date: '2025-06', japanese: randomInt(250, 400), comprehensiveSub: randomInt(100, 200), math: randomInt(100, 200) }] : [],
      englishScore: Math.random() > 0.5 ? `TOEFL ${randomInt(70, 105)}` : '',
      followUpNotes: '',
      photo: '',
    };
  });

  // 2. 为每个学生生成学校申请数据和事件
  students.forEach((student) => {
    const schools = generateStudentSchools(student.id);
    const events = generateStudentEvents(student.name, schools);
    const checklist = generateChecklist();

    const studentData = { schools, events, checklist };
    localStorage.setItem(`studentData_${student.studentId}`, JSON.stringify(studentData));
  });

  // 3. 保存学生列表
  localStorage.setItem('studentList', JSON.stringify(students));

  // 4. 生成用户账号列表（所有账号邮箱和密码都可用于登录）
  const users = [
    // 管理员
    {
      id: 'admin1', email: 'admin@jsa.com', password: 'admin123',
      role: 'admin', name: '系统管理员', createdAt: new Date().toISOString(),
    },
    // 3 位老师
    ...TEACHER_DATA.map((t, i) => ({
      id: `teacher${i + 1}`,
      email: `${t.pinyin}@school.com`,
      password: `${t.pinyin}123`,
      role: 'teacher',
      teacherId: `teacher_${i + 1}`,
      name: t.name,
      createdAt: new Date().toISOString(),
    })),
    // 所有学生（每个都有可登录的邮箱和密码）
    ...students.map((s, i) => ({
      id: `student${i + 1}`,
      email: `${STUDENT_PINYIN[i]}@student.jsa.com`,
      password: `stu${s.studentId}`,
      role: 'student',
      studentId: s.studentId,
      name: s.name,
      createdAt: new Date().toISOString(),
    })),
  ];
  localStorage.setItem('registeredUsers', JSON.stringify(users));

  // 5. 生成老师详细信息（权限、部门等）
  const teacherDetails = {};
  TEACHER_DATA.forEach((t, i) => {
    teacherDetails[`teacher_${i + 1}`] = {
      gender: t.gender,
      department: t.department,
      school: t.school,
      faculty: t.faculty,
      education: t.education,
      subject: t.subject,
      employmentType: '正社员',
      joinDate: `202${randomInt(0, 4)}-${String(randomInt(1, 12)).padStart(2, '0')}-01`,
      phone: `090-${randomInt(1000, 9999)}-${randomInt(1000, 9999)}`,
      address: `${randomPick(['東京都', '神奈川県', '大阪府', '京都府'])}${randomPick(['新宿区', '渋谷区', '中央区', '港区'])}`,
      permissions: ['manage_students', 'manage_events', 'manage_schools', 'manage_materials', 'manage_school_db', 'export_data'],
    };
  });
  localStorage.setItem('teacherDetails', JSON.stringify(teacherDetails));

  console.log(`✅ 测试数据生成完成！`);
  console.log(`   - ${students.length} 名学生（全部可登录）`);
  console.log(`   - ${TEACHER_DATA.length} 位老师（全部可登录）`);
  console.log(`   - 每位学生有 1-4 所志愿学校`);
  console.log(`   - 包含不同申请状态：准备中/已出愿/已提交/已合格`);
  console.log(`   `);
  console.log(`   📧 登录账号信息：`);
  console.log(`   管理员: admin@jsa.com / admin123`);
  TEACHER_DATA.forEach((t, i) => {
    console.log(`   ${t.name}: ${t.pinyin}@school.com / ${t.pinyin}123`);
  });
  console.log(`   学生: {拼音}@student.jsa.com / stu{学号}`);
  console.log(`   例: zhangsan@student.jsa.com / stu2024001`);
  console.log(`   `);
  console.log(`   请刷新页面查看效果`);

  return { students, users };
}

// 如果直接在 HTML script 中引用，自动执行
if (typeof window !== 'undefined') {
  window.generateTestData = generateTestData;
}

export default generateTestData;

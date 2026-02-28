import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

const AppContext = createContext(null);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};

// API 请求状态管理 Hook
export const useApiState = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(async (apiCall) => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiCall();
      return result;
    } catch (err) {
      setError(err.message || '操作失败');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { loading, error, execute, clearError };
};

// 数据版本号 - 每次修改默认数据时递增，强制刷新 localStorage 缓存
const DATA_VERSION = 'v2.0.0';

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalError, setGlobalError] = useState(null);
  const [notification, setNotification] = useState(null);

  // 检查数据版本是否更新，如果更新则清除旧缓存
  const isDataStale = localStorage.getItem('dataVersion') !== DATA_VERSION;
  if (isDataStale) {
    localStorage.removeItem('registeredUsers');
    localStorage.removeItem('studentList');
    localStorage.removeItem('schoolDatabase');
    localStorage.removeItem('teacherDetails');
    localStorage.setItem('dataVersion', DATA_VERSION);
  }

  // 初始化默认 teacherDetails（含部门信息）
  if (!localStorage.getItem('teacherDetails')) {
    const defaultTeacherDetails = {
      teacher_1: { department: '学部升学组', subject: '理科', permissions: ['manage_students', 'manage_events', 'manage_schools', 'manage_materials'] },
      teacher_2: { department: '学部升学组', subject: '文科', permissions: ['manage_students', 'manage_events', 'manage_schools', 'manage_materials'] },
      teacher_3: { department: '学部升学组', subject: '理科', permissions: ['manage_students', 'manage_events', 'manage_schools', 'manage_materials'] },
      teacher_4: { department: '学部升学组', subject: '文科', permissions: ['manage_students', 'manage_events', 'manage_schools', 'manage_materials'] },
      teacher_5: { department: '学部升学组', subject: '理科', permissions: ['manage_students', 'manage_events', 'manage_schools', 'manage_materials'] },
      teacher_6: { department: '学管', subject: '文理兼修', permissions: ['manage_students', 'manage_events'] },
      teacher_7: { department: '学管', subject: '文理兼修', permissions: ['manage_students', 'manage_events'] },
    };
    localStorage.setItem('teacherDetails', JSON.stringify(defaultTeacherDetails));
  }

  const [allUsers, setAllUsers] = useState(() => {
    const saved = localStorage.getItem('registeredUsers');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'admin1', email: 'admin@jsa.com', password: 'admin123', role: 'admin', name: '系统管理员', createdAt: new Date().toISOString() },
      { id: 'teacher1', email: 'wang@school.com', password: 'wang123', role: 'teacher', teacherId: 'teacher_1', name: '王老师', createdAt: new Date().toISOString() },
      { id: 'teacher2', email: 'li@school.com', password: 'li123', role: 'teacher', teacherId: 'teacher_2', name: '李老师', createdAt: new Date().toISOString() },
      { id: 'teacher3', email: 'zhang@school.com', password: 'zhang123', role: 'teacher', teacherId: 'teacher_3', name: '张老师', createdAt: new Date().toISOString() },
      { id: 'teacher4', email: 'chen@school.com', password: 'chen123', role: 'teacher', teacherId: 'teacher_4', name: '陈老师', createdAt: new Date().toISOString() },
      { id: 'teacher5', email: 'zhao@school.com', password: 'zhao123', role: 'teacher', teacherId: 'teacher_5', name: '赵老师', createdAt: new Date().toISOString() },
      // 学管老师账号
      { id: 'teacher6', email: 'gao@school.com', password: 'gao123', role: 'teacher', teacherId: 'teacher_6', name: '高老师（学管）', createdAt: new Date().toISOString() },
      { id: 'teacher7', email: 'lin@school.com', password: 'lin123', role: 'teacher', teacherId: 'teacher_7', name: '林老师（学管）', createdAt: new Date().toISOString() },
      { id: 'student1', email: 'zhangsan@student.jsa.com', password: 'stu2024001', role: 'student', studentId: '2024001', name: '张三', createdAt: new Date().toISOString() },
      { id: 'student2', email: 'lisi@student.jsa.com', password: 'stu2024002', role: 'student', studentId: '2024002', name: '李四', createdAt: new Date().toISOString() },
      { id: 'student3', email: 'wangwu@student.jsa.com', password: 'stu2024003', role: 'student', studentId: '2024003', name: '王五', createdAt: new Date().toISOString() },
    ];
  });

  const [studentList, setStudentList] = useState(() => {
    const saved = localStorage.getItem('studentList');
    if (saved) return JSON.parse(saved);
    return [
      // 升学老师: teacher_1(王), teacher_2(李), teacher_3(张), teacher_4(陈), teacher_5(赵)
      // 学管老师: teacher_6(高), teacher_7(林) 专职学管
      // 套餐: 私塾/校内考专家 1+2, 1+2+3, 丁老师规划 1+2, 1+2+3
      { id: 1, name: '张三', studentId: '2024001', progress: 65, urgentTasks: 2, avatar: '👨‍🎓', teacherId: 'teacher_1', academicAdvisorId: 'teacher_6', birthday: '2001-05-12', highSchool: '北京十一中学', languageSchool: '东京日本语学院', jlptScore: 'N1-142', ejuScores: [{ date: '2025-06', japanese: 310, math: 170, science: 145, total: 625 }], englishScore: 'TOEFL 85', followUpNotes: '', photo: '', packageName: '私塾', packageEndDate: '2026-06-30', tags: ['理科', '重点关注'], subject: '理科' },
      { id: 2, name: '李四', studentId: '2024002', progress: 45, urgentTasks: 4, avatar: '👩‍🎓', teacherId: 'teacher_1', academicAdvisorId: 'teacher_6', birthday: '2002-01-20', highSchool: '上海外国语学校', languageSchool: '大阪日本语学校', jlptScore: 'N2-120', ejuScores: [], englishScore: '', followUpNotes: '', photo: '', packageName: '校内考专家 1+2', packageEndDate: '2026-03-31', tags: ['文科'], subject: '文科' },
      { id: 3, name: '王五', studentId: '2024003', progress: 80, urgentTasks: 1, avatar: '👨‍🎓', teacherId: 'teacher_2', academicAdvisorId: 'teacher_7', birthday: '2000-11-03', highSchool: '广州执信中学', languageSchool: '京都国际学院', jlptScore: 'N1-158', ejuScores: [{ date: '2025-06', japanese: 340, math: 190, science: 160, total: 690 }, { date: '2024-11', japanese: 310, math: 180, science: 150, total: 640 }], englishScore: 'TOEIC 780', followUpNotes: '', photo: '', packageName: '丁老师规划 1+2+3', packageEndDate: '2027-03-31', tags: ['理科', '优秀学生'], subject: '理科' },
      { id: 4, name: '赵六', studentId: '2024004', progress: 55, urgentTasks: 3, avatar: '👩‍🎓', teacherId: 'teacher_2', academicAdvisorId: 'teacher_7', birthday: '2001-08-15', highSchool: '成都七中', languageSchool: '名古屋日本语学院', jlptScore: 'N2-105', ejuScores: [{ date: '2025-06', japanese: 280, math: 120, science: 0, total: 400 }], englishScore: '', followUpNotes: '', photo: '', packageName: '校内考专家 1+2+3', packageEndDate: '2026-09-30', tags: ['文科', '需加强'], subject: '文科' },
      { id: 5, name: '刘七', studentId: '2024005', progress: 90, urgentTasks: 0, avatar: '👨‍🎓', teacherId: 'teacher_3', academicAdvisorId: 'teacher_6', birthday: '2000-03-28', highSchool: '杭州学军中学', languageSchool: '早稻田日本语学校', jlptScore: 'N1-170', ejuScores: [{ date: '2025-06', japanese: 355, math: 195, science: 170, total: 720 }], englishScore: 'TOEFL 95', followUpNotes: '', photo: '', packageName: '丁老师规划 1+2', packageEndDate: '2026-08-31', tags: ['理科', '优秀学生', '即将毕业'], subject: '理科' },
      { id: 6, name: '孙八', studentId: '2024006', progress: 30, urgentTasks: 5, avatar: '👩‍🎓', teacherId: 'teacher_1', academicAdvisorId: '', birthday: '2003-06-10', highSchool: '武汉外国语学校', languageSchool: '横滨国际学院', jlptScore: 'N3', ejuScores: [], englishScore: '', followUpNotes: '', photo: '', packageName: '', packageEndDate: '', tags: ['文科', '新生'], subject: '文科' },
      { id: 7, name: '周九', studentId: '2024007', progress: 70, urgentTasks: 2, avatar: '👨‍🎓', teacherId: 'teacher_4', academicAdvisorId: 'teacher_7', birthday: '2001-12-25', highSchool: '深圳实验学校', languageSchool: '东京外语学院', jlptScore: 'N1-135', ejuScores: [{ date: '2025-06', japanese: 320, math: 165, science: 140, total: 625 }], englishScore: 'IELTS 6.5', followUpNotes: '', photo: '', packageName: '私塾', packageEndDate: '2026-05-31', tags: ['理科'], subject: '理科' },
      { id: 8, name: '吴十', studentId: '2024008', progress: 10, urgentTasks: 6, avatar: '👩‍🎓', teacherId: 'teacher_4', academicAdvisorId: '', birthday: '2003-09-01', highSchool: '南京外国语学校', languageSchool: '神户日本语学校', jlptScore: '', ejuScores: [], englishScore: '', followUpNotes: '', photo: '', packageName: '校内考专家 1+2', packageEndDate: '2026-12-31', tags: ['文科', '新生', '需加强'], subject: '文科' },
      { id: 9, name: '郑十一', studentId: '2024009', progress: 100, urgentTasks: 0, avatar: '👨‍🎓', teacherId: 'teacher_2', academicAdvisorId: 'teacher_6', birthday: '1999-07-14', highSchool: '重庆南开中学', languageSchool: '大阪国际学院', jlptScore: 'N1-165', ejuScores: [{ date: '2025-06', japanese: 350, math: 185, science: 165, total: 700 }], englishScore: 'TOEFL 100', followUpNotes: '', photo: '', packageName: '丁老师规划 1+2+3', packageEndDate: '2025-12-31', tags: ['理科', '已合格'], subject: '理科' },
      { id: 10, name: '冯十二', studentId: '2024010', progress: 50, urgentTasks: 3, avatar: '👩‍🎓', teacherId: 'teacher_5', academicAdvisorId: 'teacher_7', birthday: '2002-04-22', highSchool: '天津南开中学', languageSchool: '东京中央日本语学校', jlptScore: 'N2-115', ejuScores: [{ date: '2025-06', japanese: 290, math: 0, science: 0, total: 290 }], englishScore: 'TOEIC 650', followUpNotes: '', photo: '', packageName: '私塾', packageEndDate: '2026-04-30', tags: ['文科'], subject: '文科' },
      { id: 11, name: '陈十三', studentId: '2024011', progress: 35, urgentTasks: 4, avatar: '👨‍🎓', teacherId: 'teacher_3', academicAdvisorId: '', birthday: '2002-10-08', highSchool: '西安高新一中', languageSchool: '京都文化日本语学校', jlptScore: 'N2-98', ejuScores: [], englishScore: '', followUpNotes: '', photo: '', packageName: '', packageEndDate: '', tags: ['理科', '新生'], subject: '理科' },
      { id: 12, name: '林十四', studentId: '2024012', progress: 0, urgentTasks: 0, avatar: '👩‍🎓', teacherId: '', academicAdvisorId: '', birthday: '2003-02-14', highSchool: '厦门外国语学校', languageSchool: '', jlptScore: '', ejuScores: [], englishScore: '', followUpNotes: '', photo: '', packageName: '', packageEndDate: '', tags: [], subject: '' },
    ];
  });

  useEffect(() => {
    localStorage.setItem('registeredUsers', JSON.stringify(allUsers));
  }, [allUsers]);

  useEffect(() => {
    localStorage.setItem('studentList', JSON.stringify(studentList));
  }, [studentList]);

  useEffect(() => {
    const saved = localStorage.getItem('user');
    if (saved) setUser(JSON.parse(saved));
  }, []);

  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const handleLogin = useCallback((userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('user');
  }, []);

  const getTeacherList = useCallback(() => {
    return allUsers.filter(u => u.role === 'teacher').map(u => ({
      id: u.teacherId,
      teacherId: u.teacherId,
      name: u.name,
      email: u.email,
    }));
  }, [allUsers]);

  // 权限检查：admin拥有全部权限，teacher根据teacherDetails中的权限列表判断
  // 注意：使用 allUsers 作为依赖以便在权限变更后刷新
  const [permissionVersion, setPermissionVersion] = useState(0);

  // 提供一个方法让 TeacherManagement 可以通知权限更新
  const refreshPermissions = useCallback(() => {
    setPermissionVersion(v => v + 1);
  }, []);

  // 监听 localStorage 变化（跨 tab 权限同步）
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'teacherDetails') {
        setPermissionVersion(v => v + 1);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const hasPermission = useCallback((permissionId) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.role === 'teacher') {
      try {
        const saved = localStorage.getItem('teacherDetails');
        if (saved) {
          const details = JSON.parse(saved);
          const detail = details[user.teacherId];
          if (detail && Array.isArray(detail.permissions)) {
            return detail.permissions.includes(permissionId);
          }
        }
      } catch (e) { /* ignore */ }
      // 默认老师有基本权限
      return ['manage_students', 'manage_events', 'manage_schools', 'manage_materials'].includes(permissionId);
    }
    return false;
  }, [user, permissionVersion]);

  const value = useMemo(() => ({
    user, setUser, allUsers, setAllUsers, studentList, setStudentList,
    globalLoading, setGlobalLoading, globalError, setGlobalError,
    notification, showNotification,
    handleLogin, handleLogout, getTeacherList, hasPermission, refreshPermissions,
  }), [user, allUsers, studentList, globalLoading, globalError, notification, showNotification, handleLogin, handleLogout, getTeacherList, hasPermission, refreshPermissions]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

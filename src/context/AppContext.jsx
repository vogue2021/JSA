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

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalError, setGlobalError] = useState(null);
  const [notification, setNotification] = useState(null);

  const [allUsers, setAllUsers] = useState(() => {
    const saved = localStorage.getItem('registeredUsers');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'admin1', email: 'admin@jsa.com', password: 'admin123', role: 'admin', name: '系统管理员', createdAt: new Date().toISOString() },
      { id: 'teacher1', email: 'wang@school.com', password: 'wang123', role: 'teacher', teacherId: 'teacher_1', name: '王老师', createdAt: new Date().toISOString() },
      { id: 'teacher2', email: 'li@school.com', password: 'li123', role: 'teacher', teacherId: 'teacher_2', name: '李老师', createdAt: new Date().toISOString() },
      { id: 'teacher3', email: 'zhang@school.com', password: 'zhang123', role: 'teacher', teacherId: 'teacher_3', name: '张老师', createdAt: new Date().toISOString() },
      { id: 'student1', email: 'zhangsan@student.jsa.com', password: 'stu2024001', role: 'student', studentId: '2024001', name: '张三', createdAt: new Date().toISOString() },
    ];
  });

  const [studentList, setStudentList] = useState(() => {
    const saved = localStorage.getItem('studentList');
    if (saved) return JSON.parse(saved);
    return [
      { id: 1, name: '张三', studentId: '2024001', progress: 65, urgentTasks: 2, avatar: '👨‍🎓', teacherId: 'teacher_1', birthday: '', highSchool: '', languageSchool: '', jlptScore: '', ejuScores: [], englishScore: '', followUpNotes: '', photo: '' },
      { id: 2, name: '李四', studentId: '2024002', progress: 45, urgentTasks: 4, avatar: '👩‍🎓', teacherId: 'teacher_1', birthday: '', highSchool: '', languageSchool: '', jlptScore: '', ejuScores: [], englishScore: '', followUpNotes: '', photo: '' },
      { id: 3, name: '王五', studentId: '2024003', progress: 80, urgentTasks: 1, avatar: '👨‍🎓', teacherId: 'teacher_2', birthday: '', highSchool: '', languageSchool: '', jlptScore: '', ejuScores: [], englishScore: '', followUpNotes: '', photo: '' },
      { id: 4, name: '赵六', studentId: '2024004', progress: 55, urgentTasks: 3, avatar: '👩‍🎓', teacherId: 'teacher_2', birthday: '', highSchool: '', languageSchool: '', jlptScore: '', ejuScores: [], englishScore: '', followUpNotes: '', photo: '' },
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

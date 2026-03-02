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

// API 基础地址
// 生产环境：Cloudflare Pages 通过 public/_redirects 将 /api/* 代理到 Workers
// 本地开发：通过 vite proxy 代理到 localhost:8787
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// 通用 API 请求（带 token）
async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('authToken');
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  };
  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(err.message || `HTTP ${response.status}`);
  }
  if (response.status === 204) return null;
  const result = await response.json();
  return result.data !== undefined ? result.data : result;
}

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalError, setGlobalError] = useState(null);
  const [notification, setNotification] = useState(null);

  // studentList 从 API 获取，不再存 localStorage
  const [studentList, setStudentList] = useState([]);
  // allUsers 仅用于兼容旧代码，实际登录走 API
  const [allUsers, setAllUsers] = useState([]);
  // teacherList 从 API 获取并缓存到 state（同步可用）
  const [teacherList, setTeacherList] = useState([]);

  // 权限版本（用于触发权限重新计算）
  const [permissionVersion, setPermissionVersion] = useState(0);

  // 初始化：从 localStorage 恢复登录状态（token + user info）
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('authToken');
    if (savedUser && savedToken) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        // 验证 token 是否仍然有效
        apiRequest('/auth/verify').then(result => {
          if (result && result.user) {
            // token 有效，更新用户信息
            const updatedUser = {
              ...userData,
              ...result.user,
              role: result.user.role || userData.role,
              name: result.user.name || userData.name,
            };
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
          }
        }).catch(() => {
          // token 失效，清除登录状态
          setUser(null);
          localStorage.removeItem('user');
          localStorage.removeItem('authToken');
        });
      } catch (e) {
        localStorage.removeItem('user');
        localStorage.removeItem('authToken');
      }
    }
  }, []);

  // 登录后加载学生列表 + 老师列表
  useEffect(() => {
    if (!user) {
      setStudentList([]);
      setTeacherList([]);
      return;
    }
    loadStudentList();
    loadTeacherList();
  }, [user?.id]);

  const loadStudentList = useCallback(async () => {
    try {
      let data;
      if (user?.role === 'admin') {
        data = await apiRequest('/students');
      } else if (user?.role === 'teacher' && user?.teacherId) {
        data = await apiRequest(`/students/teacher/${user.teacherId}`);
      } else if (user?.role === 'student') {
        // 学生只能看自己
        const self = await apiRequest(`/students/${user.id}`);
        data = self ? [self] : [];
      } else {
        data = [];
      }
      setStudentList(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('加载学生列表失败:', e);
      setStudentList([]);
    }
  }, [user]);

  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // 登录：完全走 API，不再查 localStorage 中的 allUsers
  const handleLogin = useCallback(async (userData, token) => {
    if (token) {
      localStorage.setItem('authToken', token);
    }
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
    setStudentList([]);
    localStorage.removeItem('user');
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentStudent');
  }, []);

  // 加载老师列表到 state（异步调用，state 同步可读）
  const loadTeacherList = useCallback(async () => {
    try {
      const data = await apiRequest('/teachers');
      setTeacherList(Array.isArray(data) ? data : []);
    } catch {
      setTeacherList([]);
    }
  }, []);

  // getTeacherList 同步返回当前缓存的老师列表（非 async）
  const getTeacherList = useCallback(() => {
    return teacherList;
  }, [teacherList]);

  // 提供一个方法让 TeacherManagement 可以通知权限更新
  const refreshPermissions = useCallback(() => {
    setPermissionVersion(v => v + 1);
  }, []);

  // 权限检查：admin 拥有全部权限，teacher 根据 API 返回的权限列表判断
  const hasPermission = useCallback((permissionId) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.role === 'teacher') {
      // 从 localStorage 读取权限缓存（由 TeacherManagement 写入）
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
    user, setUser,
    allUsers, setAllUsers,          // 保留兼容性，但不再是主要数据源
    studentList, setStudentList,
    loadStudentList,                // 暴露刷新方法
    loadTeacherList,                // 暴露老师列表刷新方法
    globalLoading, setGlobalLoading,
    globalError, setGlobalError,
    notification, showNotification,
    handleLogin, handleLogout,
    getTeacherList,
    hasPermission, refreshPermissions,
    apiRequest,                     // 暴露通用请求方法
  }), [user, allUsers, studentList, teacherList, globalLoading, globalError, notification,
       showNotification, handleLogin, handleLogout, getTeacherList,
       hasPermission, refreshPermissions, loadStudentList, loadTeacherList]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

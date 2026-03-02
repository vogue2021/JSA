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

  // 设备唯一 ID（多端独立：每个浏览器/标签页有独立的 session token key）
  const [deviceId] = useState(() => {
    let id = sessionStorage.getItem('jsa_device_id');
    if (!id) {
      id = `device_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem('jsa_device_id', id);
    }
    return id;
  });

  // 每个设备使用独立的 token key（确保多端状态独立）
  const tokenKey = `authToken_${deviceId}`;
  const userKey = `user_${deviceId}`;

  // 初始化：从 localStorage 恢复登录状态（token + user info）
  useEffect(() => {
    // 同时检查旧的通用 key 和新的设备 key
    const savedUser = localStorage.getItem(userKey) || localStorage.getItem('user');
    const savedToken = localStorage.getItem(tokenKey) || localStorage.getItem('authToken');
    if (savedUser && savedToken) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        // 迁移到设备独立 key
        localStorage.setItem(tokenKey, savedToken);
        localStorage.setItem(userKey, savedUser);
        // 清除旧的通用 key（迁移一次）
        if (localStorage.getItem('authToken')) {
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
        }
        // 验证 token 是否仍然有效
        apiRequest('/auth/verify').then(result => {
          if (result && result.user) {
            const updatedUser = {
              ...userData,
              ...result.user,
              role: result.user.role || userData.role,
              name: result.user.name || userData.name,
            };
            setUser(updatedUser);
            localStorage.setItem(userKey, JSON.stringify(updatedUser));
          }
        }).catch(() => {
          setUser(null);
          localStorage.removeItem(userKey);
          localStorage.removeItem(tokenKey);
        });
      } catch (e) {
        localStorage.removeItem(userKey);
        localStorage.removeItem(tokenKey);
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

  // 登录：完全走 API，使用设备独立的 token key
  const handleLogin = useCallback(async (userData, token) => {
    if (token) {
      localStorage.setItem(tokenKey, token);
      // 兼容：也写入通用 key 供 apiRequest 使用
      localStorage.setItem('authToken', token);
    }
    setUser(userData);
    localStorage.setItem(userKey, JSON.stringify(userData));
  }, [tokenKey, userKey]);

  const handleLogout = useCallback(() => {
    setUser(null);
    setStudentList([]);
    // 只清除当前设备的 token（不影响其他设备）
    localStorage.removeItem(userKey);
    localStorage.removeItem(tokenKey);
    // 同时清除通用 key
    localStorage.removeItem('user');
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentStudent');
    localStorage.removeItem('activeTab');
  }, [tokenKey, userKey]);

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
      // 优先从 teacherList (API 数据) 中读取权限
      const teacherInfo = teacherList.find(t => t.teacher_id === user.teacherId);
      if (teacherInfo && Array.isArray(teacherInfo.permissions)) {
        return teacherInfo.permissions.includes(permissionId);
      }
      // 降级：从 localStorage 读取权限缓存
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
  }, [user, teacherList, permissionVersion]);

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

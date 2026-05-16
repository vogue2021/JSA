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
  const token = sessionStorage.getItem('authToken');
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
    // 401 = token 失效/过期，自动清除登录状态
    if (response.status === 401) {
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('authToken');
    }
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

  // 初始化：从 sessionStorage 恢复登录状态（token + user info）
  // 使用 sessionStorage 确保每个浏览器窗口/标签页独立，互不影响
  useEffect(() => {
    const savedUser = sessionStorage.getItem('user');
    const savedToken = sessionStorage.getItem('authToken');
    if (savedUser && savedToken) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        // 验证 token 是否仍然有效
        apiRequest('/auth/verify').then(result => {
          if (result && result.user) {
            const updatedUser = {
              ...userData,
              ...result.user,
              role: result.user.role || userData.role,
              name: result.user.name || userData.name,
              // 【新需求71】/auth/verify 现在会返回老师最新 permissions（管理员调整后无需重登），
              //   这里要确保 user.permissions 始终为数组，并合并进 sessionStorage。
              permissions: Array.isArray(result.user.permissions)
                ? result.user.permissions
                : (Array.isArray(userData.permissions) ? userData.permissions : []),
            };
            setUser(updatedUser);
            sessionStorage.setItem('user', JSON.stringify(updatedUser));
          }
        }).catch(() => {
          // token 失效，清除登录状态
          setUser(null);
          sessionStorage.removeItem('user');
          sessionStorage.removeItem('authToken');
        });
      } catch (e) {
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('authToken');
      }
    }
  }, []);

  // 登录后加载学生列表 + 老师列表
  // 【新需求72】关键修复：依赖项加入 user?.permissions 的字符串化形式 +  teacherList。
  //   背景：之前只依赖 user?.id —— 而管理员调权后老师刷新页面，
  //   首次 setUser(savedUser) 用的是旧 sessionStorage（permissions 还是旧值），
  //   立即触发一次 loadStudentList → 拉的还是只属于自己的学生；
  //   随后 /auth/verify 异步回填新 permissions，但 user.id 没变 →
  //   useEffect 不会再次触发 loadStudentList → 学生列表永远停在错误状态。
  //   现在依赖 user?.permissions 序列化后的版本，permissions 变化即重新拉取。
  const permissionsKey = Array.isArray(user?.permissions) ? user.permissions.slice().sort().join(',') : '';
  useEffect(() => {
    if (!user) {
      setStudentList([]);
      setTeacherList([]);
      return;
    }
    loadStudentList();
    loadTeacherList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role, user?.teacherId, permissionsKey]);

  const loadStudentList = useCallback(async () => {
    try {
      let data;
      if (user?.role === 'admin') {
        data = await apiRequest('/students');
      } else if (user?.role === 'teacher' && user?.teacherId) {
        // 【新需求68 任务3 / 新需求71】拥有 view_all_students 权限的老师走全量接口。
        //   排查：之前老师本人浏览器里没有 teacherList、也没有 teacherDetails 缓存，
        //   导致 useAll 永远 false，权限完全失效。
        //   现在 user.permissions 由后端登录/verify 注入，作为最权威来源；
        //   teacherList / localStorage 仅作为降级。
        let useAll = false;
        try {
          if (Array.isArray(user.permissions)) {
            useAll = user.permissions.includes('view_all_students');
          }
          if (!useAll) {
            const teacherInfo = teacherList.find(t => t.teacher_id === user.teacherId);
            if (teacherInfo && Array.isArray(teacherInfo.permissions)) {
              useAll = teacherInfo.permissions.includes('view_all_students');
            } else {
              const saved = localStorage.getItem('teacherDetails');
              if (saved) {
                const details = JSON.parse(saved);
                const detail = details[user.teacherId];
                if (detail && Array.isArray(detail.permissions)) {
                  useAll = detail.permissions.includes('view_all_students');
                }
              }
            }
          }
        } catch (_) { /* ignore */ }
        // ?all=1 在前后端都需要 view_all_students 权限：前端决定是否请求；
        //   后端 students.js 还会再做一次 teacherHasPerm 校验，防止越权。
        data = useAll
          ? await apiRequest('/students?all=1')
          : await apiRequest(`/students/teacher/${user.teacherId}`);
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
  }, [user, teacherList]);

  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // 登录：完全走 API
  const handleLogin = useCallback(async (userData, token) => {
    if (token) {
      sessionStorage.setItem('authToken', token);
    }
    setUser(userData);
    sessionStorage.setItem('user', JSON.stringify(userData));
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
    setStudentList([]);
    setTeacherList([]);
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('authToken');
    localStorage.removeItem('currentStudent');
    localStorage.removeItem('activeTab');
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
    if (user.role === 'teacher') {
      // 【新需求71】最权威来源：后端登录/verify 注入的 user.permissions（数组）。
      //   只要 user.permissions 是数组，就以它为唯一依据 —— 这样：
      //   1) 管理员勾选 view_all_students 后，老师下次刷新即生效；
      //   2) 管理员去掉某权限后也立刻生效，不再被 localStorage 旧值"复活"。
      //   仅当 user.permissions 不是数组（异常/旧 token）时，才走 teacherList / localStorage / 默认菜单兜底。
      // 【新需求73】严格按 user.permissions 数组判断，移除原先 edit_events/edit_schools/edit_materials
      //   的"legacyDefault 兜底" —— 该兜底导致管理员取消勾选"页面内编辑权限"后前端依旧放行，
      //   形成了 "数据范围权限生效、页面内编辑权限失效" 的 bug。修复后：未在数组里 = 没权限。
      if (Array.isArray(user.permissions)) {
        return user.permissions.includes(permissionId);
      }
      // 降级 1：从 teacherList (API 数据) 中读取权限
      const teacherInfo = teacherList.find(t => t.teacher_id === user.teacherId);
      if (teacherInfo && Array.isArray(teacherInfo.permissions)) {
        return teacherInfo.permissions.includes(permissionId);
      }
      // 降级 2：从 localStorage 读取权限缓存
      try {
        const saved = localStorage.getItem('teacherDetails');
        if (saved) {
          const details = JSON.parse(saved);
          const detail = details[user.teacherId];
          if (detail && Array.isArray(detail.permissions)) {
            return detail.permissions.includes(permissionId);
          }
        }
      } catch (e) { /* ignore */ }      // 【新需求68 任务4】manage_* 只控制"菜单是否显示在老师的控制台上"，
      //   edit_events / edit_schools / edit_materials 控制"页面内是否可增/改/删"。
      // 【新需求73】此处是"完全没有 permissions 数据"时的最终兜底，仅保留 manage_*（菜单可见性，
      //   缺失会导致所有菜单消失、体验损失大）；edit_* 必须由管理员显式授权，移除其兜底，
      //   避免老旧 token / 异常状态下"页面内编辑权限"被默默打开。
      //   view_all_students / edit_all_students 同样需要显式开启，不在此白名单内。
      return [
        'manage_students', 'manage_events', 'manage_schools', 'manage_materials',
      ].includes(permissionId);
    }
    return false;
  }, [user, teacherList, permissionVersion]);

  // 【新需求69】统一的"可编辑性"判断：
  //   scope 取值：'events' | 'schools' | 'materials' | 'students'
  //   - admin 永远可编辑
  //   - student 在自己页面可编辑（事件/材料）；不能编辑学校或他人数据
  //   - teacher 按 edit_* 权限判断
  const canEdit = useCallback((scope) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.role === 'student') {
      // 学生只能编辑自己的事件/材料；学校/学生信息不能编辑
      return scope === 'events' || scope === 'materials';
    }
    if (user.role === 'teacher') {
      const map = {
        events: 'edit_events',
        schools: 'edit_schools',
        materials: 'edit_materials',
        students: 'manage_students', // 学生信息编辑沿用旧 manage_students 含义
      };
      const permId = map[scope];
      return permId ? hasPermission(permId) : false;
    }
    return false;
  }, [user, hasPermission]);

  // 【新需求69】判断老师是否能编辑某个特定学生（结合数据范围权限）：
  //   - admin 可编辑任何学生
  //   - 学生本人可编辑自己
  //   - 老师默认只能编辑自己负责的（升学/学管/顾问）；
  //     如果勾选了 edit_all_students 权限，则可编辑所有学生；
  //     仅勾选 view_all_students 但未勾 edit_all_students，则可见但不可编辑
  const canEditStudent = useCallback((student) => {
    if (!user || !student) return false;
    if (user.role === 'admin') return true;
    if (user.role === 'student') {
      return String(student.studentId) === String(user.studentId)
          || String(student.id) === String(user.id);
    }
    if (user.role === 'teacher') {
      const isOwn = student.teacherId === user.teacherId
                 || student.academicAdvisorId === user.teacherId
                 || student.consultantId === user.teacherId;
      if (isOwn) return true;
      // 不是自己负责的学生 → 需要 edit_all_students 权限
      return hasPermission('edit_all_students');
    }
    return false;
  }, [user, hasPermission]);

  // 【新需求69】统一的"权限校验闸门"：返回 true 放行；返回 false 时已显示提示弹窗。
  //   用法：if (!requireEditPermission('events')) return;
  //   可选传入 student 对象做"数据范围"二次校验。
  const requireEditPermission = useCallback((scope, opts = {}) => {
    const { student, silent = false } = opts;
    // 1) 先看页面级编辑权限
    if (!canEdit(scope)) {
      if (!silent) {
        const scopeLabel = { events: '时间线', schools: '学校', materials: '材料', students: '学生信息' }[scope] || '该页面';
        showNotification(`您当前没有 ${scopeLabel} 的编辑权限，请联系管理员开通`, 'error');
      }
      return false;
    }
    // 2) 再看具体学生的数据范围
    if (student && !canEditStudent(student)) {
      if (!silent) {
        showNotification('该学生不在您的负责范围内，请联系管理员开通"编辑所有学生"权限', 'error');
      }
      return false;
    }
    return true;
  }, [canEdit, canEditStudent, showNotification]);

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
    // 【新需求69】对外暴露三个权限助手
    canEdit, canEditStudent, requireEditPermission,
    apiRequest,                     // 暴露通用请求方法
  }), [user, allUsers, studentList, teacherList, globalLoading, globalError, notification,
       showNotification, handleLogin, handleLogout, getTeacherList,
       hasPermission, refreshPermissions, loadStudentList, loadTeacherList,
       canEdit, canEditStudent, requireEditPermission]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

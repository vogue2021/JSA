// API 配置文件 - 前端与后端通信
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// 通用 API 请求函数
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = sessionStorage.getItem('authToken');
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));

      // 账号被禁用：清除 token 并强制退出登录
      if (response.status === 403 && errorData.code === 'ACCOUNT_DISABLED') {
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('user');
        localStorage.removeItem('currentStudent');
        alert('您的账号已被禁用，请联系管理员。');
        window.location.reload();
        return;
      }

      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    // 处理 204 No Content 响应
    if (response.status === 204) {
      return null;
    }

    const result = await response.json();

    // 后端返回格式: { success: true, data: [...] }
    // 提取 data 字段，如果不存在则返回整个结果
    return result.data !== undefined ? result.data : result;
  } catch (error) {
    console.error(`API请求失败: ${endpoint}`, error);
    throw error;
  }
}

// 学校 API
export const schoolsAPI = {
  getByStudent: async (studentId) => {
    return await apiRequest(`/schools/student/${studentId}`);
  },
  // 获取全局学校报考统计（仪表盘使用）
  getStats: async ({ teacherId } = {}) => {
    const params = new URLSearchParams();
    if (teacherId) params.append('teacher_id', teacherId);
    const qs = params.toString();
    return await apiRequest(`/schools/stats${qs ? '?' + qs : ''}`);
  },
  // 获取全局事件统计（仪表盘使用）
  getEventStats: async ({ teacherId } = {}) => {
    const params = new URLSearchParams();
    if (teacherId) params.append('teacher_id', teacherId);
    const qs = params.toString();
    return await apiRequest(`/schools/stats/events${qs ? '?' + qs : ''}`);
  },
  create: async (schoolData) => {
    return await apiRequest('/schools', {
      method: 'POST',
      body: JSON.stringify(schoolData),
    });
  },
  update: async (schoolId, schoolData) => {
    return await apiRequest(`/schools/${schoolId}`, {
      method: 'PUT',
      body: JSON.stringify(schoolData),
    });
  },
  delete: async (schoolId) => {
    return await apiRequest(`/schools/${schoolId}`, {
      method: 'DELETE',
    });
  },
};

// 事件 API
export const eventsAPI = {
  getByStudent: async (studentId) => {
    return await apiRequest(`/events/student/${studentId}`);
  },
  create: async (eventData) => {
    return await apiRequest('/events', {
      method: 'POST',
      body: JSON.stringify(eventData),
    });
  },
  update: async (eventId, eventData) => {
    return await apiRequest(`/events/${eventId}`, {
      method: 'PUT',
      body: JSON.stringify(eventData),
    });
  },
  delete: async (eventId) => {
    return await apiRequest(`/events/${eventId}`, {
      method: 'DELETE',
    });
  },
  // 切换事件完成状态（幂等版）
  toggleComplete: async (eventId) => {
    return await apiRequest(`/events/${eventId}/toggle`, {
      method: 'PATCH',
    });
  },
};

// 材料 API
export const materialsAPI = {
  getByStudent: async (studentId) => {
    return await apiRequest(`/materials/student/${studentId}`);
  },
  create: async (materialData) => {
    return await apiRequest('/materials', {
      method: 'POST',
      body: JSON.stringify(materialData),
    });
  },
  update: async (materialId, materialData) => {
    return await apiRequest(`/materials/${materialId}`, {
      method: 'PUT',
      body: JSON.stringify(materialData),
    });
  },
  delete: async (materialId) => {
    return await apiRequest(`/materials/${materialId}`, {
      method: 'DELETE',
    });
  },
  updateStatus: async (materialId, completed, checkedBy) => {
    return await apiRequest(`/materials/${materialId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ completed, checked_by: checkedBy }),
    });
  },
  toggle: async (materialId, checkedBy) => {
    return await apiRequest(`/materials/${materialId}/toggle`, {
      method: 'PATCH',
      body: JSON.stringify({ checked_by: checkedBy }),
    });
  },
};

// 学生 API
export const studentsAPI = {
  getAll: async () => {
    return await apiRequest('/students');
  },
  getByTeacher: async (teacherId) => {
    return await apiRequest(`/students/teacher/${teacherId}`);
  },
  getById: async (id) => {
    return await apiRequest(`/students/${id}`);
  },
  // 新需求43：创建学生（可选同时创建登录账号，传 password 即可）
  create: async (data) => {
    return await apiRequest('/students', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  update: async (id, data) => {
    return await apiRequest(`/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  delete: async (id) => {
    return await apiRequest(`/students/${id}`, {
      method: 'DELETE',
    });
  },
  transfer: async (id, teacherId) => {
    return await apiRequest(`/students/${id}/transfer`, {
      method: 'PUT',
      body: JSON.stringify({ teacher_id: teacherId }),
    });
  },
  search: async (query, teacherId) => {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (teacherId) params.append('teacher_id', teacherId);
    return await apiRequest(`/students/search/query?${params.toString()}`);
  },
  addNote: async (id, content) => {
    return await apiRequest(`/students/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },
  deleteNote: async (id, noteId) => {
    return await apiRequest(`/students/${id}/notes/${noteId}`, {
      method: 'DELETE',
    });
  },
};

// 老师 API
export const teachersAPI = {
  getAll: async () => {
    return await apiRequest('/teachers');
  },
  getById: async (id) => {
    return await apiRequest(`/teachers/${id}`);
  },
  getStudents: async (id) => {
    return await apiRequest(`/teachers/${id}/students`);
  },
  create: async (data) => {
    return await apiRequest('/teachers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  update: async (id, data) => {
    return await apiRequest(`/teachers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  delete: async (id) => {
    return await apiRequest(`/teachers/${id}`, {
      method: 'DELETE',
    });
  },
};

// 学校信息库 API（D1 数据库同步）
export const schoolDatabaseAPI = {
  getAll: async (params = {}) => {
    const qs = new URLSearchParams();
    if (params.type) qs.append('type', params.type);
    if (params.search) qs.append('search', params.search);
    const queryStr = qs.toString();
    return await apiRequest(`/school-database${queryStr ? '?' + queryStr : ''}`);
  },
  getById: async (id) => {
    return await apiRequest(`/school-database/${id}`);
  },
  create: async (data) => {
    return await apiRequest('/school-database', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  update: async (id, data) => {
    return await apiRequest(`/school-database/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  delete: async (id) => {
    return await apiRequest(`/school-database/${id}`, {
      method: 'DELETE',
    });
  },
  batchImport: async (schools) => {
    return await apiRequest('/school-database/batch', {
      method: 'POST',
      body: JSON.stringify({ schools }),
    });
  },
};

// 用户管理 API（仅管理员）
export const usersAPI = {
  getAll: async () => {
    return await apiRequest('/users');
  },
  delete: async (id) => {
    return await apiRequest(`/users/${id}`, {
      method: 'DELETE',
    });
  },
  // 禁用/启用账号
  toggleActive: async (id) => {
    return await apiRequest(`/users/${id}/toggle-active`, {
      method: 'PUT',
    });
  },
  // 创建管理员账号
  createAdmin: async (data) => {
    return await apiRequest('/users/create-admin', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// 反馈 API
export const feedbackAPI = {
  // 提交反馈（公开，无需登录）
  submit: async (data) => {
    return await apiRequest('/feedback', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  // 管理员查询反馈列表
  getList: async ({ status, type, page = 1, pageSize = 20 } = {}) => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (type) params.append('type', type);
    params.append('page', page);
    params.append('pageSize', pageSize);
    return await apiRequest(`/feedback?${params.toString()}`);
  },
  // 管理员更新反馈状态
  updateStatus: async (id, data) => {
    return await apiRequest(`/feedback/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
};

// ─── 截止日提醒 API ──────────────────────────────────────────────────────────
export const remindersAPI = {
  // 获取今天需要提醒的截止事项
  getToday: async () => {
    return await apiRequest('/reminders/today');
  },
  // 确认提醒
  acknowledge: async (eventId, eventTitle) => {
    return await apiRequest('/reminders/acknowledge', {
      method: 'POST',
      body: JSON.stringify({ eventId, eventTitle }),
    });
  },
  // 获取学生的提醒确认历史
  getHistory: async (studentId) => {
    return await apiRequest(`/reminders/history/${studentId}`);
  },
  // 获取事件确认状态（用于时间线卡片显示"学生已确认"）
  getAcknowledged: async (studentId) => {
    return await apiRequest(`/reminders/acknowledged/${studentId}`);
  },
  // 获取提醒设置（需求56：老师可传 studentId 读取指定学生的设置）
  getSettings: async (studentId) => {
    const qs = studentId ? `?studentId=${encodeURIComponent(studentId)}` : '';
    return await apiRequest(`/reminders/settings${qs}`);
  },
  // 保存提醒设置（需求56：老师可传 targetStudentIds / applyToAllMyStudents 批量写入）
  saveSettings: async (settings) => {
    return await apiRequest('/reminders/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  },
};

// ─── 认证 API ────────────────────────────────────────────────────────────────
export const authAPI = {
  // 明学账号登录
  mingxueLogin: async (username, password) => {
    return await apiRequest('/auth/mingxue-login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },
};

// ─── 塾内备考资料库 API（需求38）──────────────────────────────────────────────
export const studyResourcesAPI = {
  // 列表查询：search, category, is_public（'0'/'1'，仅老师/管理员可过滤）
  list: async ({ search, category, is_public } = {}) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (category) params.append('category', category);
    if (is_public === '0' || is_public === '1' || is_public === 0 || is_public === 1) {
      params.append('is_public', String(is_public));
    }
    const qs = params.toString();
    return await apiRequest(`/study-resources${qs ? '?' + qs : ''}`);
  },
  get: async (id) => {
    return await apiRequest(`/study-resources/${id}`);
  },
  create: async (data) => {
    return await apiRequest('/study-resources', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  update: async (id, data) => {
    return await apiRequest(`/study-resources/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  // 快速切换公开/私密
  setVisibility: async (id, isPublic) => {
    return await apiRequest(`/study-resources/${id}/visibility`, {
      method: 'PATCH',
      body: JSON.stringify({ is_public: !!isPublic }),
    });
  },
  delete: async (id) => {
    return await apiRequest(`/study-resources/${id}`, {
      method: 'DELETE',
    });
  },
};

// ─── 学邦数据同步 API ────────────────────────────────────────────────────────
export const xuebangAPI = {
  // 获取学邦配置状态
  getConfig: async () => {
    return await apiRequest('/xuebang/config');
  },
  // 预览学邦学生数据（不执行同步）
  preview: async () => {
    return await apiRequest('/xuebang/preview');
  },
  // 执行同步
  sync: async ({ selectedIds, defaultTeacherId, defaultPassword } = {}) => {
    return await apiRequest('/xuebang/sync', {
      method: 'POST',
      body: JSON.stringify({ selectedIds, defaultTeacherId, defaultPassword }),
    });
  },
  // 刷新已关联学生的信息
  refresh: async () => {
    return await apiRequest('/xuebang/refresh', {
      method: 'POST',
    });
  },
  // 获取同步历史日志
  getSyncLogs: async () => {
    return await apiRequest('/xuebang/sync-logs');
  },
};

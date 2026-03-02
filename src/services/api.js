// API 配置文件 - 前端与后端通信
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// 通用 API 请求函数
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = localStorage.getItem('authToken');
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

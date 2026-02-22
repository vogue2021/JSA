// API 配置文件 - 前端与后端通信
const API_BASE_URL = 'http://localhost:3001/api';

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

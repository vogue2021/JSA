import React, { useState, useEffect } from 'react';
import {
  Calendar, Clock, School, FileText, CheckSquare, Plus,
  ChevronRight, AlertCircle, Edit, Users, LogOut, Save,
  X, User, Bell, Search, Filter, Download, Upload,
  Menu, ChevronDown, Eye, Trash2, Check, Edit2, UserCheck,
  GraduationCap, Mail, Lock, ArrowRight, Link2, ExternalLink,
  BookOpen, Home, Settings, HelpCircle, ChevronLeft, Shield, UserPlus,
  LayoutGrid, LayoutList, UserCircle, BarChart3, Palette, Sun, Moon
} from 'lucide-react';
import { schoolsAPI, eventsAPI, materialsAPI, feedbackAPI, usersAPI } from './services/api';
import { AppProvider, useApp } from './context/AppContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import ThemeCustomizer from './components/ThemeCustomizer';
import ErrorBoundary from './components/common/ErrorBoundary';
import Notification from './components/common/Notification';
import StudentProfile from './components/StudentProfile';
import TimelineLinear from './components/TimelineLinear';
import TeacherManagement from './components/TeacherManagement';
import SchoolDatabase from './components/SchoolDatabase';
import SettingsPage from './components/SettingsPage';
import CalendarView from './components/CalendarView';
import UpcomingSchools from './components/UpcomingSchools';
import Dashboard from './components/Dashboard';
import StudentListPage from './components/StudentListPage';
import AuthPage from './components/AuthPage';
import { exportStudentToCSV, exportEventsToICS, exportChecklistToPDF } from './utils/exportUtils';
import { generateTestData } from './utils/generateTestData';
import { logAction, logInfo, logError, LOG_CATEGORIES } from './utils/logService';

// ErrorBoundary 已拆分到 src/components/common/ErrorBoundary.jsx
// AuthPage 已拆分到 src/components/AuthPage.jsx

// 主应用组件
const MainApp = ({ user, onLogout, allUsers, setAllUsers, studentList, setStudentList }) => {
  const { hasPermission, showNotification } = useApp();
  // 先初始化 currentStudent - 从 localStorage 恢复或使用默认值
  const [currentStudent, setCurrentStudent] = useState(() => {
    // 尝试从 localStorage 恢复上次选择的学生
    const savedStudent = localStorage.getItem('currentStudent');
    if (savedStudent) {
      try {
        return JSON.parse(savedStudent);
      } catch (e) {
        console.error('Failed to parse saved student:', e);
      }
    }

    // 如果没有保存的学生,使用默认值
    if (user.role === 'student') {
      return {
        id: 1,
        name: user.name,
        studentId: user.studentId,
        email: user.email,
        targetCountry: '日本',
        targetLevel: '修士',
        avatar: '👨‍🎓',
        teacherId: user.teacherId
      };
    } else {
      return {
        id: 1,
        name: '张三',
        studentId: '2024001',
        targetCountry: '日本',
        targetLevel: '修士',
        email: 'zhangsan@example.com',
        avatar: '👨‍🎓',
        teacherId: user.teacherId || 'teacher_1'
      };
    }
  });

  const [activeTab, setActiveTabRaw] = useState(() => {
    // 从 localStorage 恢复上次所在页面
    const savedTab = localStorage.getItem('activeTab');
    if (savedTab) return savedTab;
    // 老师和管理员默认进入仪表盘，学生进入时间线
    return (user.role === 'teacher' || user.role === 'admin') ? 'dashboard' : 'timeline';
  });
  // 包装 setActiveTab，自动持久化到 localStorage
  const setActiveTab = (tab) => {
    setActiveTabRaw(tab);
    localStorage.setItem('activeTab', tab);
  };
  const [settingsInitTab, setSettingsInitTab] = useState(null);
  const [showStudentList, setShowStudentList] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [timelineViewMode, setTimelineViewMode] = useState('card'); // 'card' or 'linear'
  const [showStudentProfile, setShowStudentProfile] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [schoolDetailModal, setSchoolDetailModal] = useState(null); // 学生点击学校卡片弹窗
  const [showSidebarUserMenu, setShowSidebarUserMenu] = useState(false); // 侧边栏头像菜单

  // 学生数据存储（按学生ID隔离）- 从 API 加载，不再用 localStorage
  const [studentData, setStudentData] = useState({});
  const [studentDataLoading, setStudentDataLoading] = useState(false);

  // API 基础地址
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

  // 通用 API 请求（带 token）
  const apiReq = async (endpoint, options = {}) => {
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
  };

  // 从 API 加载当前学生的 events/schools/materials
  const loadStudentDataFromAPI = async (studentId) => {
    if (!studentId) return;
    setStudentDataLoading(true);
    try {
      const [eventsData, schoolsData, materialsData] = await Promise.all([
        apiReq(`/events/student/${studentId}`).catch(() => []),
        apiReq(`/schools/student/${studentId}`).catch(() => []),
        apiReq(`/materials/student/${studentId}`).catch(() => ({ general: [], schoolSpecific: {} })),
      ]);

      // 将 API 返回的 events 转换为前端格式
      const events = Array.isArray(eventsData) ? eventsData.map(e => ({
        id: e.id,
        type: e.type,
        title: e.title,
        date: e.date,
        daysLeft: e.days_left,
        category: e.category,
        urgent: Boolean(e.urgent),
        notes: e.notes || '',
        completed: Boolean(e.completed),
        schoolId: e.school_id || null,
      })) : [];

      // 将 API 返回的 schools 转换为前端格式
      const schools = Array.isArray(schoolsData) ? schoolsData.map(s => ({
        id: s.id,
        name: s.name,
        nameJa: s.name_ja || '',
        type: s.type,
        program: s.program,
        status: s.status,
        applicationStartDate: s.application_start_date,
        applicationEndDate: s.application_end_date,
        examDate: s.exam_date,
        resultDate: s.result_date,
        requirementsUrl: s.requirements_url || '',
        teacherNotes: s.teacher_notes || '',
        materials: Array.isArray(s.materials) ? s.materials : [],
      })) : [];

      // 将 API 返回的 materials 转换为前端 checklist 格式
      const general = Array.isArray(materialsData?.general) ? materialsData.general.map(m => ({
        id: m.id,
        item: m.item,
        completed: Boolean(m.completed),
        deadline: m.deadline,
        checkedBy: m.checked_by || null,
        checkedAt: m.checked_at || null,
        url: m.url || '',
      })) : [];

      const schoolSpecific = {};
      if (materialsData?.schoolSpecific) {
        Object.entries(materialsData.schoolSpecific).forEach(([schoolName, mats]) => {
          schoolSpecific[schoolName] = mats.map(m => ({
            id: m.id,
            item: m.item,
            completed: Boolean(m.completed),
            deadline: m.deadline,
            checkedBy: m.checked_by || null,
            checkedAt: m.checked_at || null,
            url: m.url || '',
          }));
        });
      }

      setStudentData(prev => ({
        ...prev,
        [studentId]: { events, schools, checklist: { general, schoolSpecific } }
      }));
    } catch (err) {
      console.error('加载学生数据失败:', err);
      // 降级：使用空数据
      setStudentData(prev => ({
        ...prev,
        [studentId]: { events: [], schools: [], checklist: { general: [], schoolSpecific: {} } }
      }));
    } finally {
      setStudentDataLoading(false);
    }
  };

  // 获取当前学生的数据
  const getStudentDataKey = () => {
    return currentStudent?.studentId || 'default';
  };

  // 获取或初始化学生数据（返回空数据，实际数据由 API 加载）
  const getOrInitStudentData = () => {
    const key = getStudentDataKey();
    if (!studentData || !studentData[key]) {
      return {
        events: [],
        schools: [],
        checklist: { general: [], schoolSpecific: {} }
      };
    }
    return studentData[key];
  };

  // 获取当前学生的数据 - 使用useMemo确保响应式更新
  const currentStudentData = React.useMemo(() => {
    try {
      return getOrInitStudentData();
    } catch (error) {
      console.error('Error getting student data:', error);
      // 返回默认数据以防出错
      return {
        events: [],
        schools: [],
        checklist: { general: [], schoolSpecific: {} }
      };
    }
  }, [studentData, currentStudent?.studentId]);

  const upcomingEvents = currentStudentData.events || [];
  const schools = currentStudentData.schools || [];
  const checklist = currentStudentData.checklist || {};

  // 切换学生时从 API 加载数据（每次切换都重新加载以确保数据实时）
  useEffect(() => {
    const studentId = currentStudent?.studentId;
    if (studentId) {
      loadStudentDataFromAPI(studentId);
    }
  }, [currentStudent?.studentId]);

  // 设置事件更新函数 - 调用 API
  const setUpcomingEvents = async (newEvents) => {
    const key = getStudentDataKey();
    const resolvedEvents = typeof newEvents === 'function' ? newEvents(upcomingEvents) : newEvents;
    // 乐观更新本地状态
    setStudentData(prev => ({
      ...prev,
      [key]: { ...getOrInitStudentData(), events: resolvedEvents }
    }));
    // 注意：事件的增删改由各自的 Modal 直接调用 API，这里只做本地状态同步
  };

  // 设置学校更新函数 - 调用 API
  const setSchools = async (newSchools) => {
    const key = getStudentDataKey();
    const resolvedSchools = typeof newSchools === 'function' ? newSchools(schools) : newSchools;
    // 乐观更新本地状态
    setStudentData(prev => ({
      ...prev,
      [key]: { ...getOrInitStudentData(), schools: resolvedSchools }
    }));
    // 注意：学校的增删改由各自的 Modal 直接调用 API，这里只做本地状态同步
  };

  // 设置清单更新函数 - 调用 API
  const setChecklist = async (newChecklist) => {
    const key = getStudentDataKey();
    const resolvedChecklist = typeof newChecklist === 'function' ? newChecklist(checklist) : newChecklist;
    // 乐观更新本地状态
    setStudentData(prev => ({
      ...prev,
      [key]: { ...getOrInitStudentData(), checklist: resolvedChecklist }
    }));
    // 注意：材料的增删改由各自的 Modal 直接调用 API，这里只做本地状态同步
  };

  // Modal states
  const [showEventModal, setShowEventModal] = useState(false);
  const [showSchoolModal, setShowSchoolModal] = useState(false);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showAddTeacherModal, setShowAddTeacherModal] = useState(false);
  const [showAccountManagementModal, setShowAccountManagementModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsModalInitTab, setSettingsModalInitTab] = useState(null);
  const [showThemeCustomizer, setShowThemeCustomizer] = useState(false);
  const [showChangelogPanel, setShowChangelogPanel] = useState(false);
  const [showFeedbackPanel, setShowFeedbackPanel] = useState(false);
  const [showFeedbackHistory, setShowFeedbackHistory] = useState(false);
  const [feedbackType, setFeedbackType] = useState('suggestion');
  const [feedbackContent, setFeedbackContent] = useState('');
  const [feedbackContact, setFeedbackContact] = useState('');
  const [editingEvent, setEditingEvent] = useState(null);
  const [editingSchool, setEditingSchool] = useState(null);
  const [editingMaterial, setEditingMaterial] = useState(null);

  // 注意：此应用使用localStorage作为数据存储，不依赖后端API
  // 数据会通过studentData state自动管理和持久化

  // 保存当前学生到 localStorage
  useEffect(() => {
    if (currentStudent) {
      localStorage.setItem('currentStudent', JSON.stringify(currentStudent));
    }
  }, [currentStudent]);

  // 检测屏幕大小
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);

    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // 登录成功后显示欢迎通知
  useEffect(() => {
    if (user && showNotification) {
      const roleLabel = user.role === 'admin' ? '管理员' : user.role === 'teacher' ? '老师' : '学生';
      showNotification(`欢迎回来，${user.name}（${roleLabel}）`);
    }
  }, []); // 只在MainApp首次挂载时触发一次


  // 老师列表: 优先使用 AppContext 中从 API 加载的 teacherList，兼容 allUsers
  const { getTeacherList: getTeacherListFromCtx, loadTeacherList: refreshTeacherList } = useApp();
  const getTeacherList = () => {
    const apiTeachers = getTeacherListFromCtx();
    if (apiTeachers && apiTeachers.length > 0) {
      return apiTeachers.map(t => ({
        id: t.teacher_id || t.teacherId || t.id,
        teacherId: t.teacher_id || t.teacherId || t.id,
        name: t.name,
        email: t.email || t.email_contact || '',
      }));
    }
    // 回退到 allUsers（兼容）
    return allUsers
      .filter(u => u.role === 'teacher')
      .map(u => ({
        id: u.teacherId,
        teacherId: u.teacherId,
        name: u.name,
        email: u.email
      }));
  };

  // 动态获取所有学生列表
  const getAllStudents = () => {
    // 从allUsers中获取所有学生用户
    const studentUsers = allUsers.filter(u => u.role === 'student');

    // 合并静态studentList和动态用户数据
    const mergedStudents = [];

    // 首先添加studentList中的学生（保留详细信息）
    studentList.forEach(s => {
      mergedStudents.push(s);
    });

    // 然后检查是否有新注册的学生不在studentList中
    studentUsers.forEach(user => {
      if (!studentList.find(s => s.studentId === user.studentId)) {
        // 添加新注册的学生
        mergedStudents.push({
          id: Date.now() + Math.random(),
          name: user.name,
          studentId: user.studentId,
          progress: 0,
          urgentTasks: 0,
          avatar: '👨‍🎓',
          teacherId: user.teacherId || 'teacher_1',
          email: user.email
        });
      }
    });

    return mergedStudents;
  };

  // 根据权限获取可见的学生列表
  const getVisibleStudents = () => {
    const allStudents = getAllStudents();

    if (user.role === 'admin') {
      return allStudents; // 管理员看到所有学生
    } else if (user.role === 'teacher') {
      // 老师看到自己作为升学老师或学管老师负责的学生
      return allStudents.filter(s => s.teacherId === user.teacherId || s.academicAdvisorId === user.teacherId);
    }
    return []; // 学生不需要看到学生列表
  };

  // 判断当前是否有有效的学生数据可展示
  // 管理员和老师如果 currentStudent 能在 studentList 中匹配到，就视为有学生数据
  const adminHasOwnStudents = React.useMemo(() => {
    if (user.role === 'student') return true;
    // 检查 currentStudent 是否是一个真实学生（在 studentList 中）
    const hasValidStudent = studentList.some(s => s.studentId === currentStudent.studentId);
    return hasValidStudent;
  }, [user, studentList, currentStudent]);

  // 管理员公共视图组件（不带学生时显示统计和公共信息）
  const AdminPublicView = ({ type, onNavigate, onSelectStudent }) => (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-xl p-8 text-center" style={{ background: isDark ? 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(59,130,246,0.08))' : 'linear-gradient(135deg, #f3f4f6, #eff6ff)' }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: isDark ? 'rgba(59,130,246,0.15)' : '#dbeafe' }}>
          {type === 'timeline' && <Clock size={32} className="text-blue-500" />}
          {type === 'schools' && <School size={32} className="text-green-500" />}
          {type === 'checklist' && <CheckSquare size={32} className="text-purple-500" />}
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: tokens.colors.text.primary }}>
          {type === 'timeline' ? '时间线' : type === 'schools' ? '学校' : '材料清单'}
        </h2>
        <p className="mb-4" style={{ color: tokens.colors.text.secondary }}>
          管理员账号当前未绑定学生。{type === 'timeline' ? '时间线' : type === 'schools' ? '学校申请' : '材料清单'}显示的是具体学生的数据。
        </p>
        <p className="text-sm mb-6" style={{ color: tokens.colors.text.muted }}>
          请先从学生列表选择一位学生查看详情，或前往仪表盘查看整体统计数据。
        </p>
        <div className="flex justify-center gap-3">
          <button onClick={onSelectStudent}
            className="px-6 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium flex items-center gap-2">
            <Users size={18} /> 选择学生
          </button>
          <button onClick={() => onNavigate('dashboard')}
            className="px-6 py-2.5 rounded-lg transition font-medium flex items-center gap-2" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb', color: tokens.colors.text.primary }}>
            <Home size={18} /> 返回仪表盘
          </button>
        </div>
      </div>
    </div>
  );

  // 生成学号
  const generateStudentId = () => {
    const year = new Date().getFullYear();
    const existingIds = studentList.map(s => parseInt(s.studentId));
    const maxId = Math.max(...existingIds, year * 1000);
    return String(maxId + 1);
  };

  // 计算天数差
  const calculateDaysLeft = (dateString) => {
    const targetDate = new Date(dateString);
    const today = new Date();
    const diffTime = targetDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // 同步学校日期到时间线
  const syncSchoolDatesToTimeline = (school, isNew = false) => {
    const eventsToAdd = [];

    if (school.applicationStartDate) {
      eventsToAdd.push({
        id: Date.now() + Math.random(),
        type: 'deadline',
        title: `${school.name} 出愿开始`,
        date: school.applicationStartDate,
        daysLeft: calculateDaysLeft(school.applicationStartDate),
        category: '出愿',
        urgent: calculateDaysLeft(school.applicationStartDate) <= 7,
        notes: `${school.program} 出愿开始，请准备材料`,
        completed: false,
        schoolId: school.id
      });
    }

    if (school.applicationEndDate) {
      eventsToAdd.push({
        id: Date.now() + Math.random() + 1,
        type: 'deadline',
        title: `${school.name} 出愿截止`,
        date: school.applicationEndDate,
        daysLeft: calculateDaysLeft(school.applicationEndDate),
        category: '出愿',
        urgent: true,
        notes: `${school.program} 出愿截止，务必在此之前提交`,
        completed: false,
        schoolId: school.id
      });
    }

    if (school.examDate) {
      eventsToAdd.push({
        id: Date.now() + Math.random() + 2,
        type: 'exam',
        title: `${school.name} 入学考试`,
        date: school.examDate,
        daysLeft: calculateDaysLeft(school.examDate),
        category: '考试',
        urgent: calculateDaysLeft(school.examDate) <= 14,
        notes: `${school.program} 入学考试`,
        completed: false,
        schoolId: school.id
      });
    }

    if (school.resultDate) {
      eventsToAdd.push({
        id: Date.now() + Math.random() + 3,
        type: 'deadline',
        title: `${school.name} 合格发表`,
        date: school.resultDate,
        daysLeft: calculateDaysLeft(school.resultDate),
        category: '合格发表',
        urgent: false,
        notes: `${school.program} 合格发表日`,
        completed: false,
        schoolId: school.id
      });
    }

    if (isNew) {
      setUpcomingEvents(prev => [...prev, ...eventsToAdd]);
    } else {
      setUpcomingEvents(prev => {
        const filtered = prev.filter(e => e.schoolId !== school.id);
        return [...filtered, ...eventsToAdd];
      });
    }
  };

  // 同步学校材料到材料清单
  const syncSchoolMaterialsToChecklist = (school, materials) => {
    const newChecklist = {...checklist};

    if (!newChecklist.schoolSpecific[school.name]) {
      newChecklist.schoolSpecific[school.name] = [];
    }

    const schoolMaterials = materials.map((material, index) => ({
      id: Date.now() + index,
      item: material.name,
      completed: false,
      deadline: material.deadline || school.applicationEndDate,
      checkedBy: null,
      checkedAt: null,
      url: material.url || ''
    }));

    newChecklist.schoolSpecific[school.name] = schoolMaterials;
    setChecklist(newChecklist);
  };

  // 计算学校的任务完成度（只基于学校专用材料）
  const calculateSchoolProgress = (schoolName) => {
    const schoolMaterials = checklist.schoolSpecific?.[schoolName] || [];
    const schoolCompleted = schoolMaterials.filter(item => item.completed).length;
    const schoolTotal = schoolMaterials.length;

    return {
      completed: schoolCompleted,
      total: schoolTotal,
      percentage: schoolTotal > 0 ? Math.round((schoolCompleted / schoolTotal) * 100) : 0
    };
  };

  // 过滤事件
  const filteredEvents = upcomingEvents
    .filter(event => {
      const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filterCategory === 'all' || event.category === filterCategory;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const getStatusColor = (status) => {
    const colors = {
      not_started: isDark ? 'bg-[rgba(156,163,175,0.15)] text-gray-400 border-[rgba(156,163,175,0.3)]' : 'bg-gray-100 text-gray-600 border-gray-200',
      preparing: isDark ? 'bg-[rgba(59,130,246,0.15)] text-blue-400 border-[rgba(59,130,246,0.3)]' : 'bg-blue-100 text-blue-700 border-blue-200',
      applied: isDark ? 'bg-[rgba(34,197,94,0.15)] text-green-400 border-[rgba(34,197,94,0.3)]' : 'bg-green-100 text-green-700 border-green-200',
      submitted: isDark ? 'bg-[rgba(249,115,22,0.15)] text-orange-400 border-[rgba(249,115,22,0.3)]' : 'bg-orange-100 text-orange-700 border-orange-200',
      admitted: isDark ? 'bg-[rgba(234,179,8,0.15)] text-yellow-400 border-[rgba(234,179,8,0.3)]' : 'bg-yellow-100 text-yellow-700 border-yellow-200',
      rejected: isDark ? 'bg-[rgba(239,68,68,0.15)] text-red-400 border-[rgba(239,68,68,0.3)]' : 'bg-red-100 text-red-700 border-red-200',
    };
    return colors[status] || (isDark ? 'bg-[rgba(255,255,255,0.06)] text-gray-300 border-[rgba(255,255,255,0.1)]' : 'bg-gray-100 text-gray-700 border-gray-200');
  };

  const getStatusText = (status) => {
    const texts = {
      not_started: '未开始',
      preparing: '准备中',
      applied: '出愿完成',
      submitted: '邮寄完成',
      admitted: '合格',
      rejected: '未合格',
    };
    return texts[status] || '未开始';
  };

  const getTypeColor = (type) => {
    const colors = {
      exam: 'bg-red-50 border-red-200',
      deadline: 'bg-orange-50 border-orange-200',
      interview: 'bg-purple-50 border-purple-200',
      document: 'bg-green-50 border-green-200',
    };
    return colors[type] || (isDark ? 'bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.08)]' : 'bg-gray-50 border-gray-200');
  };

  const getTypeIcon = (type) => {
    const icons = {
      exam: '📝',
      deadline: '⏰',
      interview: '🎤',
      document: '📄',
    };
    return icons[type] || '📌';
  };

  // 删除事件
  const handleDeleteEvent = async (eventId) => {
    if (window.confirm('确定要删除这个事项吗？')) {
      try {
        await apiReq(`/events/${eventId}`, { method: 'DELETE' });
        await loadStudentDataFromAPI(currentStudent?.studentId);
        if (showNotification) showNotification('事项已删除');
      } catch (err) {
        console.error('删除事件失败:', err);
        if (showNotification) showNotification('删除失败：' + err.message, 'error');
      }
    }
  };

  // 删除学校
  const handleDeleteSchool = async (schoolId) => {
    if (window.confirm('确定要删除这个学校吗？这将同时删除相关的时间线事件和材料清单。')) {
      try {
        await apiReq(`/schools/${schoolId}`, { method: 'DELETE' });
        await loadStudentDataFromAPI(currentStudent?.studentId);
        if (showNotification) showNotification('学校已删除');
      } catch (err) {
        console.error('删除学校失败:', err);
        if (showNotification) showNotification('删除失败：' + err.message, 'error');
      }
    }
  };

  // 删除材料
  const handleDeleteMaterial = async (type, itemId, schoolName = null) => {
    if (window.confirm('确定要删除这个材料项吗？')) {
      try {
        await apiReq(`/materials/${itemId}`, { method: 'DELETE' });
        await loadStudentDataFromAPI(currentStudent?.studentId);
        if (showNotification) showNotification('材料项已删除');
      } catch (err) {
        console.error('删除材料失败:', err);
        if (showNotification) showNotification('删除失败：' + err.message, 'error');
      }
    }
  };

  // 处理材料勾选
  const handleMaterialCheck = async (type, itemId, checked, schoolName = null) => {
    // 乐观更新本地状态
    const newChecklist = {...checklist};
    const currentTime = new Date().toISOString().split('T')[0];
    if (type === 'general') {
      newChecklist.general = checklist.general.map(item =>
        item.id === itemId
          ? {...item, completed: checked, checkedBy: user.role, checkedAt: checked ? currentTime : null}
          : item
      );
    } else if (schoolName) {
      newChecklist.schoolSpecific[schoolName] = (newChecklist.schoolSpecific[schoolName] || []).map(item =>
        item.id === itemId
          ? {...item, completed: checked, checkedBy: user.role, checkedAt: checked ? currentTime : null}
          : item
      );
    }
    setChecklist(newChecklist);
    // 调用 API（幂等的 status 更新，传目标值而非 toggle 翻转）
    try {
      await apiReq(`/materials/${itemId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ completed: checked, checked_by: user.role }),
      });
    } catch (err) {
      console.error('更新材料状态失败:', err);
      // 失败时重新加载
      await loadStudentDataFromAPI(currentStudent?.studentId);
    }
  };

  // 事件编辑/新增Modal
  const EventModal = () => {
    const [formData, setFormData] = useState(
      editingEvent || {
        title: '',
        type: 'exam',
        category: '日语考试',
        date: '',
        urgent: false,
        notes: '',
        completed: false
      }
    );

    const handleSubmit = async (e) => {
      e.preventDefault();
      const eventData = {
        student_id: currentStudent?.studentId,
        type: formData.type,
        title: formData.title,
        date: formData.date,
        category: formData.category,
        urgent: formData.urgent,
        notes: formData.notes,
        completed: formData.completed,
      };
      try {
        if (editingEvent) {
          await apiReq(`/events/${editingEvent.id}`, {
            method: 'PUT',
            body: JSON.stringify(eventData),
          });
        } else {
          await apiReq('/events', {
            method: 'POST',
            body: JSON.stringify(eventData),
          });
        }
        await loadStudentDataFromAPI(currentStudent?.studentId);
        setShowEventModal(false);
        setEditingEvent(null);
        if (showNotification) showNotification(editingEvent ? '事项已更新' : '事项已添加');
      } catch (err) {
        console.error('保存事件失败:', err);
        if (showNotification) showNotification('保存失败：' + err.message, 'error');
      }
    };

    return (
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" style={{ backgroundColor: `rgba(0,0,0,${isDark ? '0.6' : '0.4'})`, backdropFilter: 'blur(4px)' }}>
        <div className="rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-scale-in" style={{ background: tokens.colors.surface.solid, border: `1px solid ${tokens.colors.border.subtle}` }}>
          <div className="p-6 flex items-center justify-between" style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}` }}>
            <h3 className="font-bold text-xl" style={{ color: tokens.colors.text.primary }}>{editingEvent ? '编辑事项' : '添加新事项'}</h3>
            <button
              onClick={() => {
                setShowEventModal(false);
                setEditingEvent(null);
              }}
              className="p-2 rounded-lg transition" style={{ color: tokens.colors.text.secondary }}
              onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: tokens.colors.text.secondary }}>标题</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">类型</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="exam">考试</option>
                  <option value="deadline">截止日期</option>
                  <option value="interview">面试</option>
                  <option value="document">文档</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">分类</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="日语考试">日语考试</option>
                  <option value="出愿">出愿</option>
                  <option value="留考">留考</option>
                  <option value="材料准备">材料准备</option>
                  <option value="校内考">校内考</option>
                  <option value="面试">面试</option>
                  <option value="合格发表">合格发表</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">日期</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">备注</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                rows="3"
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.urgent}
                  onChange={(e) => setFormData({...formData, urgent: e.target.checked})}
                  className="w-4 h-4"
                />
                <span>紧急事项</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.completed}
                  onChange={(e) => setFormData({...formData, completed: e.target.checked})}
                  className="w-4 h-4"
                />
                <span>已完成</span>
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
              className="flex-1 py-2 rounded-lg font-semibold transition"
              style={{ background: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)', color: '#3b82f6' }}
              onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)'}
              >
                {editingEvent ? '保存修改' : '添加事项'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEventModal(false);
                  setEditingEvent(null);
                }}
                className="flex-1 py-2 rounded-lg font-semibold transition"
                style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb', color: tokens.colors.text.primary }}
                onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.12)' : '#d1d5db'}
                onMouseLeave={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}
              >
                取消
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // 学校编辑/新增Modal
  const SchoolModal = () => {
    // 编辑模式下，将 checklist 中该学校的材料合并到 formData.materials
    const getInitialFormData = () => {
      if (editingSchool) {
        // 从 checklist.schoolSpecific 获取该学校的已有材料（API 数据源）
        const existingMaterials = checklist?.schoolSpecific?.[editingSchool.name] || [];
        const materialsForForm = existingMaterials.map(m => ({
          name: m.item || m.name || '',
          deadline: m.deadline || '',
          url: m.url || '',
          id: m.id, // 保留 id 以便后端区分
        }));
        return {
          ...editingSchool,
          materials: materialsForForm.length > 0 ? materialsForForm : (editingSchool.materials || []),
        };
      }
      return {
        name: '',
        nameJa: '',
        type: '国立',
        location: '',
        program: '',
        status: 'preparing',
        applicationStartDate: '',
        applicationEndDate: '',
        examDate: '',
        resultDate: '',
        requirementsUrl: '',
        requirements: '',
        acceptanceRate: '',
        teacherNotes: '',
        materials: []
      };
    };
    const [formData, setFormData] = useState(getInitialFormData());

    const [newMaterial, setNewMaterial] = useState({ name: '', deadline: '', url: '' });
    const [showSchoolSuggestions, setShowSchoolSuggestions] = useState(false);
    const [schoolSuggestions, setSchoolSuggestions] = useState([]);

    // 从学校信息库获取匹配的学校
    const getSchoolDbSuggestions = (query) => {
      try {
        const saved = localStorage.getItem('schoolDatabase');
        if (!saved) return [];
        const dbSchools = JSON.parse(saved);
        if (!query) return dbSchools.slice(0, 10);
        return dbSchools.filter(s =>
          s.name.includes(query) || (s.nameJa && s.nameJa.includes(query))
        ).slice(0, 10);
      } catch { return []; }
    };

    // 选择学校信息库中的学校后自动填充
    const handleSelectDbSchool = (dbSchool) => {
      setFormData(prev => ({
        ...prev,
        name: dbSchool.name,
        nameJa: dbSchool.nameJa || prev.nameJa,
        type: dbSchool.type || prev.type,
        location: dbSchool.location || prev.location,
        acceptanceRate: dbSchool.acceptanceRate || prev.acceptanceRate,
        requirements: dbSchool.requirements || prev.requirements,
        program: (dbSchool.programs && dbSchool.programs[0]) || prev.program,
        applicationStartDate: dbSchool.applicationStartDate || prev.applicationStartDate,
        applicationEndDate: dbSchool.applicationEndDate || prev.applicationEndDate,
        examDate: dbSchool.examDate || prev.examDate,
        resultDate: dbSchool.resultDate || prev.resultDate,
        requirementsUrl: dbSchool.requirementsUrl || dbSchool.website || prev.requirementsUrl,
      }));
      setShowSchoolSuggestions(false);
    };

    const handleSubmit = async (e) => {
      e.preventDefault();

      const schoolData = {
        student_id: currentStudent?.studentId,
        name: formData.name,
        name_ja: formData.nameJa,
        type: formData.type,
        location: formData.location,
        acceptance_rate: formData.acceptanceRate,
        program: formData.program,
        status: formData.status,
        application_start_date: formData.applicationStartDate,
        application_end_date: formData.applicationEndDate,
        exam_date: formData.examDate,
        result_date: formData.resultDate,
        requirements_url: formData.requirementsUrl,
        requirements: formData.requirements,
        teacher_notes: formData.teacherNotes,
        materials: (formData.materials || []).map(m => ({ name: m.name, deadline: m.deadline, url: m.url }))
      };

      try {
        if (editingSchool) {
          // 更新现有学校
          await apiReq(`/schools/${editingSchool.id}`, {
            method: 'PUT',
            body: JSON.stringify(schoolData),
          });
        } else {
          // 添加新学校
          await apiReq('/schools', {
            method: 'POST',
            body: JSON.stringify(schoolData),
          });
        }
        // 重新从 API 加载数据
        await loadStudentDataFromAPI(currentStudent?.studentId);
        setShowSchoolModal(false);
        setEditingSchool(null);
        if (showNotification) showNotification(editingSchool ? '学校信息已更新' : '学校已添加');
      } catch (err) {
        console.error('保存学校失败:', err);
        if (showNotification) showNotification('保存失败：' + err.message, 'error');
      }
    };

    const addMaterial = () => {
      if (newMaterial.name.trim()) {
        setFormData({
          ...formData,
          materials: [...(formData.materials || []), { ...newMaterial, id: Date.now() }]
        });
        setNewMaterial({ name: '', deadline: '', url: '' });
      }
    };

    const removeMaterial = (index) => {
      setFormData({
        ...formData,
        materials: formData.materials.filter((_, i) => i !== index)
      });
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" style={{ backgroundColor: `rgba(0,0,0,${isDark ? '0.6' : '0.4'})`, backdropFilter: 'blur(4px)' }}>
        <div className="glass-panel rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-scale-in">
          <div className="p-6 flex items-center justify-between" style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}` }}>
            <h3 className="font-bold text-xl" style={{ color: tokens.colors.text.primary }}>{editingSchool ? '编辑学校' : '添加新学校'}</h3>
            <button
              onClick={() => {
                setShowSchoolModal(false);
                setEditingSchool(null);
              }}
              className="p-2 rounded-lg transition"
              style={{ color: tokens.colors.text.secondary }}
              onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-sm font-medium mb-2">学校名称 (中文) *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({...formData, name: e.target.value});
                    const suggestions = getSchoolDbSuggestions(e.target.value);
                    setSchoolSuggestions(suggestions);
                    setShowSchoolSuggestions(suggestions.length > 0);
                  }}
                  onFocus={() => {
                    const suggestions = getSchoolDbSuggestions(formData.name);
                    setSchoolSuggestions(suggestions);
                    setShowSchoolSuggestions(suggestions.length > 0);
                  }}
                  onBlur={() => setTimeout(() => setShowSchoolSuggestions(false), 200)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="输入或从信息库选择"
                  required
                />
                {showSchoolSuggestions && schoolSuggestions.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 rounded-lg shadow-lg max-h-48 overflow-y-auto" style={{ background: isDark ? tokens.colors.surface.solid : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'}` }}>
                    <div className="px-3 py-1.5 text-xs" style={{ color: tokens.colors.text.muted, borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb'}`, background: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb' }}>从学校信息库选择（点击自动补全）</div>
                    {schoolSuggestions.map(s => (
                      <button key={s.id} type="button"
                        onMouseDown={(e) => { e.preventDefault(); handleSelectDbSchool(s); }}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center justify-between text-sm border-b last:border-0">
                        <span className="font-medium">{s.name}</span>
                        <span className="text-xs" style={{ color: tokens.colors.text.muted }}>{s.type} {s.location || ''}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">学校类型</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="国立">国立</option>
                  <option value="公立">公立</option>
                  <option value="私立">私立</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">录取率</label>
                <input type="text" value={formData.acceptanceRate || ''}
                  onChange={(e) => setFormData({...formData, acceptanceRate: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="例: 约10%" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">地点</label>
                <input type="text" value={formData.location || ''}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="例: 东京都文京区" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">研究科/学部 *</label>
                <input
                  type="text"
                  value={formData.program}
                  onChange={(e) => setFormData({...formData, program: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">申请状态</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="not_started">未开始</option>
                  <option value="preparing">准备中</option>
                  <option value="applied">出愿完成</option>
                  <option value="submitted">邮寄完成</option>
                  <option value="admitted">合格</option>
                  <option value="rejected">未合格</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">申请要求</label>
              <input type="text" value={formData.requirements || ''}
                onChange={(e) => setFormData({...formData, requirements: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="例: 日语N1 + EJU高分 + 校内考" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                募集要项URL
                <span className="text-xs ml-2" style={{ color: tokens.colors.text.muted }}>（学校官方招生信息链接）</span>
              </label>
              <div className="relative">
                <Link2 className="absolute left-3 top-1/2 transform -translate-y-1/2" size={18} style={{ color: tokens.colors.text.muted }} />
                <input
                  type="url"
                  value={formData.requirementsUrl}
                  onChange={(e) => setFormData({...formData, requirementsUrl: e.target.value})}
                  className="w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="https://www.university.ac.jp/admissions"
                />
                {formData.requirementsUrl && (
                  <a
                    href={formData.requirementsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-500 hover:text-blue-600"
                  >
                    <ExternalLink size={18} />
                  </a>
                )}
              </div>
            </div>

            <div className="space-y-4 p-4 rounded-lg" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb', border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb'}` }}>
              <h4 className="font-semibold text-sm" style={{ color: tokens.colors.text.primary }}>重要日期</h4>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">出愿开始日期</label>
                  <input
                    type="date"
                    value={formData.applicationStartDate}
                    onChange={(e) => setFormData({...formData, applicationStartDate: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">出愿截止日期</label>
                  <input
                    type="date"
                    value={formData.applicationEndDate}
                    onChange={(e) => setFormData({...formData, applicationEndDate: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">考试日期</label>
                  <input
                    type="date"
                    value={formData.examDate}
                    onChange={(e) => setFormData({...formData, examDate: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">合格发表日期</label>
                  <input
                    type="date"
                    value={formData.resultDate}
                    onChange={(e) => setFormData({...formData, resultDate: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">所需材料（将同步到材料清单）</label>
              <div className="space-y-2 mb-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMaterial.name}
                    onChange={(e) => setNewMaterial({...newMaterial, name: e.target.value})}
                    placeholder="材料名称"
                    className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="date"
                    value={newMaterial.deadline}
                    onChange={(e) => setNewMaterial({...newMaterial, deadline: e.target.value})}
                    className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="url"
                    value={newMaterial.url}
                    onChange={(e) => setNewMaterial({...newMaterial, url: e.target.value})}
                    placeholder="参考链接(可选)"
                    className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={addMaterial}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    添加
                  </button>
                </div>
              </div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {formData.materials?.map((material, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between px-3 py-2 rounded-lg text-sm"
                    style={{ background: isDark ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.06)', border: `1px solid ${isDark ? 'rgba(59,130,246,0.15)' : 'transparent'}` }}
                  >
                    <span style={{ color: tokens.colors.text.primary }}>{material.name}</span>
                    <div className="flex items-center gap-2">
                      <span style={{ color: tokens.colors.text.muted }}>{material.deadline}</span>
                      {material.url && (
                        <a
                          href={material.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-600"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => removeMaterial(index)}
                        className="text-red-600 hover:bg-red-100 p-1 rounded"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">老师备注</label>
              <textarea
                value={formData.teacherNotes}
                onChange={(e) => setFormData({...formData, teacherNotes: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                rows="3"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 py-2 rounded-lg font-semibold transition"
                style={{ background: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)', color: '#3b82f6' }}
                onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.2)'}
                onMouseLeave={e => e.currentTarget.style.background = isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)'}
              >
                {editingSchool ? '保存修改' : '添加学校'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSchoolModal(false);
                  setEditingSchool(null);
                }}
className="flex-1 py-2 rounded-lg font-semibold transition" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb', color: tokens.colors.text.primary }}
              >
                取消
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // 材料编辑/新增Modal
  const MaterialModal = () => {
    const [formData, setFormData] = useState(
      editingMaterial || {
        item: '',
        type: 'general',
        school: schools[0]?.name || '东京大学',
        completed: false,
        deadline: '',
        url: '',
        checkedBy: null,
        checkedAt: null
      }
    );

    // 确保使用最新的schools列表，当schools变化时更新默认学校
    React.useEffect(() => {
      if (!editingMaterial && formData.type === 'school' && schools.length > 0) {
        if (!schools.find(s => s.name === formData.school)) {
          setFormData(prev => ({...prev, school: schools[0].name}));
        }
      }
    }, [schools]);

    const handleSubmit = async (e) => {
      e.preventDefault();
      try {
        if (editingMaterial) {
          // 更新已有材料
          await apiReq(`/materials/${editingMaterial.id}`, {
            method: 'PUT',
            body: JSON.stringify({
              item: formData.item,
              deadline: formData.deadline,
              url: formData.url,
              completed: formData.completed,
              checked_by: formData.completed ? user.role : null,
              checked_at: formData.completed ? new Date().toISOString().split('T')[0] : null,
            }),
          });
        } else {
          // 创建新材料
          const materialData = {
            student_id: currentStudent?.studentId,
            item: formData.item,
            type: formData.type,
            deadline: formData.deadline,
            url: formData.url,
            completed: formData.completed,
            checked_by: formData.completed ? user.role : null,
            checked_at: formData.completed ? new Date().toISOString().split('T')[0] : null,
          };
          // 如果是学校专用材料，需要找到对应的 school_id
          if (formData.type === 'school' && formData.school) {
            const matchedSchool = schools.find(s => s.name === formData.school);
            if (matchedSchool) {
              materialData.school_id = matchedSchool.id;
            }
          }
          await apiReq('/materials', {
            method: 'POST',
            body: JSON.stringify(materialData),
          });
        }
        // 重新从 API 加载数据
        await loadStudentDataFromAPI(currentStudent?.studentId);
        setShowMaterialModal(false);
        setEditingMaterial(null);
        if (showNotification) showNotification(editingMaterial ? '材料已更新' : '材料已添加');
      } catch (err) {
        console.error('保存材料失败:', err);
        if (showNotification) showNotification('保存失败：' + err.message, 'error');
      }
    };

    return (
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" style={{ backgroundColor: `rgba(0,0,0,${isDark ? '0.6' : '0.4'})`, backdropFilter: 'blur(4px)' }}>
<div className="rounded-xl max-w-md w-full animate-scale-in" style={{ background: isDark ? tokens.colors.surface.solid : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}` }}>
          <div className="p-6 flex items-center justify-between" style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}` }}>
            <h3 className="font-bold text-xl" style={{ color: tokens.colors.text.primary }}>{editingMaterial ? '编辑材料' : '添加新材料'}</h3>
            <button
              onClick={() => {
                setShowMaterialModal(false);
                setEditingMaterial(null);
              }}
className="p-2 rounded-lg transition" style={{ color: tokens.colors.text.secondary }}
              onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">材料名称</label>
              <input
                type="text"
                value={formData.item}
                onChange={(e) => setFormData({...formData, item: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">材料类型</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="general">通用材料</option>
                <option value="school">学校专用</option>
              </select>
            </div>

            {formData.type === 'school' && (
              <div>
                <label className="block text-sm font-medium mb-2">选择学校</label>
                <select
                  value={formData.school}
                  onChange={(e) => setFormData({...formData, school: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {schools.map(school => (
                    <option key={school.id} value={school.name}>{school.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">截止日期</label>
              <input
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData({...formData, deadline: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: tokens.colors.text.primary }}>
                参考链接
                <span className="text-xs ml-2" style={{ color: tokens.colors.text.muted }}>（模板或参考资料）</span>
              </label>
              <div className="relative">
                <Link2 className="absolute left-3 top-1/2 transform -translate-y-1/2" size={18} style={{ color: tokens.colors.text.muted }} />
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({...formData, url: e.target.value})}
                  className="w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="https://example.com/template.pdf"
                />
                {formData.url && (
                  <a
                    href={formData.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-500 hover:text-blue-600"
                  >
                    <ExternalLink size={18} />
                  </a>
                )}
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.completed}
                  onChange={(e) => setFormData({...formData, completed: e.target.checked})}
                  className="w-4 h-4"
                />
                <span>已完成</span>
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 py-2 rounded-lg font-semibold transition"
                style={{ background: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)', color: '#3b82f6' }}
                onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.2)'}
                onMouseLeave={e => e.currentTarget.style.background = isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)'}
              >
                {editingMaterial ? '保存修改' : '添加材料'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMaterialModal(false);
                  setEditingMaterial(null);
                }}
className="flex-1 py-2 rounded-lg font-semibold transition" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb', color: tokens.colors.text.primary }}
              >
                取消
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // 学生列表弹窗 (老师和管理员专用)
  const StudentListModal = () => {
    const visibleStudents = getVisibleStudents();
    const [studentListView, setStudentListView] = useState('card'); // 'card', 'list', 'table'
    const [studentSearch, setStudentSearch] = useState('');
    const [studentFilter, setStudentFilter] = useState('all'); // 'all', '文科', '理科', 'unassigned'
    const [transferStudentId, setTransferStudentId] = useState(null);
    const [transferTargetTeacher, setTransferTargetTeacher] = useState('');
    const [editingStudentId, setEditingStudentId] = useState(null);
    const [editTagInput, setEditTagInput] = useState('');

    const handleUpdateStudentSubject = (studentId, subject) => {
      setStudentList(prev => prev.map(s => s.id === studentId ? { ...s, subject } : s));
      if (showNotification) showNotification(`已更新文理科为: ${subject || '未指定'}`);
    };

    const handleAddStudentTag = (studentId, tag) => {
      if (!tag.trim()) return;
      setStudentList(prev => prev.map(s => {
        if (s.id !== studentId) return s;
        const tags = [...(s.tags || [])];
        if (!tags.includes(tag.trim())) tags.push(tag.trim());
        return { ...s, tags };
      }));
      setEditTagInput('');
    };

    const handleRemoveStudentTag = (studentId, tag) => {
      setStudentList(prev => prev.map(s => {
        if (s.id !== studentId) return s;
        return { ...s, tags: (s.tags || []).filter(t => t !== tag) };
      }));
    };

    const filteredStudentList = visibleStudents.filter(s => {
      const matchSearch = !studentSearch || s.name.includes(studentSearch) || s.studentId.includes(studentSearch);
      const matchFilter = studentFilter === 'all' ||
        (studentFilter === 'unassigned' && (!s.teacherId || s.teacherId === 'unassigned')) ||
        (studentFilter === '文科' && s.subject === '文科') ||
        (studentFilter === '理科' && s.subject === '理科');
      return matchSearch && matchFilter;
    });

    const handleInlineTransfer = (student) => {
      if (transferTargetTeacher) {
        setStudentList(prev => prev.map(s =>
          s.id === student.id ? { ...s, teacherId: transferTargetTeacher } : s
        ));
        setTransferStudentId(null);
        setTransferTargetTeacher('');
        if (showNotification) showNotification(`已将 ${student.name} 转移给 ${getTeacherList().find(t => t.id === transferTargetTeacher)?.name}`);
      }
    };

    const selectStudent = (student) => {
      setCurrentStudent({
        ...student,
        targetCountry: '日本',
        targetLevel: student.targetLevel || '修士',
        email: student.email || `${student.name.toLowerCase()}@example.com`
      });
      setShowStudentList(false);
      // 点击学生后导航到学生独立页面
      setActiveTab('profile');
    };

    // 学生tag列表
    const allTags = [...new Set(visibleStudents.flatMap(s => s.tags || []).filter(Boolean))];

    return (
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" style={{ backgroundColor: `rgba(0,0,0,${isDark ? '0.6' : '0.4'})`, backdropFilter: 'blur(4px)' }}>
        <div className="rounded-xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col animate-scale-in" style={{ background: isDark ? tokens.colors.surface.solid : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}` }}>
          <div className="p-4 sm:p-6 border-b flex items-center justify-between bg-gradient-to-r from-purple-500 to-blue-500 text-white">
            <h3 className="font-bold text-xl">
              {user.role === 'admin' ? '所有学生' : '我的学生'}
              <span className="text-sm font-normal ml-2 text-white/70">({filteredStudentList.length}人)</span>
            </h3>
            <button onClick={() => setShowStudentList(false)} className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition">
              <X size={20} />
            </button>
          </div>

          {/* 搜索 + 筛选 + 视图切换 */}
          <div className="p-4 space-y-3" style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`, background: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb' }}>
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={16} style={{ color: tokens.colors.text.muted }} />
                <input type="text" placeholder="搜索学生姓名/学号..." value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                  style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#d1d5db'}`, color: tokens.colors.text.primary }} />
              </div>
              <div className="flex rounded-lg p-0.5" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb' }}>
                <button onClick={() => setStudentListView('card')}
                  className={`p-1.5 rounded-md transition`}
                  style={studentListView === 'card' ? { background: isDark ? 'rgba(255,255,255,0.12)' : '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' } : { color: tokens.colors.text.muted }}>
                  <LayoutGrid size={16} />
                </button>
                <button onClick={() => setStudentListView('list')}
                  className={`p-1.5 rounded-md transition`}
                  style={studentListView === 'list' ? { background: isDark ? 'rgba(255,255,255,0.12)' : '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' } : { color: tokens.colors.text.muted }}>
                  <LayoutList size={16} />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {['all', '文科', '理科', 'unassigned'].map(f => (
                <button key={f} onClick={() => setStudentFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition`}
                  style={studentFilter === f
                    ? { background: '#a855f7', color: '#fff' }
                    : { background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', color: tokens.colors.text.secondary, border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#d1d5db'}` }
                  }>
                  {f === 'all' ? '全部' : f === 'unassigned' ? '待分配' : f}
                </button>
              ))}
              {allTags.map(tag => (
                <span key={tag} className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)', color: isDark ? '#93c5fd' : '#2563eb' }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="overflow-y-auto flex-1 p-4">
            {/* 卡片视图 */}
            {studentListView === 'card' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredStudentList.map(student => (
                  <div key={student.id}
                    className="p-4 border-2 rounded-lg hover:shadow-lg cursor-pointer transition-all"
                    style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#60a5fa'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}
                  >
                    <div onClick={() => selectStudent(student)}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="text-3xl">{student.avatar}</div>
                          <div>
                            <div className="font-semibold text-lg">{student.name}</div>
                            <div className="text-sm" style={{ color: tokens.colors.text.muted }}>{student.studentId}</div>
                            {user.role === 'admin' && (
                              <div className="text-xs" style={{ color: tokens.colors.text.muted }}>
                                负责老师: {getTeacherList().find(t => t.id === student.teacherId)?.name || '待分配'}
                                {student.academicAdvisorId && (
                                  <span> · 学管: {getTeacherList().find(t => t.id === student.academicAdvisorId)?.name || '-'}</span>
                                )}
                              </div>
                            )}
                            {student.packageName && (
                              <div className="text-xs" style={{ color: isDark ? '#a78bfa' : '#7c3aed' }}>
                                📦 {student.packageName}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {student.subject && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              student.subject === '理科'
                                ? (isDark ? 'bg-[rgba(59,130,246,0.15)] text-blue-400' : 'bg-[rgba(59,130,246,0.1)] text-blue-700')
                                : (isDark ? 'bg-[rgba(249,115,22,0.15)] text-orange-400' : 'bg-[rgba(249,115,22,0.1)] text-orange-700')
                            }`}>{student.subject}</span>
                          )}
                          {student.urgentTasks > 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)', color: isDark ? '#fca5a5' : '#b91c1c' }}>
                              {student.urgentTasks}个紧急
                            </span>
                          )}
                          {(student.tags || []).map(tag => (
                            <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: isDark ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.06)', color: isDark ? '#86efac' : '#15803d' }}>{tag}</span>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span style={{ color: tokens.colors.text.secondary }}>整体进度</span>
                          <span className="font-semibold" style={{ color: tokens.colors.text.primary }}>{student.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all"
                            style={{ width: `${student.progress}%` }} />
                        </div>
                      </div>
                    </div>
                    {/* 内联编辑标签/文理科 */}
                    {(user.role === 'teacher' || user.role === 'admin') && (
                      <div className="mt-3 pt-3 border-t">
                        {editingStudentId === student.id ? (
                          <div className="space-y-2 animate-fade-in">
                            <div className="flex items-center gap-2">
                              <span className="text-xs w-14 flex-shrink-0" style={{ color: tokens.colors.text.muted }}>文/理科</span>
                              <select value={student.subject || ''} onChange={e => handleUpdateStudentSubject(student.id, e.target.value)}
                                className="flex-1 px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-purple-400">
                                <option value="">未指定</option>
                                <option value="文科">文科</option>
                                <option value="理科">理科</option>
                              </select>
                            </div>
                            <div>
                              <div className="flex flex-wrap gap-1 mb-1">
                                {(student.tags || []).map(tag => (
                                  <span key={tag} className="px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-[10px] flex items-center gap-1">
                                    {tag}
                                    <button onClick={() => handleRemoveStudentTag(student.id, tag)} className="hover:text-red-500"><X size={10} /></button>
                                  </span>
                                ))}
                              </div>
                              <div className="flex gap-1">
                                <input type="text" value={editTagInput} onChange={e => setEditTagInput(e.target.value)}
                                  placeholder="添加标签..." className="flex-1 px-2 py-1 border rounded text-xs"
                                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddStudentTag(student.id, editTagInput); }}} />
                                <button onClick={() => handleAddStudentTag(student.id, editTagInput)}
                                  className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"><Plus size={12} /></button>
                              </div>
                            </div>
                            <button onClick={() => setEditingStudentId(null)}
                            className="w-full py-1 rounded text-xs transition" style={{ color: tokens.colors.text.muted }}>收起</button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button onClick={(e) => { e.stopPropagation(); setEditingStudentId(student.id); setEditTagInput(''); }}
                              className="flex-1 text-purple-600 hover:bg-purple-50 py-1.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1">
                              <Edit2 size={14} /> 编辑信息
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setTransferStudentId(student.id); }}
                              className="flex-1 text-orange-600 hover:bg-orange-50 py-1.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1">
                              <ArrowRight size={14} /> 转移学生
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    {/* 内联转移 */}
                    {(user.role === 'teacher' || user.role === 'admin') && transferStudentId === student.id && editingStudentId !== student.id && (
                      <div className="mt-2 pt-2 border-t">
                        <div className="flex gap-2 items-center animate-fade-in">
                          <select value={transferTargetTeacher} onChange={e => setTransferTargetTeacher(e.target.value)}
                            className="flex-1 px-2 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-orange-400">
                            <option value="">选择老师</option>
                            {getTeacherList().filter(t => t.id !== student.teacherId).map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                          <button onClick={() => handleInlineTransfer(student)} disabled={!transferTargetTeacher}
                            className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600 disabled:bg-gray-300 transition">
                            确认
                          </button>
                          <button onClick={() => { setTransferStudentId(null); setTransferTargetTeacher(''); }}
                            className="px-2 py-1.5 rounded-lg text-sm transition" style={{ color: tokens.colors.text.muted }}>
                            取消
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 列表视图 */}
            {studentListView === 'list' && (
              <div className="space-y-2">
                {filteredStudentList.map(student => (
                  <div key={student.id}
                    className="flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-all"
                    style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}` }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#60a5fa'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}
                  >
                    <div className="text-2xl flex-shrink-0" onClick={() => selectStudent(student)}>{student.avatar}</div>
                    <div className="flex-1 min-w-0" onClick={() => selectStudent(student)}>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold truncate">{student.name}</span>
                        <span className="text-xs" style={{ color: tokens.colors.text.muted }}>{student.studentId}</span>
                        {student.subject && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            student.subject === '理科'
                              ? (isDark ? 'bg-[rgba(59,130,246,0.15)] text-blue-400' : 'bg-[rgba(59,130,246,0.1)] text-blue-700')
                              : (isDark ? 'bg-[rgba(249,115,22,0.15)] text-orange-400' : 'bg-[rgba(249,115,22,0.1)] text-orange-700')
                          }`}>{student.subject}</span>
                        )}
                        {(student.tags || []).map(tag => (
                          <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: isDark ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.06)', color: isDark ? '#86efac' : '#15803d' }}>{tag}</span>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 text-xs mt-1" style={{ color: tokens.colors.text.muted }}>
                        <span>进度: {student.progress}%</span>
                        {user.role === 'admin' && <span>老师: {getTeacherList().find(t => t.id === student.teacherId)?.name || '待分配'}</span>}
                        {user.role === 'admin' && student.academicAdvisorId && <span>学管: {getTeacherList().find(t => t.id === student.academicAdvisorId)?.name || '-'}</span>}
                        {student.packageName && <span style={{ color: isDark ? '#a78bfa' : '#7c3aed' }}>📦 {student.packageName}</span>}
                        {student.urgentTasks > 0 && <span className="text-red-600">{student.urgentTasks}个紧急</span>}
                      </div>
                    </div>
                    <div className="w-24 flex-shrink-0">
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-1.5 rounded-full" style={{ width: `${student.progress}%` }} />
                      </div>
                    </div>
                    {(user.role === 'teacher' || user.role === 'admin') && (
                      transferStudentId === student.id ? (
                        <div className="flex gap-1 items-center flex-shrink-0">
                          <select value={transferTargetTeacher} onChange={e => setTransferTargetTeacher(e.target.value)}
                            className="px-2 py-1 border rounded text-xs w-20">
                            <option value="">选择</option>
                            {getTeacherList().filter(t => t.id !== student.teacherId).map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                          <button onClick={() => handleInlineTransfer(student)} disabled={!transferTargetTeacher}
                            className="px-2 py-1 bg-orange-500 text-white rounded text-xs disabled:bg-gray-300">OK</button>
                          <button onClick={() => { setTransferStudentId(null); setTransferTargetTeacher(''); }}
                            className="px-1 py-1 text-gray-400 hover:text-gray-600"><X size={14} /></button>
                        </div>
                      ) : editingStudentId === student.id ? (
                        <div className="flex gap-1 items-center flex-shrink-0 animate-fade-in">
                          <select value={student.subject || ''} onChange={e => handleUpdateStudentSubject(student.id, e.target.value)}
                            className="px-1 py-1 border rounded text-xs w-14">
                            <option value="">科</option><option value="文科">文</option><option value="理科">理</option>
                          </select>
                          <input type="text" value={editTagInput} onChange={e => setEditTagInput(e.target.value)} placeholder="标签"
                            className="px-1 py-1 border rounded text-xs w-16"
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddStudentTag(student.id, editTagInput); }}} />
                          <button onClick={() => handleAddStudentTag(student.id, editTagInput)}
                            className="px-1 py-1 bg-green-500 text-white rounded text-xs"><Plus size={12} /></button>
                          <button onClick={() => setEditingStudentId(null)}
                            className="px-1 py-1 text-gray-400 hover:text-gray-600"><Check size={14} /></button>
                        </div>
                      ) : (
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => { setEditingStudentId(student.id); setEditTagInput(''); }}
                            className="text-purple-500 hover:bg-purple-50 p-2 rounded-lg" title="编辑信息">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => setTransferStudentId(student.id)}
                            className="text-orange-500 hover:bg-orange-50 p-2 rounded-lg" title="转移学生">
                            <ArrowRight size={16} />
                          </button>
                        </div>
                      )
                    )}
                  </div>
                ))}
              </div>
            )}

            {filteredStudentList.length === 0 && (
                      <div className="text-center py-12" style={{ color: tokens.colors.text.muted }}>
                <Users size={48} className="mx-auto mb-4 text-gray-300" />
                <p>暂无匹配的学生</p>
              </div>
            )}
          </div>
          {/* 只有管理员可以添加学生 */}
          {user.role === 'admin' && (
          <div className="p-4" style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`, background: isDark ? 'rgba(255,255,255,0.02)' : '#f9fafb' }}>
              <button
                onClick={() => setShowAddStudentModal(true)}
                className="w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition flex items-center justify-center gap-2"
              >
                <Plus size={18} />
                添加新学生
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // 学生转移弹窗
  const TransferModal = () => {
    const [selectedTeacher, setSelectedTeacher] = useState('');

    const handleTransfer = () => {
      if (selectedTeacher && currentStudent) {
        setStudentList(prev => prev.map(s =>
          s.id === currentStudent.id ? { ...s, teacherId: selectedTeacher } : s
        ));
        setShowTransferModal(false);
        if (showNotification) showNotification(`已将 ${currentStudent.name} 转移给 ${getTeacherList().find(t => t.id === selectedTeacher)?.name}`);
      }
    };

    return (
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" style={{ backgroundColor: `rgba(0,0,0,${isDark ? '0.6' : '0.4'})`, backdropFilter: 'blur(4px)' }}>
<div className="rounded-xl max-w-md w-full animate-scale-in" style={{ background: isDark ? tokens.colors.surface.solid : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}` }}>
          <div className="p-6" style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}` }}>
            <h3 className="font-bold text-xl" style={{ color: tokens.colors.text.primary }}>转移学生</h3>
            <p className="text-sm mt-1" style={{ color: tokens.colors.text.secondary }}>
              将学生 {currentStudent?.name} 转移给其他老师
            </p>
          </div>
          <div className="p-6">
            <label className="block text-sm font-medium mb-2">选择目标老师</label>
            <select
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">请选择老师</option>
              {getTeacherList()
                .filter(t => t.id !== user.teacherId)
                .map(teacher => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name} ({teacher.email})
                  </option>
                ))}
            </select>
          </div>
          <div className="p-6 flex gap-3" style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}` }}>
            <button
              onClick={handleTransfer}
              disabled={!selectedTeacher}
              className="flex-1 bg-orange-500 text-white py-2 rounded-lg font-semibold hover:bg-orange-600 disabled:bg-gray-300"
            >
              确认转移
            </button>
            <button
              onClick={() => setShowTransferModal(false)}
className="flex-1 py-2 rounded-lg font-semibold transition" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb', color: tokens.colors.text.primary }}
            >
              取消
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 添加学生弹窗
  const AddStudentModal = () => {
    const newStudentId = generateStudentId();
    const [newStudent, setNewStudent] = useState({
      name: '',
      email: '',
      teacherId: user.role === 'admin' ? '' : (user.teacherId || 'teacher_1'),
      academicAdvisorId: '',
      subject: '',
      tags: [],
    });
    const [newTag, setNewTag] = useState('');

    const handleAddStudent = () => {
      if (newStudent.name) {
        const student = {
          id: Date.now(),
          name: newStudent.name,
          studentId: newStudentId,
          email: newStudent.email || `${newStudent.name.toLowerCase()}@example.com`,
          progress: 0,
          urgentTasks: 0,
          avatar: '👨‍🎓',
          teacherId: newStudent.teacherId || 'unassigned',
          academicAdvisorId: newStudent.academicAdvisorId || '',
          targetCountry: '日本',
          targetLevel: '修士',
          subject: newStudent.subject,
          tags: newStudent.tags,
        };
        setStudentList(prev => [...prev, student]);
        setShowAddStudentModal(false);
        if (showNotification) showNotification(`学生 ${newStudent.name} 已添加，学号：${newStudentId}`);
      }
    };

    return (
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" style={{ backgroundColor: `rgba(0,0,0,${isDark ? '0.6' : '0.4'})`, backdropFilter: 'blur(4px)' }}>
<div className="rounded-xl max-w-md w-full animate-scale-in" style={{ background: isDark ? tokens.colors.surface.solid : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}` }}>
          <div className="p-6" style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}` }}>
            <h3 className="font-bold text-xl" style={{ color: tokens.colors.text.primary }}>添加新学生</h3>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">学号（自动生成）</label>
              <input type="text" value={newStudentId} disabled
                className="w-full px-3 py-2 rounded-lg"
                style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f3f4f6', color: tokens.colors.text.muted, border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#d1d5db'}` }} />
              <p className="text-xs mt-1" style={{ color: tokens.colors.text.muted }}>学生需要使用此学号进行账号注册</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">学生姓名 *</label>
              <input type="text" value={newStudent.name}
                onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="请输入学生姓名" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">邮箱（可选）</label>
              <input type="email" value={newStudent.email}
                onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="请输入邮箱" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">文科/理科</label>
              <select value={newStudent.subject}
                onChange={(e) => setNewStudent({ ...newStudent, subject: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                <option value="">未指定</option>
                <option value="文科">文科</option>
                <option value="理科">理科</option>
              </select>
            </div>
            {/* 分配升学老师（含“待分配”选项） */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: tokens.colors.text.secondary }}>升学老师</label>
              <select value={newStudent.teacherId}
                onChange={(e) => setNewStudent({ ...newStudent, teacherId: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', color: tokens.colors.text.primary, borderColor: isDark ? 'rgba(255,255,255,0.1)' : undefined }}>
                <option value="">待分配老师</option>
                {getTeacherList().map(teacher => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name} ({teacher.email})
                  </option>
                ))}
              </select>
            </div>
            {/* 分配学管老师 */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: tokens.colors.text.secondary }}>学管老师</label>
              <select value={newStudent.academicAdvisorId}
                onChange={(e) => setNewStudent({ ...newStudent, academicAdvisorId: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', color: tokens.colors.text.primary, borderColor: isDark ? 'rgba(255,255,255,0.1)' : undefined }}>
                <option value="">待分配学管老师</option>
                {getTeacherList().map(teacher => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name} ({teacher.email})
                  </option>
                ))}
              </select>
            </div>            {/* 标签 */}
            <div>
              <label className="block text-sm font-medium mb-2">标签</label>
              <div className="flex flex-wrap gap-1 mb-2">
                {(newStudent.tags || []).map((tag, i) => (
                  <span key={i} className="px-2 py-1 rounded-full text-xs flex items-center gap-1" style={{ background: isDark ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.08)', color: isDark ? '#86efac' : '#16a34a' }}>
                    {tag}
                    <button onClick={() => setNewStudent({ ...newStudent, tags: newStudent.tags.filter((_, idx) => idx !== i) })}
                      className="hover:text-red-500"><X size={10} /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="text" value={newTag} onChange={e => setNewTag(e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-lg text-sm" placeholder="添加标签（如：重点关注）"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newTag.trim()) {
                      e.preventDefault();
                      setNewStudent({ ...newStudent, tags: [...(newStudent.tags || []), newTag.trim()] });
                      setNewTag('');
                    }
                  }} />
                <button onClick={() => { if (newTag.trim()) { setNewStudent({ ...newStudent, tags: [...(newStudent.tags || []), newTag.trim()] }); setNewTag(''); }}}
                  className="px-3 py-2 rounded-lg text-sm transition"
                  style={{ background: isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)', color: '#22c55e' }}
                  onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(34,197,94,0.25)' : 'rgba(34,197,94,0.2)'}
                  onMouseLeave={e => e.currentTarget.style.background = isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)'}>
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>
          <div className="p-6 flex gap-3" style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}` }}>
            <button onClick={handleAddStudent} disabled={!newStudent.name}
              className="flex-1 py-2 rounded-lg font-semibold transition disabled:opacity-40"
              style={{ background: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)', color: '#3b82f6' }}
              onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = isDark ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.2)' }}
              onMouseLeave={e => e.currentTarget.style.background = isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)'}>
              添加学生
            </button>
            <button onClick={() => setShowAddStudentModal(false)}
className="flex-1 py-2 rounded-lg font-semibold transition" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb', color: tokens.colors.text.primary }}>
              取消
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 添加老师弹窗（仅管理员可用）
  const AddTeacherModal = () => {
    const [newTeacher, setNewTeacher] = useState({
      name: '',
      email: '',
      password: '',
      confirmPassword: ''
    });
    const [errors, setErrors] = useState({});

    const handleAddTeacher = () => {
      const newErrors = {};

      if (!newTeacher.name) newErrors.name = '请输入老师姓名';
      if (!newTeacher.email) newErrors.email = '请输入邮箱';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newTeacher.email)) {
        newErrors.email = '邮箱格式不正确';
      }
      if (!newTeacher.password) newErrors.password = '请输入密码';
      else if (newTeacher.password.length < 6) newErrors.password = '密码至少6位';
      if (newTeacher.password !== newTeacher.confirmPassword) {
        newErrors.confirmPassword = '两次密码输入不一致';
      }

      // 检查邮箱是否已被使用
      if (allUsers.find(u => u.email === newTeacher.email)) {
        newErrors.email = '该邮箱已被使用';
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      // 创建新老师账号
      const newTeacherId = `teacher_${Date.now()}`;
      const teacherAccount = {
        id: `teacher${allUsers.length + 1}`,
        email: newTeacher.email,
        password: newTeacher.password,
        role: 'teacher',
        teacherId: newTeacherId,
        name: newTeacher.name,
        createdAt: new Date().toISOString()
      };

      setAllUsers(prev => [...prev, teacherAccount]);
      setShowAddTeacherModal(false);
      alert(`老师账号 ${newTeacher.name} 已成功创建！\n登录邮箱：${newTeacher.email}`);
      setNewTeacher({ name: '', email: '', password: '', confirmPassword: '' });
      setErrors({});
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
<div className="rounded-xl max-w-md w-full animate-scale-in" style={{ background: isDark ? tokens.colors.surface.solid : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}` }}>
          <div className="p-6" style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}` }}>
            <h3 className="font-bold text-xl" style={{ color: tokens.colors.text.primary }}>注册新老师账号</h3>          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">老师姓名</label>
              <input
                type="text"
                value={newTeacher.name}
                onChange={(e) => setNewTeacher({ ...newTeacher, name: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.name ? 'border-red-500' : ''}`}
                placeholder="请输入老师姓名"
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">登录邮箱</label>
              <input
                type="email"
                value={newTeacher.email}
                onChange={(e) => setNewTeacher({ ...newTeacher, email: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.email ? 'border-red-500' : ''}`}
                placeholder="teacher@school.com"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">设置密码</label>
              <input
                type="password"
                value={newTeacher.password}
                onChange={(e) => setNewTeacher({ ...newTeacher, password: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.password ? 'border-red-500' : ''}`}
                placeholder="至少6位密码"
              />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">确认密码</label>
              <input
                type="password"
                value={newTeacher.confirmPassword}
                onChange={(e) => setNewTeacher({ ...newTeacher, confirmPassword: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.confirmPassword ? 'border-red-500' : ''}`}
                placeholder="再次输入密码"
              />
              {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
            </div>
          </div>
          <div className="p-6 flex gap-3" style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}` }}>
            <button
              onClick={handleAddTeacher}
              className="flex-1 bg-purple-500 text-white py-2 rounded-lg font-semibold hover:bg-purple-600"
            >
              创建老师账号
            </button>
            <button
              onClick={() => {
                setShowAddTeacherModal(false);
                setNewTeacher({ name: '', email: '', password: '', confirmPassword: '' });
                setErrors({});
              }}
              className="flex-1 py-2 rounded-lg font-semibold transition" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb', color: tokens.colors.text.primary }}
            >
              取消
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 修改密码弹窗
  const ChangePasswordModal = () => {
    const [passwordData, setPasswordData] = useState({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    const [errors, setErrors] = useState({});
    const [showSuccess, setShowSuccess] = useState(false);

    const handleChangePassword = () => {
      const newErrors = {};

      // 查找当前用户
      const currentUser = allUsers.find(u => u.email === user.email && u.role === user.role);

      if (!passwordData.currentPassword) {
        newErrors.currentPassword = '请输入当前密码';
      } else if (!currentUser || currentUser.password !== passwordData.currentPassword) {
        newErrors.currentPassword = '当前密码不正确';
      }

      if (!passwordData.newPassword) {
        newErrors.newPassword = '请输入新密码';
      } else if (passwordData.newPassword.length < 6) {
        newErrors.newPassword = '新密码至少6位';
      }

      if (passwordData.newPassword !== passwordData.confirmPassword) {
        newErrors.confirmPassword = '两次密码输入不一致';
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      // 更新密码
      setAllUsers(prev => prev.map(u =>
        u.email === user.email && u.role === user.role
          ? { ...u, password: passwordData.newPassword }
          : u
      ));

      setShowSuccess(true);
      setTimeout(() => {
        setShowChangePasswordModal(false);
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setErrors({});
        setShowSuccess(false);
      }, 1500);
    };

    return (
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" style={{ backgroundColor: `rgba(0,0,0,${isDark ? '0.6' : '0.4'})`, backdropFilter: 'blur(4px)' }}>
<div className="rounded-xl max-w-md w-full animate-scale-in" style={{ background: isDark ? tokens.colors.surface.solid : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}` }}>
          <div className="p-6" style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}` }}>
            <h3 className="font-bold text-xl" style={{ color: tokens.colors.text.primary }}>修改密码</h3>
            <p className="text-sm mt-1" style={{ color: tokens.colors.text.secondary }}>请输入当前密码并设置新密码</p>
          </div>

          {showSuccess ? (
            <div className="p-6">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: isDark ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.08)' }}>
                  <Check size={32} style={{ color: '#22c55e' }} />
                </div>
                <p className="font-semibold" style={{ color: '#22c55e' }}>密码修改成功！</p>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">当前密码</label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.currentPassword ? 'border-red-500' : ''
                  }`}
                  placeholder="请输入当前密码"
                />
                {errors.currentPassword && <p className="text-red-500 text-xs mt-1">{errors.currentPassword}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">新密码</label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.newPassword ? 'border-red-500' : ''
                  }`}
                  placeholder="请输入新密码（至少6位）"
                />
                {errors.newPassword && <p className="text-red-500 text-xs mt-1">{errors.newPassword}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">确认新密码</label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.confirmPassword ? 'border-red-500' : ''
                  }`}
                  placeholder="请再次输入新密码"
                />
                {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
              </div>
            </div>
          )}

          {!showSuccess && (
            <div className="p-6 border-t flex gap-3">
              <button
                onClick={handleChangePassword}
                className="flex-1 py-2 rounded-lg font-semibold transition"
                style={{ background: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)', color: '#3b82f6' }}
                onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.2)'}
                onMouseLeave={e => e.currentTarget.style.background = isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)'}
              >
                确认修改
              </button>
              <button
                onClick={() => {
                  setShowChangePasswordModal(false);
                  setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  setErrors({});
                }}
className="flex-1 py-2 rounded-lg font-semibold transition" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb', color: tokens.colors.text.primary }}
              >
                取消
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // 账号管理弹窗（仅管理员可用）
  const AccountManagementModal = () => {
    const [filterType, setFilterType] = useState('all'); // 'all', 'student', 'teacher', 'admin'
    const [searchQuery, setSearchQuery] = useState('');
    const [showPasswords, setShowPasswords] = useState(false);
    // 从 API 加载的账号列表
    const [accountList, setAccountList] = useState([]);
    const [accountsLoading, setAccountsLoading] = useState(true);

    // 打开弹窗时从 API 加载所有账号
    useEffect(() => {
      const loadAccounts = async () => {
        try {
          setAccountsLoading(true);
          const data = await usersAPI.getAll();
          if (Array.isArray(data)) {
            setAccountList(data.map(u => ({
              id: u.id,
              email: u.email,
              role: u.role,
              name: u.name,
              teacherId: u.teacher_id,
              studentId: u.student_id,
              is_active: u.is_active,
              createdAt: u.created_at,
            })));
          }
        } catch (err) {
          console.error('加载账号列表失败:', err);
          if (showNotification) showNotification('账号列表加载失败');
        } finally {
          setAccountsLoading(false);
        }
      };
      loadAccounts();
    }, []);

    // 过滤和搜索账号
    const getFilteredAccounts = () => {
      let filtered = accountList;

      // 按角色过滤
      if (filterType !== 'all') {
        filtered = filtered.filter(u => u.role === filterType);
      }

      // 搜索过滤
      if (searchQuery) {
        filtered = filtered.filter(u =>
          (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (u.studentId && u.studentId.includes(searchQuery)) ||
          (u.teacherId && u.teacherId.includes(searchQuery))
        );
      }

      return filtered;
    };

    const filteredAccounts = getFilteredAccounts();

    return (
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" style={{ backgroundColor: `rgba(0,0,0,${isDark ? '0.6' : '0.4'})`, backdropFilter: 'blur(4px)' }}>
        <div className="rounded-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-scale-in" style={{ background: isDark ? tokens.colors.surface.solid : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}` }}>
          <div className="p-6 border-b bg-gradient-to-r from-red-500 to-purple-500 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-xl">账号管理系统</h3>
                <p className="text-sm mt-1 opacity-90">管理所有用户账号和权限</p>
              </div>
              <button
                onClick={() => setShowAccountManagementModal(false)}
                className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 p-6">
            {/* 统计信息 - 可点击快速筛选 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <button
                onClick={() => setFilterType('all')}
                className="p-4 rounded-lg transition cursor-pointer"
                style={filterType === 'all'
                  ? { background: isDark ? 'rgba(255,255,255,0.12)' : '#4b5563', color: '#fff' }
                  : { background: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb', color: tokens.colors.text.primary, border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}` }}
              >
                <div className="text-2xl font-bold">{accountsLoading ? '...' : accountList.length}</div>
                <div className="text-sm">全部账号</div>
              </button>
              <button
                onClick={() => setFilterType('student')}
                className="p-4 rounded-lg transition cursor-pointer"
                style={filterType === 'student'
                  ? { background: '#2563eb', color: '#fff' }
                  : { background: isDark ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.06)', color: tokens.colors.text.primary, border: `1px solid ${isDark ? 'rgba(59,130,246,0.2)' : 'transparent'}` }}
              >
                <div className="text-2xl font-bold">{accountsLoading ? '...' : accountList.filter(u => u.role === 'student').length}</div>
                <div className="text-sm">学生账号</div>
              </button>
              <button
                onClick={() => setFilterType('teacher')}
                className="p-4 rounded-lg transition cursor-pointer"
                style={filterType === 'teacher'
                  ? { background: '#9333ea', color: '#fff' }
                  : { background: isDark ? 'rgba(168,85,247,0.08)' : 'rgba(168,85,247,0.06)', color: tokens.colors.text.primary, border: `1px solid ${isDark ? 'rgba(168,85,247,0.2)' : 'transparent'}` }}
              >
                <div className="text-2xl font-bold">{accountsLoading ? '...' : accountList.filter(u => u.role === 'teacher').length}</div>
                <div className="text-sm">老师账号</div>
              </button>
              <button
                onClick={() => setFilterType('admin')}
                className="p-4 rounded-lg transition cursor-pointer"
                style={filterType === 'admin'
                  ? { background: '#dc2626', color: '#fff' }
                  : { background: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.06)', color: tokens.colors.text.primary, border: `1px solid ${isDark ? 'rgba(239,68,68,0.2)' : 'transparent'}` }}
              >
                <div className="text-2xl font-bold">{accountsLoading ? '...' : accountList.filter(u => u.role === 'admin').length}</div>
                <div className="text-sm">管理员账号</div>
              </button>
            </div>

            {/* 搜索栏和密码显示切换 */}
            <div className="mb-4 flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2" size={20} style={{ color: tokens.colors.text.muted }} />
                <input
                  type="text"
                  placeholder="搜索姓名、邮箱、学号或教师ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500"
                  style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#d1d5db'}`, color: tokens.colors.text.primary }}
                />
              </div>
              <button
                onClick={() => setShowPasswords(!showPasswords)}
                className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                  showPasswords ? 'bg-blue-500 text-white' : (isDark ? 'bg-[rgba(255,255,255,0.08)]' : 'bg-gray-200') + ' ' + (isDark ? 'text-gray-300' : 'text-gray-700')
                }`}
              >
                {showPasswords ? <Eye size={18} /> : <Eye size={18} />}
                {showPasswords ? '隐藏密码' : '显示密码'}
              </button>
            </div>

            {/* 账号列表 */}
            <div className="space-y-4">
              <h4 className="font-semibold text-lg">
                {filterType === 'all' ? '所有账号' :
                 filterType === 'student' ? '学生账号' :
                 filterType === 'teacher' ? '老师账号' : '管理员账号'}
                {searchQuery && ` (搜索: ${searchQuery})`}
                <span className="text-sm ml-2" style={{ color: tokens.colors.text.muted }}>共 {filteredAccounts.length} 个</span>
              </h4>
              <div className="space-y-2">
                {filteredAccounts.length === 0 ? (
                  <div className="text-center py-8" style={{ color: tokens.colors.text.muted }}>
                    没有找到匹配的账号
                  </div>
                ) : (
                  filteredAccounts.map(account => (
                    <div key={account.id} className="rounded-lg p-4 transition" style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`, background: isDark ? 'rgba(255,255,255,0.02)' : '#fff' }}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div className={`px-3 py-1 rounded-full text-xs font-semibold`}
                              style={account.role === 'admin'
                                ? { background: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)', color: isDark ? '#fca5a5' : '#b91c1c' }
                                : account.role === 'teacher'
                                ? { background: isDark ? 'rgba(168,85,247,0.12)' : 'rgba(168,85,247,0.08)', color: isDark ? '#c4b5fd' : '#7c3aed' }
                                : { background: isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)', color: isDark ? '#93c5fd' : '#2563eb' }
                              }>
                              {account.role === 'admin' ? '管理员' :
                               account.role === 'teacher' ? '老师' : '学生'}
                            </div>
                            <div className="font-medium" style={{ color: tokens.colors.text.primary }}>{account.name}</div>
                          </div>
                          <div className="text-sm mt-1" style={{ color: tokens.colors.text.secondary }}>{account.email}</div>
                          <div className="text-xs mt-1 space-y-1" style={{ color: tokens.colors.text.muted }}>
                            {account.studentId && <div>学号: {account.studentId}</div>}
                            {account.teacherId && <div>教师ID: {account.teacherId}</div>}
                            {showPasswords && (
                              <div className="flex items-center gap-2">
                                <span>密码: </span>
                                <code className="px-2 py-0.5 rounded font-mono" style={{ background: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.06)', color: '#ef4444' }}>
                                  {account.password}
                                </code>
                              </div>
                            )}
                            {account.createdAt && (
                              <div>创建时间: {new Date(account.createdAt).toLocaleDateString()}</div>
                            )}
                          </div>
                        </div>
                        {account.role !== 'admin' && (
                          <button
                            onClick={async () => {
                              if (window.confirm(`确定要删除账号 ${account.name} 吗？`)) {
                                try {
                                  await usersAPI.delete(account.id);
                                  setAccountList(prev => prev.filter(u => u.id !== account.id));
                                  if (showNotification) showNotification(`已删除账号: ${account.name}`);
                                } catch (err) {
                                  if (showNotification) showNotification(err.message || '删除失败');
                                }
                              }
                            }}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="p-6 flex gap-3" style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`, background: isDark ? 'rgba(255,255,255,0.02)' : '#f9fafb' }}>
            <button
              onClick={() => {
                // 创建学生账号弹窗
                const studentId = prompt('请输入学生学号：');
                if (!studentId) return;
                // 检查学号是否已存在
                const existingAccount = allUsers.find(u => u.studentId === studentId);
                if (existingAccount) {
                  alert(`学号 ${studentId} 已有账号: ${existingAccount.name}`);
                  return;
                }
                // 查找学生信息
                const studentInfo = studentList.find(s => s.studentId === studentId);
                if (!studentInfo) {
                  alert(`学号 ${studentId} 在学生列表中不存在，请先添加学生信息`);
                  return;
                }
                const email = prompt(`请输入学生 ${studentInfo.name} 的邮箱：`);
                if (!email) return;
                const password = prompt('请设置初始密码（至少6位）：', `stu${studentId}`);
                if (!password || password.length < 6) {
                  alert('密码至少6位');
                  return;
                }
                const newUser = {
                  id: `student_${Date.now()}`,
                  email,
                  password,
                  role: 'student',
                  studentId,
                  name: studentInfo.name,
                  teacherId: studentInfo.teacherId,
                  createdAt: new Date().toISOString(),
                };
                setAllUsers(prev => [...prev, newUser]);
                // 绑定邮箱到学生信息
                setStudentList(prev => prev.map(s =>
                  s.studentId === studentId ? { ...s, email } : s
                ));
                if (showNotification) showNotification(`已为 ${studentInfo.name}(${studentId}) 创建账号`);
              }}
              className="flex-1 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition"
              style={{ background: isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)', color: '#3b82f6', border: `1px solid ${isDark ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.12)'}` }}
            >
              <UserPlus size={18} />
              创建学生账号
            </button>
            <button
              onClick={() => setShowAddTeacherModal(true)}
              className="flex-1 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition"
              style={{ background: isDark ? 'rgba(168,85,247,0.12)' : 'rgba(168,85,247,0.08)', color: '#8b5cf6', border: `1px solid ${isDark ? 'rgba(168,85,247,0.2)' : 'rgba(168,85,247,0.12)'}` }}
            >
              <Plus size={18} />
              添加老师账号
            </button>
            <button
              onClick={() => setShowAccountManagementModal(false)}
              className="flex-1 py-3 rounded-lg font-semibold transition" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb', color: tokens.colors.text.primary }}
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    );
  };
  // === 学生选择器组件（老师/管理员可用）===
  const StudentSelector = () => {
    if (user.role === 'student') return null;
    const visibleStudents = getVisibleStudents();
    if (visibleStudents.length === 0) return null;
    return (
      <div className="glass-panel p-3 flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm" style={{ color: tokens.colors.text.muted }}>
          <Eye size={16} />
          <span>当前学生:</span>
        </div>
        <select
          value={currentStudent.studentId || ''}
          onChange={(e) => {
            const selected = visibleStudents.find(s => s.studentId === e.target.value);
            if (selected) {
              setCurrentStudent({
                ...selected,
                targetCountry: '日本',
                targetLevel: selected.targetLevel || '修士',
                email: selected.email || `${selected.name.toLowerCase()}@example.com`
              });
            }
          }}
          className="flex-1 max-w-xs px-3 py-1.5 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#d1d5db'}`, color: tokens.colors.text.primary }}
        >
          {visibleStudents.map(s => (
            <option key={s.studentId} value={s.studentId}>
              {s.name} ({s.studentId}) {s.subject ? `· ${s.subject}` : ''}
            </option>
          ))}
        </select>
        <button
          onClick={() => setActiveTab('profile')}
          className="text-xs text-blue-500 hover:text-blue-700 whitespace-nowrap"
        >
          查看详情 →
        </button>
      </div>
    );
  };

  const TimelineView = () => (
    <div className="space-y-6">
      {/* 学生选择器 */}
      {user.role !== 'student' && <StudentSelector />}
      {/* 搜索和筛选栏 */}
      <div className="glass-panel p-4 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2" size={20} style={{ color: tokens.colors.text.muted }} />
            <input
              type="text"
              placeholder="搜索事项..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#d1d5db'}`, color: tokens.colors.text.primary }}
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#d1d5db'}`, color: tokens.colors.text.primary }}
          >
            <option value="all">所有分类</option>
            <option value="日语考试">日语考试</option>
            <option value="出愿">出愿</option>
            <option value="留考">留考</option>
            <option value="材料准备">材料准备</option>
            <option value="校内考">校内考</option>
            <option value="面试">面试</option>
            <option value="合格发表">合格发表</option>
          </select>
          {/* 视图切换 */}
          <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6' }}>
            <button
              onClick={() => setTimelineViewMode('card')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition`}
              style={timelineViewMode === 'card' ? { background: isDark ? 'rgba(255,255,255,0.12)' : '#fff', color: '#3b82f6', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : { color: tokens.colors.text.muted }}
            >
              <LayoutGrid size={16} /> 卡片
            </button>
            <button
              onClick={() => setTimelineViewMode('linear')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition`}
              style={timelineViewMode === 'linear' ? { background: isDark ? 'rgba(255,255,255,0.12)' : '#fff', color: '#3b82f6', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : { color: tokens.colors.text.muted }}
            >
              <LayoutList size={16} /> 线形
            </button>
            <button
              onClick={() => setTimelineViewMode('calendar')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition`}
              style={timelineViewMode === 'calendar' ? { background: isDark ? 'rgba(255,255,255,0.12)' : '#fff', color: '#3b82f6', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : { color: tokens.colors.text.muted }}
            >
              <Calendar size={16} /> 日历
            </button>
          </div>
          {/* 导出按钮 */}
          {hasPermission('export_data') && (
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition text-sm font-medium"
            >
              <Download size={16} /> 导出
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg z-20" style={{ background: isDark ? tokens.colors.surface.solid : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'}` }}>
                <button
                  onClick={() => {
                    const studentInfo = studentList.find(s => s.studentId === currentStudent.studentId) || currentStudent;
                    exportStudentToCSV(studentInfo, currentStudentData);
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition"
                  style={{ color: tokens.colors.text.primary }}
                  onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <FileText size={16} /> 导出学生信息 (CSV)
                </button>
                <button
                  onClick={() => {
                    exportEventsToICS(upcomingEvents, currentStudent.name);
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition"
                  style={{ color: tokens.colors.text.primary }}
                  onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Calendar size={16} /> 导出日历 (.ics)
                </button>
                <button
                  onClick={() => {
                    exportChecklistToPDF(currentStudent, checklist, schools);
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition"
                  style={{ color: tokens.colors.text.primary }}
                  onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Download size={16} /> 导出材料清单 (PDF)
                </button>
              </div>
            )}
          </div>
          )}
        </div>
      </div>

      {/* 概览卡片 */}
      <div className="glass-panel p-6 lg:p-8 rounded-xl">
        <h2 className="text-2xl lg:text-3xl font-bold mb-2" style={{ color: tokens.colors.text.primary }}>考学进度概览</h2>
        <p className="text-sm lg:text-base" style={{ color: tokens.colors.text.secondary }}>
          {user.role === 'teacher'
            ? `正在查看: ${currentStudent.name} (${currentStudent.studentId})`
            : `你有 ${filteredEvents.filter(e => e.urgent).length} 个紧急事项需要关注`
          }
        </p>
        <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-lg p-3" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}>
            <div className="text-2xl font-bold" style={{ color: tokens.colors.text.primary }}>{filteredEvents.length}</div>
            <div className="text-xs" style={{ color: tokens.colors.text.muted }}>待办事项</div>
          </div>
          <div className="rounded-lg p-3" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}>
            <div className="text-2xl font-bold" style={{ color: tokens.colors.text.primary }}>{schools.length}</div>
            <div className="text-xs" style={{ color: tokens.colors.text.muted }}>目标学校</div>
          </div>
          <div className="rounded-lg p-3" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}>
            <div className="text-2xl font-bold" style={{ color: tokens.colors.text.primary }}>
              {filteredEvents.filter(e => e.daysLeft <= 7).length}
            </div>
            <div className="text-xs" style={{ color: tokens.colors.text.muted }}>本周任务</div>
          </div>
          <div className="rounded-lg p-3" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}>
            <div className="text-2xl font-bold" style={{ color: tokens.colors.text.primary }}>
              {filteredEvents.filter(e => e.urgent).length}
            </div>
            <div className="text-xs" style={{ color: tokens.colors.text.muted }}>紧急事项</div>
          </div>
        </div>
      </div>

      {/* 事件列表 - 卡片视图 */}
      {timelineViewMode === 'card' && (
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredEvents.map(event => (
          <div
            key={event.id}
            className={`glass-card p-4 lg:p-5
              transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer ${event.completed ? 'opacity-60' : ''}`}
            onClick={() => setSelectedEventId(selectedEventId === event.id ? null : event.id)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{getTypeIcon(event.type)}</span>
                  <span className="text-xs font-semibold px-2 py-1 rounded" style={{ background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.9)' }}>
                    {event.category}
                  </span>
                  {event.urgent && (
                    <span className="flex items-center gap-1 text-xs text-red-600 font-semibold">
                      <AlertCircle size={14} />
                      紧急
                    </span>
                  )}
                  {event.schoolId && (
                    <span className="text-xs px-2 py-1 rounded" style={{ background: isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)', color: isDark ? '#93c5fd' : '#2563eb' }}>
                      学校关联
                    </span>
                  )}
                </div>
                <h3 className={`font-bold text-lg mb-1 ${event.completed ? 'line-through' : ''}`}>
                  {event.title}
                </h3>
                <p className="text-sm" style={{ color: tokens.colors.text.secondary }}>{event.date}</p>
              </div>
              <div className="text-right">
                <div className={`text-3xl font-bold ${
                  event.daysLeft <= 0 ? (isDark ? 'text-gray-400' : 'text-gray-600') :
                  event.daysLeft <= 7 ? 'text-red-500' :
                  event.daysLeft <= 30 ? 'text-orange-500' : (isDark ? 'text-gray-300' : 'text-gray-700')
                }`}>
                  {event.daysLeft <= 0 ? '已过期' : event.daysLeft}
                </div>
                <div className="text-xs" style={{ color: tokens.colors.text.muted }}>
                  {event.daysLeft <= 0 ? '' : '天后'}
                </div>
              </div>
            </div>

            {(selectedEventId === event.id || !isMobile) && (
              <div className="mt-3 p-3 rounded-lg animate-slide-up" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)', backdropFilter: 'blur(8px)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}` }}>
                {event.notes && <p className="text-sm mb-3" style={{ color: tokens.colors.text.secondary }}>{event.notes}</p>}
                {(user.role === 'teacher' || user.role === 'admin') && (
                  <div className="flex gap-2">
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await eventsAPI.toggleComplete(event.id);
                          const newEvents = upcomingEvents.map(ev =>
                            ev.id === event.id ? {...ev, completed: !ev.completed} : ev
                          );
                          setUpcomingEvents(newEvents);
                        } catch (err) {
                          console.error('更新事件状态失败:', err);
                          if (showNotification) showNotification('状态更新失败，请重试');
                        }
                      }}
                      className="flex-1 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1 transition"
                      style={{ background: isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)', color: isDark ? '#86efac' : '#16a34a' }}
                      onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(34,197,94,0.25)' : 'rgba(34,197,94,0.18)'}
                      onMouseLeave={e => e.currentTarget.style.background = isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)'}
                    >
                      <Check size={16} />
                      {event.completed ? '标记未完成' : '标记完成'}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingEvent(event);
                        setShowEventModal(true);
                      }}
                      className="flex-1 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1 transition"
                      style={{ background: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)', color: isDark ? '#93c5fd' : '#2563eb' }}
                      onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.18)'}
                      onMouseLeave={e => e.currentTarget.style.background = isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)'}
                    >
                      <Edit size={16} />
                      编辑
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteEvent(event.id);
                      }}
                      className="flex-1 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1 transition"
                      style={{ background: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)', color: isDark ? '#fca5a5' : '#dc2626' }}
                      onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.18)'}
                      onMouseLeave={e => e.currentTarget.style.background = isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)'}
                    >
                      <Trash2 size={16} />
                      删除
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      )}

      {/* 事件列表 - 线形视图 */}
      {timelineViewMode === 'linear' && (
        <TimelineLinear
          events={filteredEvents}
          user={user}
          onToggleComplete={async (eventId) => {
            try {
              await eventsAPI.toggleComplete(eventId);
              const newEvents = upcomingEvents.map(ev =>
                ev.id === eventId ? {...ev, completed: !ev.completed} : ev
              );
              setUpcomingEvents(newEvents);
            } catch (err) {
              console.error('更新事件状态失败:', err);
              if (showNotification) showNotification('状态更新失败，请重试');
            }
          }}
          onEdit={(event) => {
            setEditingEvent(event);
            setShowEventModal(true);
          }}
          onDelete={handleDeleteEvent}
        />
      )}

      {/* 事件列表 - 日历视图 */}
      {timelineViewMode === 'calendar' && (
        <CalendarView
          events={filteredEvents}
          onUpdateEvent={async (eventId, updates) => {
            try {
              await eventsAPI.update(eventId, updates);
              const newEvents = upcomingEvents.map(ev =>
                ev.id === eventId ? {...ev, ...updates} : ev
              );
              setUpcomingEvents(newEvents);
            } catch (err) {
              console.error('更新事件失败:', err);
              if (showNotification) showNotification('事件更新失败，请重试');
            }
          }}
          onAddEvent={(newEvent) => {
            setUpcomingEvents(prev => [...prev, { ...newEvent, id: Date.now() }]);
          }}
          user={user}
        />
      )}

      {(user.role === 'teacher' || user.role === 'admin') && (
        <button
          onClick={() => {
            setEditingEvent(null);
            setShowEventModal(true);
          }}
          className="w-full py-4 rounded-xl font-semibold transition flex items-center justify-center gap-2"
          style={{ background: isDark ? 'rgba(168,85,247,0.15)' : 'rgba(168,85,247,0.1)', color: isDark ? '#c4b5fd' : '#7c3aed' }}
          onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(168,85,247,0.25)' : 'rgba(168,85,247,0.18)'}
          onMouseLeave={e => e.currentTarget.style.background = isDark ? 'rgba(168,85,247,0.15)' : 'rgba(168,85,247,0.1)'}
        >
          <Plus size={20} />
          为该学生添加新事项
        </button>
      )}
    </div>
  );

  // 学校管理页面
  const SchoolsView = () => (
    <div className="space-y-6">
      {/* 学生选择器 */}
      {user.role !== 'student' && <StudentSelector />}
      {(user.role === 'teacher' || user.role === 'admin') && (
        <div className="flex justify-end">
          <button
            onClick={() => {
              setEditingSchool(null);
              setShowSchoolModal(true);
            }}
            className="px-4 py-2 rounded-lg font-semibold transition flex items-center gap-2"
            style={{ background: isDark ? 'rgba(168,85,247,0.15)' : 'rgba(168,85,247,0.1)', color: isDark ? '#c4b5fd' : '#7c3aed' }}
            onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(168,85,247,0.25)' : 'rgba(168,85,247,0.18)'}
            onMouseLeave={e => e.currentTarget.style.background = isDark ? 'rgba(168,85,247,0.15)' : 'rgba(168,85,247,0.1)'}
          >
            <Plus size={16} />
            添加学校
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {schools.map(school => {
          const progress = calculateSchoolProgress(school.name);
          return (
            <div key={school.id} className={`glass-card p-5 ${user.role === 'student' ? 'cursor-pointer' : ''}`}
              onClick={user.role === 'student' ? () => setSchoolDetailModal(school) : undefined}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold text-xl">{school.name}</h3>
                    <span className="text-xs px-2 py-1 rounded-full" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', color: tokens.colors.text.secondary }}>
                      {school.type}
                    </span>
                  </div>
                  <span className={`inline-block text-xs px-3 py-1 rounded-full border ${getStatusColor(school.status)}`}>
                    {getStatusText(school.status)}
                  </span>
                  <p className="text-sm mt-2" style={{ color: tokens.colors.text.secondary }}>{school.program}</p>
                </div>
                {(user.role === 'teacher' || user.role === 'admin') && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setEditingSchool(school);
                        setShowSchoolModal(true);
                      }}
                      className="p-2 rounded-lg transition"
                      style={{ color: tokens.colors.text.secondary }}
                      onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteSchool(school.id)}
                      className="p-2 rounded-lg transition"
                      style={{ color: '#ef4444' }}
                      onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.06)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {/* 募集要项链接 */}
                {school.requirementsUrl && (
                  <a
                    href={school.requirementsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg transition text-sm"
                    style={{ background: isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)', color: '#3b82f6' }}
                  >
                    <BookOpen size={16} />
                    查看募集要项
                    <ExternalLink size={14} />
                  </a>
                )}

                {/* 日期信息 */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded" style={{ background: isDark ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.06)' }}>
                    <div className="text-xs" style={{ color: isDark ? '#86efac' : '#16a34a' }}>出愿开始</div>
                    <div className="font-semibold text-sm" style={{ color: tokens.colors.text.primary }}>{school.applicationStartDate}</div>
                  </div>
                  <div className="p-2 rounded" style={{ background: isDark ? 'rgba(249,115,22,0.1)' : 'rgba(249,115,22,0.06)' }}>
                    <div className="text-xs" style={{ color: isDark ? '#fdba74' : '#ea580c' }}>出愿截止</div>
                    <div className="font-semibold text-sm" style={{ color: tokens.colors.text.primary }}>{school.applicationEndDate}</div>
                  </div>
                  <div className="p-2 rounded" style={{ background: isDark ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.06)' }}>
                    <div className="text-xs" style={{ color: isDark ? '#93c5fd' : '#2563eb' }}>考试日期</div>
                    <div className="font-semibold text-sm" style={{ color: tokens.colors.text.primary }}>{school.examDate}</div>
                  </div>
                  <div className="p-2 rounded" style={{ background: isDark ? 'rgba(168,85,247,0.1)' : 'rgba(168,85,247,0.06)' }}>
                    <div className="text-xs" style={{ color: isDark ? '#c4b5fd' : '#7c3aed' }}>合格发表</div>
                    <div className="font-semibold text-sm" style={{ color: tokens.colors.text.primary }}>{school.resultDate}</div>
                  </div>
                </div>

                {user.role === 'teacher' && school.teacherNotes && (
                  <div className="p-3 rounded-lg" style={{ background: isDark ? 'rgba(234,179,8,0.08)' : 'rgba(234,179,8,0.06)', border: `1px solid ${isDark ? 'rgba(234,179,8,0.2)' : 'rgba(234,179,8,0.3)'}` }}>
                    <div className="text-xs mb-1 font-semibold" style={{ color: isDark ? '#fde047' : '#a16207' }}>老师备注:</div>
                    <div className="text-sm" style={{ color: tokens.colors.text.secondary }}>{school.teacherNotes}</div>
                  </div>
                )}

                {/* 材料准备进度 - 与材料清单同步 */}
                <div>
                  <div className="flex items-center justify-between mb-1">
        <span style={{ color: tokens.colors.text.secondary }}>材料准备进度</span>
                    <span className="text-sm font-semibold">
                      {progress.completed}/{progress.total} 完成 ({progress.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`bg-gradient-to-r ${user.role === 'teacher' ? 'from-purple-500 to-blue-500' : 'from-blue-500 to-purple-500'} h-2 rounded-full transition-all`}
                      style={{ width: `${progress.percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // 材料清单页面
  const ChecklistView = () => (
    <div className="space-y-6">
      {/* 学生选择器 */}
      {user.role !== 'student' && <StudentSelector />}
      <div className="flex justify-end">
        <div className="flex gap-2">
          <button
            onClick={() => exportChecklistToPDF(currentStudent, checklist, schools)}
            className="px-4 py-2 rounded-lg font-semibold transition flex items-center gap-2"
            style={{ background: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)', color: isDark ? '#93c5fd' : '#2563eb' }}
            onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)'}>
            <Download size={16} />
            导出清单
          </button>
          {(user.role === 'teacher' || user.role === 'admin') && (
            <>
              <button className="px-4 py-2 rounded-lg font-semibold transition flex items-center gap-2"
                style={{ background: isDark ? 'rgba(168,85,247,0.15)' : 'rgba(168,85,247,0.1)', color: isDark ? '#c4b5fd' : '#7c3aed' }}
                onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(168,85,247,0.25)' : 'rgba(168,85,247,0.15)'}
                onMouseLeave={e => e.currentTarget.style.background = isDark ? 'rgba(168,85,247,0.15)' : 'rgba(168,85,247,0.1)'}>
                <Upload size={16} />
                上传材料
              </button>
              <button
                onClick={() => {
                  setEditingMaterial(null);
                  setShowMaterialModal(true);
                }}
                className="px-4 py-2 rounded-lg font-semibold transition flex items-center gap-2"
                style={{ background: isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)', color: isDark ? '#86efac' : '#16a34a' }}
                onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(34,197,94,0.25)' : 'rgba(34,197,94,0.15)'}
                onMouseLeave={e => e.currentTarget.style.background = isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)'}
              >
                <Plus size={16} />
                添加材料
              </button>
            </>
          )}
        </div>
      </div>

      {/* 进度统计 - 移到顶部 */}
      <div className="glass-panel p-6"
        style={{ background: isDark ? 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(168,85,247,0.08))' : 'linear-gradient(to right, #eff6ff, #faf5ff)' }}>
        <h3 className="font-bold text-lg mb-4" style={{ color: tokens.colors.text.primary }}>材料准备总进度</h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">通用材料</span>
              <span className="text-sm font-bold">
                {checklist.general ? Math.round(checklist.general.filter(i => i.completed).length / checklist.general.length * 100) : 0}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all"
                style={{ width: checklist.general && checklist.general.length > 0 ? `${checklist.general.filter(i => i.completed).length / checklist.general.length * 100}%` : '0%' }}
              />
            </div>
          </div>

          {checklist.schoolSpecific && Object.entries(checklist.schoolSpecific).map(([schoolName, materials]) => {
            const schoolProgress = calculateSchoolProgress(schoolName);
            return (
            <div key={schoolName}>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">{schoolName}</span>
                <span className="text-sm font-bold">
                  {schoolProgress.completed}/{schoolProgress.total} 完成 ({schoolProgress.percentage}%)
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-green-500 to-blue-500 h-3 rounded-full transition-all"
                  style={{ width: `${schoolProgress.percentage}%` }}
                />
              </div>
            </div>
          );
          })}
        </div>
      </div>

      {/* 通用材料 */}
      <div className="glass-panel p-5">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2" style={{ color: tokens.colors.text.primary }}>
          <FileText size={20} />
          通用材料
          <span className="text-sm font-normal" style={{ color: tokens.colors.text.muted }}>
            ({checklist.general.filter(i => i.completed).length}/{checklist.general.length})
          </span>
        </h3>
        <div className="space-y-3">
          {checklist.general.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-all
                ${item.completed ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}
            >
              <input
                type="checkbox"
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                checked={item.completed}
                onChange={(e) => handleMaterialCheck('general', item.id, e.target.checked)}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`${item.completed ? 'line-through text-gray-400' : ''}`}>
                    {item.item}
                  </span>
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-600"
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  截止: {item.deadline}
                  {item.completed && item.checkedBy && (
                    <span className="ml-2">
                      · {item.checkedBy === 'teacher' ? '老师勾选' : '学生勾选'} ({item.checkedAt})
                    </span>
                  )}
                </div>
              </div>
              {item.completed && (
                <div className="flex items-center gap-2">
                  {item.checkedBy === 'teacher' ? (
                    <GraduationCap className="text-purple-500" size={20} />
                  ) : (
                    <UserCheck className="text-blue-500" size={20} />
                  )}
                  <Check className="text-green-500" size={20} />
                </div>
              )}
              {(user.role === 'teacher' || user.role === 'admin') && (
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setEditingMaterial({...item, type: 'general'});
                      setShowMaterialModal(true);
                    }}
                    className="p-1 hover:bg-blue-100 rounded"
                  >
                    <Edit2 size={16} className="text-blue-600" />
                  </button>
                  <button
                    onClick={() => handleDeleteMaterial('general', item.id)}
                    className="p-1 hover:bg-red-100 rounded"
                  >
                    <Trash2 size={16} className="text-red-600" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 学校专用材料 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.entries(checklist.schoolSpecific).map(([schoolName, materials]) => (
          <div key={schoolName} className="glass-panel p-5">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2" style={{ color: tokens.colors.text.primary }}>
              <School size={20} />
              {schoolName}
              <span className="text-sm font-normal" style={{ color: tokens.colors.text.muted }}>
                ({materials.filter(i => i.completed).length}/{materials.length})
              </span>
            </h3>
            <div className="space-y-3">
              {materials.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all
                    ${item.completed ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}
                >
                  <input
                    type="checkbox"
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    checked={item.completed}
                    onChange={(e) => handleMaterialCheck('school', item.id, e.target.checked, schoolName)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`${item.completed ? 'line-through text-gray-400' : ''}`}>
                        {item.item}
                      </span>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-600"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      截止: {item.deadline}
                      {item.completed && item.checkedBy && (
                        <span className="ml-2">
                          · {item.checkedBy === 'teacher' ? '老师勾选' : '学生勾选'} ({item.checkedAt})
                        </span>
                      )}
                    </div>
                  </div>
                  {item.completed && (
                    <div className="flex items-center gap-2">
                      {item.checkedBy === 'teacher' ? (
                        <GraduationCap className="text-purple-500" size={20} />
                      ) : (
                        <UserCheck className="text-blue-500" size={20} />
                      )}
                      <Check className="text-green-500" size={20} />
                    </div>
                  )}
                  {(user.role === 'teacher' || user.role === 'admin') && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setEditingMaterial({...item, type: 'school', school: schoolName});
                          setShowMaterialModal(true);
                        }}
                        className="p-1 hover:bg-blue-100 rounded"
                      >
                        <Edit2 size={16} className="text-blue-600" />
                      </button>
                      <button
                        onClick={() => handleDeleteMaterial('school', item.id, schoolName)}
                        className="p-1 hover:bg-red-100 rounded"
                      >
                        <Trash2 size={16} className="text-red-600" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const tabs = [
    // 老师和管理员显示仪表盘
    ...(user.role !== 'student' ? [{ id: 'dashboard', label: '仪表盘', icon: Home }] : []),
    // 时间线/学校/材料 - 老师需要对应权限，学生也可见
    ...(user.role === 'student' || user.role === 'admin' || hasPermission('manage_events') ? [{ id: 'timeline', label: '时间线', icon: Clock }] : []),
    ...(user.role === 'student' || user.role === 'admin' || hasPermission('manage_schools') ? [{ id: 'schools', label: '学校', icon: School }] : []),
    ...(user.role === 'student' || user.role === 'admin' || hasPermission('manage_materials') ? [{ id: 'checklist', label: '材料', icon: CheckSquare }] : []),
    // 学生列表 - 老师需要学生管理权限
    ...(user.role !== 'student' && (user.role === 'admin' || hasPermission('manage_students')) ? [{ id: 'students', label: '学生列表', icon: Users }] : []),
    ...(user.role !== 'student' ? [{ id: 'profile', label: '学生信息', icon: UserCircle }] : []),
    ...(user.role === 'admin' ? [{ id: 'teachers', label: '老师管理', icon: GraduationCap }] : []),
    // 学校信息库 - 学生不显示，老师需权限
    ...(user.role !== 'student' && (user.role === 'admin' || hasPermission('manage_school_db')) ? [{ id: 'schooldb', label: '学校信息库', icon: BookOpen }] : []),
    // 近期可报学校 - 所有角色可见（学生端重要入口）
    { id: 'upcoming', label: '近期可报', icon: Calendar },
  ];

  // 获取主题上下文
  const { isDark, tokens, backgroundStyle, toggleMode, resolvedMode, glassEnabled } = useTheme();

  return (
    <div className="min-h-screen themed-bg noise-overlay" style={backgroundStyle}>
      {/* 背景光斑装饰层 */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="animate-glow-float absolute rounded-full opacity-30" style={{
          width: '40vw', height: '40vw', top: '10%', left: '5%',
          background: `radial-gradient(circle, ${isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)'}, transparent 70%)`,
          filter: 'blur(60px)',
        }} />
        <div className="animate-glow-float-slow absolute rounded-full opacity-25" style={{
          width: '35vw', height: '35vw', bottom: '15%', right: '10%',
          background: `radial-gradient(circle, ${isDark ? 'rgba(139,92,246,0.12)' : 'rgba(139,92,246,0.06)'}, transparent 70%)`,
          filter: 'blur(50px)',
        }} />
        <div className="animate-glow-float absolute rounded-full opacity-20" style={{
          width: '25vw', height: '25vw', top: '60%', left: '50%',
          background: `radial-gradient(circle, ${isDark ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.05)'}, transparent 70%)`,
          filter: 'blur(40px)',
          animationDelay: '3s',
        }} />
      </div>

      {/* Header - 玻璃拟态固定顶栏 */}
      <div className={`fixed top-0 left-0 right-0 z-40 h-14 ${glassEnabled ? 'glass-heavy' : ''}`}
        style={glassEnabled ? {} : {
          backgroundColor: isDark ? 'rgba(15,15,35,0.95)' : 'rgba(255,255,255,0.95)',
          borderBottom: `1px solid ${tokens.colors.border.subtle}`,
        }}>
        <div className="h-full px-4 lg:px-6 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            {isMobile && (
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: tokens.colors.text.secondary }}
                onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Menu size={22} />
              </button>
            )}
            <h1 className="text-base lg:text-lg font-semibold" style={{ color: tokens.colors.text.primary }}>
              留学考学助手
            </h1>
            <span className="hidden sm:inline-block text-xs pl-3 ml-1" style={{
              color: tokens.colors.text.muted,
              borderLeft: `1px solid ${tokens.colors.border.subtle}`,
            }}>
              {user.role === 'teacher' ? '老师端' :
               user.role === 'admin' ? '管理端' : '学生端'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 lg:gap-2">
            {/* 当前查看学生提示 */}
            {(user.role === 'teacher' || user.role === 'admin') && activeTab === 'profile' && currentStudent.name !== user.name && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6', color: tokens.colors.text.muted }}>
                <Eye size={13} />
                <span>查看: {currentStudent.name}</span>
              </div>
            )}

            {/* 主题切换按钮 */}
            <button
              onClick={() => toggleMode()}
              className="p-2 rounded-lg transition-all"
              style={{ color: tokens.colors.text.muted }}
              onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              title={resolvedMode === 'dark' ? '切换为浅色' : '切换为深色'}
            >
              {resolvedMode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* 外观自定义按钮 */}
            <button
              onClick={() => setShowThemeCustomizer(true)}
              className="p-2 rounded-lg transition-all"
              style={{ color: tokens.colors.text.muted }}
              onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              title="外观设置"
            >
              <Palette size={18} />
            </button>

            {/* 通知按钮 */}
            <button className="p-2 rounded-lg relative transition-all"
              style={{ color: tokens.colors.text.muted }}
              onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <Bell size={18} />
              {filteredEvents.filter(e => e.urgent).length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full"></span>
              )}
            </button>

            {(user.role === 'teacher' || user.role === 'admin') && (
              <button
                onClick={() => setShowStudentList(true)}
                className="p-2 rounded-lg transition-all"
                style={{ color: tokens.colors.text.muted }}
                onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                title="学生列表"
              >
                <Users size={18} />
              </button>
            )}

            {/* 管理员生成测试数据按钮 */}
            {user.role === 'admin' && (
              <button
                onClick={() => {
                  if (window.confirm('⚠️ 这将覆盖现有的学生和申请数据，确定生成测试数据？')) {
                    logAction(LOG_CATEGORIES.DATA, '生成测试数据');
                    generateTestData();
                    window.location.reload();
                  }
                }}
                className="p-2 rounded-lg transition-all"
                style={{ color: tokens.colors.text.muted }}
                onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                title="生成测试数据"
              >
                <Download size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex pt-14 relative z-10">
      {/* Desktop Sidebar - 玻璃拟态侧边栏 */}
      {!isMobile && (
        <div className={`fixed top-14 left-0 bottom-0 z-30 transition-all duration-300 flex flex-col ${sidebarCollapsed ? 'w-16' : 'w-56'}`}
          style={{
            background: glassEnabled ? tokens.colors.surface.glass : tokens.colors.surface.solid,
            backdropFilter: glassEnabled ? `blur(${tokens.blur.heavyBlur}px)` : 'none',
            WebkitBackdropFilter: glassEnabled ? `blur(${tokens.blur.heavyBlur}px)` : 'none',
            borderRight: `1px solid ${tokens.colors.border.hairline}`,
          }}>
          {/* 导航菜单 - 按功能分组 */}
          <div className="flex-1 pt-2 pb-2 overflow-y-auto">
            {(() => {
              // 按功能分组
              const groups = [
                { label: '概览', ids: ['dashboard'] },
                { label: '学业管理', ids: ['timeline', 'schools', 'checklist'] },
                { label: '人员管理', ids: ['students', 'profile', 'teachers'] },
                { label: '信息查询', ids: ['schooldb', 'upcoming'] },
              ];
              return groups.map((group, gi) => {
                const groupTabs = tabs.filter(t => group.ids.includes(t.id));
                if (groupTabs.length === 0) return null;
                return (
                  <div key={gi}>
                    {!sidebarCollapsed && (
                      <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: tokens.colors.text.muted }}>
                        {group.label}
                      </div>
                    )}
                    {sidebarCollapsed && gi > 0 && (
                      <div className="mx-3 my-1.5" style={{ borderTop: `1px solid ${tokens.colors.border.hairline}` }} />
                    )}
                    {groupTabs.map(tab => {
                      const Icon = tab.icon;
                      const isActive = activeTab === tab.id;
                      const activeColors = {
                        admin: { border: tokens.colors.accent.danger, bg: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.06)' },
                        teacher: { border: tokens.colors.accent.secondary, bg: isDark ? 'rgba(139,92,246,0.1)' : 'rgba(139,92,246,0.06)' },
                        student: { border: tokens.colors.accent.primary, bg: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)' },
                      };
                      const ac = activeColors[user.role] || activeColors.student;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => { setActiveTab(tab.id); setShowSidebarUserMenu(false); }}
                          title={sidebarCollapsed ? tab.label : ''}
                          className={`w-full flex items-center gap-3 transition-all ${
                            sidebarCollapsed ? 'justify-center px-0 py-2.5' : 'px-4 py-2'
                          }`}
                          style={{
                            color: isActive ? tokens.colors.text.primary : tokens.colors.text.muted,
                            fontWeight: isActive ? 600 : 400,
                            background: isActive ? ac.bg : 'transparent',
                            ...(isActive ? {
                              borderLeft: `3px solid ${ac.border}`,
                              paddingLeft: sidebarCollapsed ? undefined : '13px',
                            } : {}),
                          }}
                          onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'; }}
                          onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                        >
                          <Icon size={sidebarCollapsed ? 20 : 17} />
                          {!sidebarCollapsed && <span className="text-[13px]">{tab.label}</span>}
                        </button>
                      );
                    })}
                  </div>
                );
              });
            })()}
          </div>

          {/* 侧边栏底部 - 头像菜单 + 折叠按钮 */}
          <div style={{ borderTop: `1px solid ${tokens.colors.border.hairline}` }} className="relative">
            {!sidebarCollapsed ? (
              <button
                onClick={() => setShowSidebarUserMenu(!showSidebarUserMenu)}
                className="w-full p-3 flex items-center gap-2 transition text-left"
                style={{ color: tokens.colors.text.secondary }}
                onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0"
                  style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', color: tokens.colors.text.secondary }}>
                  {user.name?.charAt(0) || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate" style={{ color: tokens.colors.text.primary }}>{user.name}</div>
                  <div className="text-[10px] truncate" style={{ color: tokens.colors.text.muted }}>
                    {user.role === 'admin' ? '管理员' : user.role === 'teacher' ? '老师' : '学生'}
                  </div>
                </div>
                <ChevronDown size={12} style={{ color: tokens.colors.text.muted }} className={`transition-transform ${showSidebarUserMenu ? 'rotate-180' : ''}`} />
              </button>
            ) : (
              <button
                onClick={() => setShowSidebarUserMenu(!showSidebarUserMenu)}
                className="w-full flex justify-center py-3 transition"
                title={user.name}
                onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
                  style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', color: tokens.colors.text.secondary }}>
                  {user.name?.charAt(0) || '?'}
                </div>
              </button>
            )}

            {/* 折叠/展开按钮 - 放在底部 */}
            <div className={`flex ${sidebarCollapsed ? 'justify-center' : 'justify-end'} px-2 py-1.5`}
              style={{ borderTop: `1px solid ${tokens.colors.border.hairline}` }}>
              <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-1.5 rounded-md transition"
                style={{ color: tokens.colors.text.muted }}
                onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                title={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}>
                {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
            </div>

            {/* 头像弹出菜单 */}
            {showSidebarUserMenu && (
              <div className={`absolute bottom-full mb-1 rounded-xl overflow-hidden z-50 animate-fade-in ${sidebarCollapsed ? 'left-2 w-56' : 'left-2 right-2'}`}
                style={{
                  background: isDark ? 'rgba(30,30,60,0.92)' : 'rgba(255,255,255,0.95)',
                  backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
                  border: `1px solid ${tokens.colors.border.hairline}`,
                  boxShadow: isDark ? '0 12px 40px rgba(0,0,0,0.4)' : '0 12px 40px rgba(0,0,0,0.12)',
                  maxHeight: 'calc(100vh - 140px)',
                  overflowY: 'auto',
                }}>
                {/* 用户信息区 */}
                <div className="p-3" style={{ borderBottom: `1px solid ${tokens.colors.border.hairline}` }}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm"
                      style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', color: tokens.colors.text.secondary }}>
                      {user.name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate" style={{ color: tokens.colors.text.primary }}>{user.name}</div>
                      <div className="text-[11px] truncate" style={{ color: tokens.colors.text.muted }}>{user.email}</div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          user.role === 'admin' ? 'bg-red-100 text-red-600' :
                          user.role === 'teacher' ? 'bg-purple-100 text-purple-600' :
                          'bg-blue-100 text-blue-600'
                        }`} style={isDark ? {
                          background: user.role === 'admin' ? 'rgba(239,68,68,0.15)' :
                                     user.role === 'teacher' ? 'rgba(139,92,246,0.15)' : 'rgba(99,102,241,0.15)',
                          color: user.role === 'admin' ? '#f87171' :
                                 user.role === 'teacher' ? '#a78bfa' : '#818cf8',
                        } : {}}>
                          {user.role === 'admin' ? '管理员' : user.role === 'teacher' ? '老师' : '学生'}
                        </span>
                        {user.studentId && <span className="text-[10px]" style={{ color: tokens.colors.text.muted }}>学号: {user.studentId}</span>}
                      </div>
                    </div>
                  </div>
                </div>
                {/* 菜单选项 */}
                <div className="py-1">
                  <button
                    onClick={() => { setShowSidebarUserMenu(false); setShowSettingsModal(true); setSettingsModalInitTab(null); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition"
                    style={{ color: tokens.colors.text.secondary }}
                    onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <Settings size={16} style={{ color: tokens.colors.text.muted }} /> 设置
                  </button>
                  <button
                    onClick={() => { setShowSidebarUserMenu(false); setShowThemeCustomizer(true); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition"
                    style={{ color: tokens.colors.text.secondary }}
                    onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <Palette size={16} style={{ color: tokens.colors.text.muted }} /> 外观设置
                  </button>
                  {(user.role === 'teacher' || user.role === 'student') && (
                    <button
                      onClick={() => { setShowSidebarUserMenu(false); setShowSettingsModal(true); setSettingsModalInitTab('security'); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition"
                      style={{ color: tokens.colors.text.secondary }}
                      onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <Lock size={16} style={{ color: tokens.colors.text.muted }} /> 修改密码
                    </button>
                  )}
                  {user.role === 'admin' && (
                    <button
                      onClick={() => { setShowSidebarUserMenu(false); setShowAccountManagementModal(true); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition"
                      style={{ color: tokens.colors.accent.danger }}
                      onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <Shield size={16} /> 账号管理
                    </button>
                  )}
                  <div style={{ borderTop: `1px solid ${tokens.colors.border.hairline}` }} className="my-1" />
                  <button
                    onClick={() => { setShowSidebarUserMenu(false); setShowChangelogPanel(true); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition"
                    style={{ color: tokens.colors.text.secondary }}
                    onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <FileText size={16} style={{ color: tokens.colors.text.muted }} /> 版本日志
                  </button>
                  <button
                    onClick={() => { setShowSidebarUserMenu(false); setShowFeedbackPanel(true); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition"
                    style={{ color: tokens.colors.text.secondary }}
                    onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <Mail size={16} style={{ color: tokens.colors.text.muted }} /> 反馈建议
                  </button>
                  {user?.role === 'admin' && (
                    <button
                      onClick={() => { setShowSidebarUserMenu(false); setShowFeedbackHistory(true); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition"
                      style={{ color: tokens.colors.text.secondary }}
                      onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <FileText size={16} style={{ color: tokens.colors.text.muted }} /> 查看反馈
                    </button>
                  )}
                  <div style={{ borderTop: `1px solid ${tokens.colors.border.hairline}` }} className="my-1" />
                  <button
                    onClick={() => { setShowSidebarUserMenu(false); onLogout(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition"
                    style={{ color: tokens.colors.accent.danger }}
                    onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <LogOut size={16} /> 退出登录
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {isMobile && showMobileMenu && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 animate-fade-in" style={{ backgroundColor: `rgba(0,0,0,${isDark ? '0.6' : '0.4'})`, backdropFilter: 'blur(4px)' }} onClick={() => setShowMobileMenu(false)} />
          <div className="relative flex-1 flex flex-col max-w-xs w-full animate-slide-in-left"
            style={{
              background: isDark ? 'rgba(20,20,45,0.95)' : 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
            }}>
            <div className="p-4" style={{ borderBottom: `1px solid ${tokens.colors.border.hairline}` }}>
              <h2 className="text-base font-semibold" style={{ color: tokens.colors.text.primary }}>菜单</h2>
            </div>
            <div className="flex-1 py-4">
              {tabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setShowMobileMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-6 py-3 transition`}
                    style={{
                      color: isActive ? tokens.colors.text.primary : tokens.colors.text.muted,
                      fontWeight: isActive ? 600 : 400,
                      background: isActive ? (isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)') : 'transparent',
                      borderLeft: isActive ? `3px solid ${tokens.colors.accent.primary}` : '3px solid transparent',
                    }}
                  >
                    <Icon size={20} />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className={`flex-1 transition-all duration-300 relative z-10 ${!isMobile ? (sidebarCollapsed ? 'ml-16' : 'ml-56') : ''}`}
        onClick={() => showSidebarUserMenu && setShowSidebarUserMenu(false)}>
      <div className={`max-w-7xl mx-auto px-4 lg:px-5 py-5 lg:py-6 ${isMobile ? 'pb-24' : ''}`}>
        <div key={activeTab} className="page-transition">
        {activeTab === 'dashboard' && (
          <Dashboard
            user={user}
            studentList={studentList}
            events={filteredEvents}
            schools={schools}
            checklist={checklist}
            currentStudent={currentStudent}
            getVisibleStudents={getVisibleStudents}
            getTeacherList={getTeacherList}
            onNavigate={(tab) => setActiveTab(tab)}
            onSelectStudent={(student) => {
              setCurrentStudent({
                ...student,
                targetCountry: '日本',
                targetLevel: student.targetLevel || '修士',
                email: student.email || `${student.name.toLowerCase()}@example.com`
              });
              setActiveTab('profile');
            }}
            onViewAllStudents={() => setActiveTab('students')}
          />
        )}
        {activeTab === 'timeline' && (
          user.role === 'admin' && !adminHasOwnStudents ? (
            <AdminPublicView
              type="timeline"
              onNavigate={(tab) => setActiveTab(tab)}
              onSelectStudent={() => setActiveTab('students')}
            />
          ) : <TimelineView />
        )}
        {activeTab === 'schools' && (
          user.role === 'admin' && !adminHasOwnStudents ? (
            <AdminPublicView
              type="schools"
              onNavigate={(tab) => setActiveTab(tab)}
              onSelectStudent={() => setActiveTab('students')}
            />
          ) : <SchoolsView />
        )}
        {activeTab === 'checklist' && (
          user.role === 'admin' && !adminHasOwnStudents ? (
            <AdminPublicView
              type="checklist"
              onNavigate={(tab) => setActiveTab(tab)}
              onSelectStudent={() => setActiveTab('students')}
            />
          ) : <ChecklistView />
        )}
        {activeTab === 'profile' && (
          <StudentProfile
            student={currentStudent}
            studentData={currentStudentData}
            onBack={() => setActiveTab(user.role !== 'student' ? 'dashboard' : 'timeline')}
            onUpdate={(updated) => {
              setCurrentStudent(prev => ({...prev, ...updated}));
            }}
          />
        )}
        {activeTab === 'students' && (
          <StudentListPage
            user={user}
            getVisibleStudents={getVisibleStudents}
            getTeacherList={getTeacherList}
            studentData={studentData}
            onSelectStudent={(student) => {
              setCurrentStudent({
                ...student,
                targetCountry: '日本',
                targetLevel: student.targetLevel || '修士',
                email: student.email || `${student.name.toLowerCase()}@example.com`
              });
              setActiveTab('profile');
            }}
            onAddStudent={() => setShowAddStudentModal(true)}
          />
        )}
        {activeTab === 'teachers' && <TeacherManagement />}
        {activeTab === 'schooldb' && <SchoolDatabase />}
        {activeTab === 'upcoming' && (
          <UpcomingSchools
            studentList={studentList}
            studentData={studentData}
            currentStudent={currentStudent}
            user={user}
          />
        )}

        {/* 页面底部免责声明 */}
        <div className="mt-8 pb-4 text-center" style={{ color: tokens.colors.text.muted }}>
          <div className="text-xs leading-relaxed space-y-1 max-w-2xl mx-auto px-4" style={{ opacity: 0.7 }}>
            <p>© {new Date().getFullYear()} JSA 日本留学考学助手 · 仅供内部学习管理使用</p>
            <p>本平台所展示的学校信息、出愿日期等数据仅供参考，请以各校官网公布的最新信息为准。</p>
            <p>平台不对因信息延迟或错误导致的任何损失承担责任。如有问题请联系管理员。</p>
          </div>
        </div>
        </div>
      </div>
      </div>
      </div>

      {/* Mobile Bottom Navigation - 玻璃拟态 */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 z-30"
          style={{
            background: glassEnabled ? tokens.colors.surface.glass : tokens.colors.surface.solid,
            backdropFilter: glassEnabled ? `blur(${tokens.blur.heavyBlur}px)` : 'none',
            WebkitBackdropFilter: glassEnabled ? `blur(${tokens.blur.heavyBlur}px)` : 'none',
            borderTop: `1px solid ${tokens.colors.border.hairline}`,
            boxShadow: isDark ? '0 -4px 20px rgba(0,0,0,0.3)' : '0 -4px 20px rgba(0,0,0,0.06)',
          }}>
          <div className="flex justify-around py-2">
            {tabs.slice(0, 4).map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex flex-col items-center justify-center p-2 rounded-lg flex-1 transition"
                  style={{
                    color: isActive ? tokens.colors.accent.primary : tokens.colors.text.muted,
                    background: isActive ? (isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)') : 'transparent',
                  }}
                >
                  <Icon size={22} />
                  <span className="text-[10px] mt-0.5 font-medium">{tab.label}</span>
                </button>
              );
            })}
            {tabs.length > 4 && (
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="flex flex-col items-center justify-center p-2 rounded-lg flex-1 transition"
                style={{
                  color: tabs.slice(4).some(t => t.id === activeTab) ? tokens.colors.accent.primary : tokens.colors.text.muted,
                  background: tabs.slice(4).some(t => t.id === activeTab) ? (isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)') : 'transparent',
                }}
              >
                <Menu size={22} />
                <span className="text-[10px] mt-0.5 font-medium">更多</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Theme Customizer */}
      {showThemeCustomizer && <ThemeCustomizer onClose={() => setShowThemeCustomizer(false)} />}

      {/* Modals */}
      {showStudentList && <StudentListModal />}
      {showEventModal && <EventModal />}
      {showSchoolModal && <SchoolModal />}
      {showMaterialModal && <MaterialModal />}
      {showTransferModal && <TransferModal />}
      {showAddStudentModal && <AddStudentModal />}
      {showAccountManagementModal && <AccountManagementModal />}
      {showAddTeacherModal && <AddTeacherModal />}
      {showChangePasswordModal && <ChangePasswordModal />}

      {/* 学生端学校详情弹窗 */}
      {schoolDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" style={{ backgroundColor: `rgba(0,0,0,${isDark ? '0.6' : '0.4'})`, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }} onClick={() => setSchoolDetailModal(null)}>
          <div className="rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto animate-scale-in" style={{
            background: glassEnabled ? tokens.colors.surface.glass : (isDark ? tokens.colors.surface.solid : '#fff'),
            backdropFilter: glassEnabled ? `blur(${tokens.blur.backdropBlur}px)` : 'none',
            WebkitBackdropFilter: glassEnabled ? `blur(${tokens.blur.backdropBlur}px)` : 'none',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`,
            boxShadow: glassEnabled ? tokens.shadow.elevation : '0 20px 60px rgba(0,0,0,0.3)',
          }} onClick={e => e.stopPropagation()}>
            <div className="relative">
              <div className={`p-6 rounded-t-2xl text-white bg-gradient-to-r ${
                schoolDetailModal.type === '国立' ? 'from-blue-500 to-blue-700' :
                schoolDetailModal.type === '公立' ? 'from-green-500 to-green-700' :
                'from-orange-500 to-orange-700'
              }`}>
                <button onClick={() => setSchoolDetailModal(null)}
                  className="absolute top-4 right-4 p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition">
                  <X size={18} />
                </button>
                <h3 className="text-2xl font-bold mb-1">{schoolDetailModal.name}</h3>
                <div className="flex items-center gap-2 text-white/80 text-sm">
                  <span className="px-2 py-0.5 bg-white/20 rounded-full">{schoolDetailModal.type}</span>
                  <span>{schoolDetailModal.program}</span>
                </div>
                <div className="mt-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    schoolDetailModal.status === 'admitted' ? 'bg-yellow-400 text-yellow-900' :
                    schoolDetailModal.status === 'rejected' ? 'bg-red-400 text-red-900' :
                    schoolDetailModal.status === 'submitted' ? 'bg-orange-400 text-orange-900' :
                    schoolDetailModal.status === 'applied' ? 'bg-green-400 text-green-900' :
                    schoolDetailModal.status === 'not_started' ? 'bg-gray-400 text-gray-900' :
                    'bg-blue-400 text-blue-900'
                  }`}>
                    {getStatusText(schoolDetailModal.status)}
                  </span>
                </div>
              </div>

              <div className="p-6 space-y-5">
                {/* 重要日期 */}
                <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2" style={{ color: tokens.colors.text.primary }}><Calendar size={16} /> 重要日期</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {schoolDetailModal.applicationStartDate && (
                      <div className="p-3 rounded-lg" style={{ background: isDark ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.06)' }}>
                        <div className="text-xs" style={{ color: isDark ? '#86efac' : '#16a34a' }}>出愿开始</div>
                        <div className="font-semibold text-sm" style={{ color: tokens.colors.text.primary }}>{schoolDetailModal.applicationStartDate}</div>
                      </div>
                    )}
                    {schoolDetailModal.applicationEndDate && (
                      <div className="p-3 rounded-lg" style={{ background: isDark ? 'rgba(249,115,22,0.1)' : 'rgba(249,115,22,0.06)' }}>
                        <div className="text-xs" style={{ color: isDark ? '#fdba74' : '#ea580c' }}>出愿截止</div>
                        <div className="font-semibold text-sm" style={{ color: tokens.colors.text.primary }}>{schoolDetailModal.applicationEndDate}</div>
                      </div>
                    )}
                    {schoolDetailModal.examDate && (
                      <div className="p-3 rounded-lg" style={{ background: isDark ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.06)' }}>
                        <div className="text-xs" style={{ color: isDark ? '#93c5fd' : '#2563eb' }}>考试日期</div>
                        <div className="font-semibold text-sm" style={{ color: tokens.colors.text.primary }}>{schoolDetailModal.examDate}</div>
                      </div>
                    )}
                    {schoolDetailModal.resultDate && (
                      <div className="p-3 rounded-lg" style={{ background: isDark ? 'rgba(168,85,247,0.1)' : 'rgba(168,85,247,0.06)' }}>
                        <div className="text-xs" style={{ color: isDark ? '#c4b5fd' : '#7c3aed' }}>合格发表</div>
                        <div className="font-semibold text-sm" style={{ color: tokens.colors.text.primary }}>{schoolDetailModal.resultDate}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 材料准备进度 */}
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2" style={{ color: tokens.colors.text.primary }}><CheckSquare size={16} /> 材料准备</h4>
                  {(() => {
                    const progress = calculateSchoolProgress(schoolDetailModal.name);
                    return (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span style={{ color: tokens.colors.text.muted }}>{progress.completed}/{progress.total} 完成</span>
                          <span className="font-bold" style={{ color: tokens.colors.text.primary }}>{progress.percentage}%</span>
                        </div>
                        <div className="w-full rounded-full h-2.5" style={{ background: isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb' }}>
                          <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-2.5 rounded-full transition-all"
                            style={{ width: `${progress.percentage}%` }} />
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* 募集要项链接 */}
                {schoolDetailModal.requirementsUrl && (
                  <a href={schoolDetailModal.requirementsUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-3 rounded-lg transition text-sm font-medium"
                    style={{ background: isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)', color: '#3b82f6' }}>
                    <BookOpen size={18} /> 查看募集要项 <ExternalLink size={14} className="ml-auto" />
                  </a>
                )}

                {/* 提交材料 */}
                {schoolDetailModal.materials && schoolDetailModal.materials.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2" style={{ color: tokens.colors.text.primary }}><FileText size={16} /> 需提交材料</h4>
                    <div className="space-y-2">
                      {schoolDetailModal.materials.map((m, i) => (
                        <div key={i} className="flex items-center justify-between p-2.5 rounded-lg text-sm" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb', border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb'}` }}>
                          <span style={{ color: tokens.colors.text.primary }}>{m.name}</span>
                          <span className="text-xs" style={{ color: tokens.colors.text.muted }}>截止: {m.deadline}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 设置弹窗 */}
      {showSettingsModal && (
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" style={{ backgroundColor: `rgba(0,0,0,${isDark ? '0.6' : '0.4'})`, backdropFilter: 'blur(4px)' }}>
          <div className="rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in" style={{ background: isDark ? tokens.colors.surface.solid : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}` }}>
            <div className="p-4 flex items-center justify-between sticky top-0 z-10 rounded-t-2xl" style={{ background: isDark ? 'rgba(30,30,40,0.85)' : 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}` }}>
              <h3 className="font-bold text-lg" style={{ color: tokens.colors.text.primary }}>设置</h3>
              <button onClick={() => { setShowSettingsModal(false); setSettingsModalInitTab(null); }}
                className="p-2 rounded-lg transition" style={{ color: tokens.colors.text.secondary }}
                onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}><X size={20} /></button>
            </div>
            {/* 如果没有指定初始 tab，则显示一览页面 */}
            {!settingsModalInitTab ? (
              <div className="p-6">
                <p className="text-sm mb-4" style={{ color: tokens.colors.text.muted }}>选择要修改的设置项目</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => setSettingsModalInitTab('profile')}
                    className="flex items-center gap-4 p-4 rounded-xl transition text-left group"
                    style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#fff', border: `2px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6'}` }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = isDark ? 'rgba(59,130,246,0.4)' : '#93c5fd'; e.currentTarget.style.background = isDark ? 'rgba(59,130,246,0.06)' : 'rgba(59,130,246,0.03)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6'; e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : '#fff'; }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)' }}>
                      <User size={20} style={{ color: '#3b82f6' }} />
                    </div>
                    <div>
                      <div className="font-semibold text-sm" style={{ color: tokens.colors.text.primary }}>个人信息</div>
                      <div className="text-xs" style={{ color: tokens.colors.text.muted }}>姓名、邮箱、电话、住址等</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setSettingsModalInitTab('security')}
                    className="flex items-center gap-4 p-4 rounded-xl transition text-left group"
                    style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#fff', border: `2px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6'}` }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = isDark ? 'rgba(249,115,22,0.4)' : '#fdba74'; e.currentTarget.style.background = isDark ? 'rgba(249,115,22,0.06)' : 'rgba(249,115,22,0.03)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6'; e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : '#fff'; }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: isDark ? 'rgba(249,115,22,0.15)' : 'rgba(249,115,22,0.1)' }}>
                      <Lock size={20} style={{ color: '#f97316' }} />
                    </div>
                    <div>
                      <div className="font-semibold text-sm" style={{ color: tokens.colors.text.primary }}>安全设置</div>
                      <div className="text-xs" style={{ color: tokens.colors.text.muted }}>修改登录密码</div>
                    </div>
                  </button>
                  <button
                    onClick={() => { setShowSettingsModal(false); setShowThemeCustomizer(true); }}
                    className="flex items-center gap-4 p-4 rounded-xl transition text-left group"
                    style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#fff', border: `2px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6'}` }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = isDark ? 'rgba(99,102,241,0.4)' : '#a5b4fc'; e.currentTarget.style.background = isDark ? 'rgba(99,102,241,0.06)' : 'rgba(99,102,241,0.03)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6'; e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : '#fff'; }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)' }}>
                      <Palette size={20} style={{ color: '#6366f1' }} />
                    </div>
                    <div>
                      <div className="font-semibold text-sm" style={{ color: tokens.colors.text.primary }}>外观设置</div>
                      <div className="text-xs" style={{ color: tokens.colors.text.muted }}>主题、背景、玻璃效果、动效</div>
                    </div>
                  </button>
                  {user.role === 'admin' && (
                    <>
                      <button
                        onClick={() => setSettingsModalInitTab('analytics')}
                        className="flex items-center gap-4 p-4 rounded-xl transition text-left group"
                        style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#fff', border: `2px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6'}` }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = isDark ? 'rgba(34,197,94,0.4)' : '#86efac'; e.currentTarget.style.background = isDark ? 'rgba(34,197,94,0.06)' : 'rgba(34,197,94,0.03)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6'; e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : '#fff'; }}
                      >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)' }}>
                          <BarChart3 size={20} style={{ color: '#22c55e' }} />
                        </div>
                        <div>
                          <div className="font-semibold text-sm" style={{ color: tokens.colors.text.primary }}>数据统计</div>
                          <div className="text-xs" style={{ color: tokens.colors.text.muted }}>学生、学校、老师数据概览</div>
                        </div>
                      </button>
                      <button
                        onClick={() => setSettingsModalInitTab('logs')}
                        className="flex items-center gap-4 p-4 rounded-xl transition text-left group"
                        style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#fff', border: `2px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6'}` }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = isDark ? 'rgba(168,85,247,0.4)' : '#c4b5fd'; e.currentTarget.style.background = isDark ? 'rgba(168,85,247,0.06)' : 'rgba(168,85,247,0.03)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6'; e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : '#fff'; }}
                      >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: isDark ? 'rgba(168,85,247,0.15)' : 'rgba(168,85,247,0.1)' }}>
                          <FileText size={20} style={{ color: '#a855f7' }} />
                        </div>
                        <div>
                          <div className="font-semibold text-sm" style={{ color: tokens.colors.text.primary }}>系统日志</div>
                          <div className="text-xs" style={{ color: tokens.colors.text.muted }}>查看操作日志和系统事件</div>
                        </div>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-0">
                <SettingsPage
                  user={user}
                  allUsers={allUsers}
                  setAllUsers={setAllUsers}
                  onLogout={onLogout}
                  initTab={settingsModalInitTab}
                  onInitTabConsumed={() => {}}
                  studentList={studentList}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* 版本日志弹窗 */}
      {showChangelogPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" style={{ backgroundColor: `rgba(0,0,0,${isDark ? '0.6' : '0.4'})`, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }} onClick={() => setShowChangelogPanel(false)}>
          <div className="rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto animate-scale-in" style={{
            background: glassEnabled ? tokens.colors.surface.glass : (isDark ? tokens.colors.surface.solid : '#fff'),
            backdropFilter: glassEnabled ? `blur(${tokens.blur.backdropBlur}px)` : 'none',
            WebkitBackdropFilter: glassEnabled ? `blur(${tokens.blur.backdropBlur}px)` : 'none',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`,
            boxShadow: glassEnabled ? tokens.shadow.elevation : '0 20px 60px rgba(0,0,0,0.3)',
          }} onClick={e => e.stopPropagation()}>
            <div className="p-5" style={{ borderBottom: `1px solid ${tokens.colors.border.hairline}` }}>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg flex items-center gap-2" style={{ color: tokens.colors.text.primary }}><FileText size={20} /> 版本更新日志</h3>
                <button onClick={() => setShowChangelogPanel(false)} className="p-1 rounded-lg transition" style={{ color: tokens.colors.text.muted }}
                  onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}><X size={18} /></button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              {[
                { version: 'v2.0.0', date: '2026-02-28', changes: [
                  '🆕 学部入试流程适配：申请状态从「已联系」改为「已出愿」，符合学部升学流程',
                  '🆕 事件类型移除「联系」类型，新增「面试」类型；事件分类移除「研究室联系」，新增「校内考」「面试」',
                  '🆕 管理员可查看用户反馈记录（左下角菜单→查看反馈），支持清空操作',
                  '✏️ 默认数据中研究科全部改为学部名称（如工学研究科→工学部）',
                  '✏️ 研究计划书材料改为志望理由书，京都大学教授联系事件改为校内考准备',
                  '✏️ 学校信息库8所学校的programs字段全部改为学部名称',
                  '🐛 修复CalendarView重复interview键的问题',
                ]},
                { version: 'v1.9.0', date: '2026-02-28', changes: [
                  '🆕 老师部门划分：所属部门改为下拉选择（学部升学组/学管/教务/其他）',
                  '🆕 学生信息页面新增文理科字段的展示和编辑',
                  '✏️ 升学老师选择器仅显示学部升学组老师，学管老师选择器仅显示学管老师',
                  '✏️ 默认老师数据预设部门信息（teacher_1~5为学部升学组，teacher_6~7为学管）',
                  '🐛 修复反馈发送逻辑（mailto链接触发方式优化 + localStorage备份记录 + toast通知）',
                ]},
                { version: 'v1.8.0', date: '2026-02-28', changes: [
                  '🆕 近期可报学校改为弹窗展示（避免缩放问题）',
                  '🆕 学校信息库/志愿学校新增【所需材料】字段',
                  '✏️ 出愿时间判断仅基于出愿开始时间（不参考考试/截止时间）',
                  '✏️ 志愿学校删除【学校名称(日文)】字段',
                  '🐛 修复弹出菜单溢出裁切导致版本日志/反馈建议不可见',
                ]},
                { version: 'v1.7.0', date: '2026-02-28', changes: [
                  '🆕 版本日志和反馈建议移至左下角快捷菜单',
                  '🆕 学校信息库新增「学信网认证」和「海外认证」字段',
                  '🐛 修复 localStorage 缓存导致新学管老师/菜单分组不显示的问题',
                  '✏️ 出愿时间（文字描述）字段替换为认证需求字段',
                ]},
                { version: 'v1.6.0', date: '2026-02-28', changes: [
                  '🆕 设置页新增「版本更新日志」和「反馈与建议」tab',
                  '🆕 新增学管老师专职账号（高老师、林老师）',
                  '✏️ 升学老师改为可编辑（学生信息页）',
                  '✏️ 左侧菜单栏按功能分组展示',
                  '🐛 近期可报学校：学生页面隐藏"已申请该校的学生"',
                  '🐛 修复卡片展开冲突',
                  '💅 学校详情弹窗改为玻璃拟态风格',
                ]},
                { version: 'v1.5.0', date: '2026-02-28', changes: [
                  '🆕 近期可报学校页面（按月份展示可报考学校）',
                  '✏️ 取消学生自注册，改为管理员后台创建',
                  '🐛 数据库实时同步修复（统一AppContext数据源）',
                  '✏️ 操作反馈提示完善（toast通知）',
                ]},
                { version: 'v1.4.0', date: '2026-02-28', changes: [
                  '💅 全站弹窗/表单glass风格改造',
                  '💅 深度暗色适配',
                  '✏️ 邮箱认证流程完善',
                  '📊 全新测试数据集（12学生+9账号）',
                ]},
                { version: 'v1.3.0', date: '2026-02-28', changes: [
                  '💅 全站UI统一改造（玻璃拟态风格）',
                  '🌓 全站暗色模式适配',
                  '🎨 语义化颜色主题系统重构',
                ]},
                { version: 'v1.0.0', date: '2026-01-31', changes: [
                  '🎉 基础登录系统（学生/老师/管理员）',
                  '📅 时间线管理功能（CRUD）',
                  '🏫 学校申请跟踪',
                  '📋 材料清单管理',
                ]},
              ].map((release, idx) => (
                <div key={idx} className="rounded-xl p-4" style={{
                  background: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6'}`,
                }}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-sm font-bold px-2.5 py-1 rounded-lg" style={{
                      background: idx === 0 ? (isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)') : (isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)'),
                      color: idx === 0 ? '#22c55e' : tokens.colors.accent.primary,
                    }}>{release.version} {idx === 0 && '🆕 最新'}</span>
                    <span className="text-xs" style={{ color: tokens.colors.text.muted }}>{release.date}</span>
                  </div>
                  <ul className="space-y-1.5">
                    {release.changes.map((c, ci) => (
                      <li key={ci} className="text-sm flex items-start gap-2" style={{ color: tokens.colors.text.secondary }}>
                        <span className="mt-0.5 text-xs">•</span><span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 反馈建议弹窗 */}
      {showFeedbackPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" style={{ backgroundColor: `rgba(0,0,0,${isDark ? '0.6' : '0.4'})`, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }} onClick={() => setShowFeedbackPanel(false)}>
          <div className="rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto animate-scale-in" style={{
            background: glassEnabled ? tokens.colors.surface.glass : (isDark ? tokens.colors.surface.solid : '#fff'),
            backdropFilter: glassEnabled ? `blur(${tokens.blur.backdropBlur}px)` : 'none',
            WebkitBackdropFilter: glassEnabled ? `blur(${tokens.blur.backdropBlur}px)` : 'none',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`,
            boxShadow: glassEnabled ? tokens.shadow.elevation : '0 20px 60px rgba(0,0,0,0.3)',
          }} onClick={e => e.stopPropagation()}>
            <div className="p-5" style={{ borderBottom: `1px solid ${tokens.colors.border.hairline}` }}>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg flex items-center gap-2" style={{ color: tokens.colors.text.primary }}><Mail size={20} /> 反馈与建议</h3>
                <button onClick={() => setShowFeedbackPanel(false)} className="p-1 rounded-lg transition" style={{ color: tokens.colors.text.muted }}
                  onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}><X size={18} /></button>
              </div>
              <p className="text-sm mt-1" style={{ color: tokens.colors.text.muted }}>您的反馈是我们改进产品的重要动力</p>
            </div>
            <div className="p-5 space-y-5">
              {/* 反馈类型 */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: tokens.colors.text.secondary }}>反馈类型</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'suggestion', label: '💡 功能建议', color: '#3b82f6' },
                    { id: 'bug', label: '🐛 错误报告', color: '#ef4444' },
                    { id: 'other', label: '💬 其他', color: '#a855f7' },
                  ].map(type => (
                    <button key={type.id} onClick={() => setFeedbackType(type.id)}
                      className="px-4 py-2 rounded-lg text-sm font-medium transition"
                      style={{
                        background: feedbackType === type.id ? (isDark ? `${type.color}22` : `${type.color}15`) : (isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb'),
                        color: feedbackType === type.id ? type.color : tokens.colors.text.muted,
                        border: `1px solid ${feedbackType === type.id ? `${type.color}44` : (isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb')}`,
                      }}>{type.label}</button>
                  ))}
                </div>
              </div>
              {/* 反馈内容 */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: tokens.colors.text.secondary }}>反馈内容 <span style={{ color: '#ef4444' }}>*</span></label>
                <textarea value={feedbackContent} onChange={e => setFeedbackContent(e.target.value)} rows={5}
                  placeholder="请详细描述您的建议或遇到的问题..."
                  className="w-full px-4 py-3 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 text-sm"
                  style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', color: tokens.colors.text.primary, borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb' }} />
              </div>
              {/* 联系方式 */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: tokens.colors.text.secondary }}>联系方式 <span className="text-xs font-normal" style={{ color: tokens.colors.text.muted }}>（可选）</span></label>
                <input type="text" value={feedbackContact} onChange={e => setFeedbackContact(e.target.value)}
                  placeholder="邮箱、微信号或其他联系方式"
                  className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', color: tokens.colors.text.primary, borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb' }} />
              </div>
              {/* 提交 */}
              <button
                onClick={async () => {
                  if (!feedbackContent.trim()) return;
                  const typeLabels = { suggestion: '功能建议', bug: '错误报告', other: '其他' };
                  // 调用后端 API 入库，失败时明确提示未入库
                  try {
                    await feedbackAPI.submit({
                      type: feedbackType,
                      content: feedbackContent.trim(),
                      contact: feedbackContact.trim() || undefined,
                    });
                    // 入库成功，同步记录到 localStorage（标记已入库）
                    try {
                      const feedbackHistory = JSON.parse(localStorage.getItem('feedbackHistory') || '[]');
                      feedbackHistory.unshift({
                        type: feedbackType,
                        content: feedbackContent,
                        contact: feedbackContact,
                        time: new Date().toISOString(),
                        user: user?.name || '匿名',
                        synced: true,
                      });
                      localStorage.setItem('feedbackHistory', JSON.stringify(feedbackHistory.slice(0, 50)));
                    } catch (e) { /* ignore */ }
                    showNotification('反馈已提交，感谢您的反馈！🙏');
                    setFeedbackContent(''); setFeedbackContact(''); setFeedbackType('suggestion'); setShowFeedbackPanel(false);
                  } catch (e) {
                    console.error('反馈提交失败:', e);
                    showNotification('反馈提交失败，请检查网络后重试');
                  }
                }}
                disabled={!feedbackContent.trim()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)', color: '#3b82f6' }}
              ><Mail size={18} /> 提交反馈</button>
            </div>
          </div>
        </div>
      )}

      {/* 管理员查看反馈历史弹窗 */}
      {showFeedbackHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" style={{ backgroundColor: `rgba(0,0,0,${isDark ? '0.6' : '0.4'})`, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }} onClick={() => setShowFeedbackHistory(false)}>
          <div className="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden" style={{ background: tokens.colors.surface.solid, border: `1px solid ${tokens.colors.border.subtle}` }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5" style={{ borderBottom: `1px solid ${tokens.colors.border.subtle}` }}>
              <h3 className="text-lg font-bold" style={{ color: tokens.colors.text.primary }}>📬 用户反馈记录</h3>
              <button onClick={() => setShowFeedbackHistory(false)} className="p-1 rounded-lg transition" style={{ color: tokens.colors.text.muted }}
                onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-3" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
              {(() => {
                let history = [];
                try { history = JSON.parse(localStorage.getItem('feedbackHistory') || '[]'); } catch {}
                if (history.length === 0) {
                  return <div className="text-center py-10" style={{ color: tokens.colors.text.muted }}>暂无反馈记录</div>;
                }
                return history.map((fb, idx) => {
                  const typeLabels = { suggestion: '💡 功能建议', bug: '🐛 错误报告', other: '📝 其他' };
                  const typeColors = { suggestion: '#3b82f6', bug: '#ef4444', other: '#8b5cf6' };
                  return (
                    <div key={idx} className="rounded-xl p-4" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', border: `1px solid ${tokens.colors.border.subtle}` }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: isDark ? `rgba(${typeColors[fb.type] === '#3b82f6' ? '59,130,246' : typeColors[fb.type] === '#ef4444' ? '239,68,68' : '139,92,246'},0.15)` : `rgba(${typeColors[fb.type] === '#3b82f6' ? '59,130,246' : typeColors[fb.type] === '#ef4444' ? '239,68,68' : '139,92,246'},0.1)`, color: typeColors[fb.type] || '#8b5cf6' }}>
                          {typeLabels[fb.type] || '📝 其他'}
                        </span>
                        <span className="text-xs" style={{ color: tokens.colors.text.muted }}>
                          {fb.time ? new Date(fb.time).toLocaleString('zh-CN') : ''}
                        </span>
                      </div>
                      <p className="text-sm mb-2" style={{ color: tokens.colors.text.primary, whiteSpace: 'pre-wrap' }}>{fb.content}</p>
                      <div className="flex items-center gap-3 text-xs" style={{ color: tokens.colors.text.muted }}>
                        <span>👤 {fb.user || '匿名'}</span>
                        {fb.contact && <span>📧 {fb.contact}</span>}
                      </div>
                    </div>
                  );
                });
              })()}
              {(() => {
                let history = [];
                try { history = JSON.parse(localStorage.getItem('feedbackHistory') || '[]'); } catch {}
                if (history.length > 0) {
                  return (
                    <div className="flex justify-end pt-2">
                      <button onClick={() => {
                        if (window.confirm('确定清空所有反馈记录？')) {
                          localStorage.removeItem('feedbackHistory');
                          setShowFeedbackHistory(false);
                          setTimeout(() => setShowFeedbackHistory(true), 50);
                          showNotification('反馈记录已清空');
                        }
                      }} className="text-xs px-3 py-1.5 rounded-lg transition" style={{ background: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
                        清空记录
                      </button>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        </div>
      )}

      {/* 全局通知组件 */}
      <Notification />
    </div>
  );
};

// 根组件
const JapanStudyApp = () => {
  return (
    <ErrorBoundary>
      <ThemeProvider>
      <AppProvider>
        <JapanStudyAppInner />
      </AppProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

// 内部组件 - 使用 AppContext 统一数据源
const JapanStudyAppInner = () => {
  const { user, handleLogin, handleLogout, allUsers, setAllUsers, studentList, setStudentList } = useApp();

  // 检查是否有已登录用户（AppContext中已处理）

  if (user) {
    return <MainApp user={user} onLogout={handleLogout} allUsers={allUsers} setAllUsers={setAllUsers} studentList={studentList} setStudentList={setStudentList} />;
  }
  return <AuthPage onLogin={handleLogin} />;
};

export default JapanStudyApp;
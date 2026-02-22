import React, { useState, useEffect } from 'react';
import {
  Calendar, Clock, School, FileText, CheckSquare, Plus,
  ChevronRight, AlertCircle, Edit, Users, LogOut, Save,
  X, User, Bell, Search, Filter, Download, Upload,
  Menu, ChevronDown, Eye, Trash2, Check, Edit2, UserCheck,
  GraduationCap, Mail, Lock, ArrowRight, Link2, ExternalLink,
  BookOpen, Home, Settings, HelpCircle, ChevronLeft, Shield, UserPlus,
  LayoutGrid, LayoutList, UserCircle
} from 'lucide-react';
import { schoolsAPI, eventsAPI, materialsAPI } from './services/api';
import { AppProvider, useApp } from './context/AppContext';
import ErrorBoundary from './components/common/ErrorBoundary';
import Notification from './components/common/Notification';
import StudentProfile from './components/StudentProfile';
import TimelineLinear from './components/TimelineLinear';
import TeacherManagement from './components/TeacherManagement';
import SchoolDatabase from './components/SchoolDatabase';
import SettingsPage from './components/SettingsPage';
import CalendarView from './components/CalendarView';
import UpcomingSchools from './components/UpcomingSchools';
import { exportStudentToCSV, exportEventsToICS, exportChecklistToPDF } from './utils/exportUtils';

// ErrorBoundary 已拆分到 src/components/common/ErrorBoundary.jsx

// 登录注册页面组件
const AuthPage = ({ onLogin, allUsers, studentList }) => {
  // 用户账号数据库
  const [users] = useState([
    // 管理员账号
    {
      id: 'admin1',
      email: 'admin@jsa.com',
      password: 'admin123',
      role: 'admin',
      name: '系统管理员'
    },
    // 老师账号
    {
      id: 'teacher1',
      email: 'wang@school.com',
      password: 'wang123',
      role: 'teacher',
      teacherId: 'teacher_1',
      name: '王老师'
    },
    {
      id: 'teacher2',
      email: 'li@school.com',
      password: 'li123',
      role: 'teacher',
      teacherId: 'teacher_2',
      name: '李老师'
    },
    // 学生账号（已注册的）
    {
      id: 'student1',
      email: 'zhangsan@example.com',
      password: 'zhang123',
      role: 'student',
      studentId: '2024001',
      name: '张三'
    }
  ]);

  // 动态获取所有学生记录
  const getAllStudentRecords = () => {
    // 如果有传入的studentList，优先使用
    if (studentList && studentList.length > 0) {
      return studentList.map(s => ({
        studentId: s.studentId,
        name: s.name,
        hasAccount: allUsers.some(u => u.studentId === s.studentId),
        teacherId: s.teacherId
      }));
    }
    // 否则返回默认数据
    return [
      { studentId: '2024001', name: '张三', hasAccount: true, teacherId: 'teacher_1' },
      { studentId: '2024002', name: '李四', hasAccount: false, teacherId: 'teacher_1' },
      { studentId: '2024003', name: '王五', hasAccount: false, teacherId: 'teacher_2' },
    ];
  };
  const [isLogin, setIsLogin] = useState(true);
  const [userType, setUserType] = useState('student'); // 'student', 'teacher', 'admin'
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    studentId: '',
    verificationCode: ''
  });
  const [showVerification, setShowVerification] = useState(false);
  const [errors, setErrors] = useState({});

  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSendVerificationCode = () => {
    if (!validateEmail(formData.email)) {
      setErrors({ email: '请输入有效的邮箱地址' });
      return;
    }
    setShowVerification(true);
    // 模拟发送验证码
    alert('验证码已发送到您的邮箱（演示：验证码为 123456）');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!formData.email) newErrors.email = '请输入邮箱';
    else if (!validateEmail(formData.email)) newErrors.email = '邮箱格式不正确';

    if (!formData.password) newErrors.password = '请输入密码';
    else if (formData.password.length < 6) newErrors.password = '密码至少6位';

    if (!isLogin) {
      // 注册逻辑
      if (!formData.name) newErrors.name = '请输入姓名';
      if (userType === 'student') {
        if (!formData.studentId) {
          newErrors.studentId = '请输入学号';
        } else {
          // 验证学号是否存在且未注册
          const studentRecord = getAllStudentRecords().find(s => s.studentId === formData.studentId);
          if (!studentRecord) {
            newErrors.studentId = '学号不存在，请联系管理员';
          } else if (studentRecord.hasAccount) {
            newErrors.studentId = '该学号已被注册';
          }
        }
      }
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = '两次密码输入不一致';
      }
      if (!formData.verificationCode) {
        newErrors.verificationCode = '请输入验证码';
      } else if (formData.verificationCode !== '123456') {
        newErrors.verificationCode = '验证码错误';
      }

      if (Object.keys(newErrors).length === 0) {
        // 注册成功，创建新用户
        const studentRecord = userType === 'student' ?
          getAllStudentRecords().find(s => s.studentId === formData.studentId) : null;

        const userData = {
          role: userType,
          name: formData.name,
          email: formData.email,
          studentId: userType === 'student' ? formData.studentId : null,
          teacherId: userType === 'teacher' ? `teacher_${Date.now()}` :
                     userType === 'student' && studentRecord ? studentRecord.teacherId : null,
          isAdmin: userType === 'admin'
        };
        onLogin(userData);
        return;
      }
    } else {
      // 登录逻辑 - 验证密码
      if (Object.keys(newErrors).length === 0) {
        const user = allUsers.find(u =>
          u.email === formData.email &&
          u.password === formData.password &&
          u.role === userType
        );

        if (user) {
          const userData = {
            role: user.role,
            name: user.name,
            email: user.email,
            studentId: user.studentId || null,
            teacherId: user.teacherId || null,
            isAdmin: user.role === 'admin'
          };
          onLogin(userData);
          return;
        } else {
          newErrors.password = '邮箱或密码错误';
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-5xl w-full grid lg:grid-cols-2 bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* 左侧装饰面板 */}
        <div className="hidden lg:flex flex-col justify-center items-center p-12 bg-gradient-to-br from-blue-500 to-purple-600 text-white">
          <div className="mb-8">
            <div className="w-32 h-32 bg-white bg-opacity-20 rounded-full flex items-center justify-center mb-6">
              <GraduationCap size={64} className="text-white" />
            </div>
            <h1 className="text-4xl font-bold mb-4">日本留学考学助手</h1>
            <p className="text-blue-100 text-center">
              专业的日本留学申请管理平台<br/>
              让留学之路更加清晰高效
            </p>
          </div>

          <div className="space-y-4 w-full max-w-sm">
            <div className="flex items-center gap-3 bg-white bg-opacity-20 rounded-lg p-3">
              <Calendar className="text-white" size={24} />
              <span>智能时间线管理</span>
            </div>
            <div className="flex items-center gap-3 bg-white bg-opacity-20 rounded-lg p-3">
              <School className="text-white" size={24} />
              <span>多校申请追踪</span>
            </div>
            <div className="flex items-center gap-3 bg-white bg-opacity-20 rounded-lg p-3">
              <FileText className="text-white" size={24} />
              <span>材料清单管理</span>
            </div>
          </div>
        </div>

        {/* 右侧登录/注册表单 */}
        <div className="p-8 lg:p-12">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">
              {isLogin ? '欢迎回来' : '学生注册'}
            </h2>
            <p className="text-gray-600">
              {isLogin ? '登录您的账号继续管理留学申请' : '学生使用学号注册账号'}
            </p>
          </div>

          {/* 角色选择 - 只在登录页显示 */}
          {isLogin && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">我是</label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setUserType('student')}
                  className={`p-3 rounded-lg border-2 transition flex items-center justify-center gap-2
                    ${userType === 'student' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 hover:border-gray-400'}`}
                >
                  <User size={20} />
                  <span className="font-medium">学生</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUserType('teacher')}
                  className={`p-3 rounded-lg border-2 transition flex items-center justify-center gap-2
                    ${userType === 'teacher' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-300 hover:border-gray-400'}`}
                >
                  <GraduationCap size={20} />
                  <span className="font-medium">老师</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUserType('admin')}
                  className={`p-3 rounded-lg border-2 transition flex items-center justify-center gap-2
                    ${userType === 'admin' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-300 hover:border-gray-400'}`}
                >
                  <Shield size={20} />
                  <span className="font-medium">管理员</span>
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                {/* 注册提示信息 */}
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>提示：</strong>只有学生可以自主注册账号。老师和管理员账号需由系统管理员创建。
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent
                      ${errors.name ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="请输入您的姓名"
                  />
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                </div>

                {userType === 'student' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">学号</label>
                    <input
                      type="text"
                      value={formData.studentId}
                      onChange={(e) => setFormData({...formData, studentId: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent
                        ${errors.studentId ? 'border-red-500' : 'border-gray-300'}`}
                      placeholder="请输入学号"
                    />
                    {errors.studentId && <p className="text-red-500 text-xs mt-1">{errors.studentId}</p>}
                  </div>
                )}
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="your@email.com"
                />
              </div>
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>

            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">邮箱验证码</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.verificationCode}
                    onChange={(e) => setFormData({...formData, verificationCode: e.target.value})}
                    className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent
                      ${errors.verificationCode ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="请输入验证码"
                    disabled={!showVerification}
                  />
                  <button
                    type="button"
                    onClick={handleSendVerificationCode}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                  >
                    {showVerification ? '重新发送' : '获取验证码'}
                  </button>
                </div>
                {errors.verificationCode && <p className="text-red-500 text-xs mt-1">{errors.verificationCode}</p>}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    ${errors.password ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="••••••••"
                />
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
            </div>

            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">确认密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent
                      ${errors.confirmPassword ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="••••••••"
                  />
                </div>
                {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
              </div>
            )}

            <button
              type="submit"
              className={`w-full py-3 rounded-lg font-semibold text-white transition flex items-center justify-center gap-2
                ${userType === 'student' ? 'bg-blue-500 hover:bg-blue-600' :
                  userType === 'teacher' ? 'bg-purple-500 hover:bg-purple-600' :
                  'bg-red-500 hover:bg-red-600'}`}
            >
              {isLogin ? '登录' : '注册'}
              <ArrowRight size={20} />
            </button>
          </form>

          <div className="mt-6 text-center">
            {/* 只有学生可以注册 */}
            {isLogin && userType === 'student' && (
              <p className="text-gray-600">
                还没有账号？
                <button
                  onClick={() => {
                    setIsLogin(false);
                    setErrors({});
                  }}
                  className="ml-2 text-blue-500 hover:text-blue-600 font-medium"
                >
                  立即注册
                </button>
              </p>
            )}
            {!isLogin && (
              <p className="text-gray-600">
                已有账号？
                <button
                  onClick={() => {
                    setIsLogin(true);
                    setErrors({});
                  }}
                  className="ml-2 text-blue-500 hover:text-blue-600 font-medium"
                >
                  立即登录
                </button>
              </p>
            )}
          </div>

          {/* 测试账号提示 */}
          {isLogin && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg text-xs text-gray-600">
              <p className="font-semibold mb-2">测试账号：</p>
              {userType === 'admin' && <p>邮箱: admin@jsa.com 密码: admin123</p>}
              {userType === 'teacher' && (
                <>
                  <p>王老师: wang@school.com / wang123</p>
                  <p>李老师: li@school.com / li123</p>
                </>
              )}
              {userType === 'student' && (
                <>
                  <p>张三: zhangsan@example.com / zhang123</p>
                  <p className="mt-1 text-gray-500">未注册学号: 2024002（李四）</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

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

  const [activeTab, setActiveTab] = useState('timeline');
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

  // 学生数据存储（按学生ID隔离）
  const [studentData, setStudentData] = useState(() => {
    const saved = localStorage.getItem('studentData');
    return saved ? JSON.parse(saved) : {};
  });

  // 获取当前学生的数据
  const getStudentDataKey = () => {
    return currentStudent?.studentId || 'default';
  };

  // 获取或初始化学生数据
  const getOrInitStudentData = () => {
    const key = getStudentDataKey();
    if (!studentData || !studentData[key]) {
      return {
        events: [
          { id: 1, type: 'exam', title: 'JLPT N1考试', date: '2025-12-07', daysLeft: 59, category: '日语考试', urgent: false, notes: '需要达到130分以上', completed: false, schoolId: null },
          { id: 2, type: 'deadline', title: '东京大学出愿截止', date: '2025-11-15', daysLeft: 37, category: '出愿', urgent: true, notes: '记得提前准备材料', completed: false, schoolId: 1 },
          { id: 3, type: 'exam', title: 'EJU考试(理科)', date: '2025-11-09', daysLeft: 31, category: '留考', urgent: true, notes: '目标分数700+', completed: false, schoolId: null },
          { id: 4, type: 'contact', title: '京都大学教授邮件跟进', date: '2025-10-15', daysLeft: 6, category: '研究室联系', urgent: false, notes: '询问研究室招生情况', completed: false, schoolId: 2 },
        ],
        schools: [
          {
            id: 1,
            name: '东京大学',
            type: '国立',
            program: '工学研究科',
            status: 'preparing',
            applicationStartDate: '2025-10-01',
            applicationEndDate: '2025-11-15',
            examDate: '2025-12-20',
            resultDate: '2026-01-30',
            requirementsUrl: 'https://www.u-tokyo.ac.jp/ja/admissions/graduate.html',
            teacherNotes: '重点院校，需要JLPT N1和EJU高分',
            materials: [
              { name: '研究计划书', deadline: '2025-11-10', url: 'https://example.com/template1.pdf' },
              { name: '推荐信', deadline: '2025-11-05', url: '' }
            ]
          },
          {
            id: 2,
            name: '京都大学',
            type: '国立',
            program: '情报学研究科',
            status: 'contacted',
            applicationStartDate: '2025-10-15',
            applicationEndDate: '2025-11-20',
            examDate: '2026-01-10',
            resultDate: '2026-02-15',
            requirementsUrl: 'https://www.kyoto-u.ac.jp/ja/admissions/',
            teacherNotes: '已联系田中教授，等待回复',
            materials: [
              { name: '志望理由书', deadline: '2025-11-15', url: '' }
            ]
          },
          {
            id: 3,
            name: '早稻田大学',
            type: '私立',
            program: '基干理工学研究科',
            status: 'preparing',
            applicationStartDate: '2025-09-20',
            applicationEndDate: '2025-10-31',
            examDate: '2025-11-25',
            resultDate: '2025-12-20',
            requirementsUrl: 'https://www.waseda.jp/inst/admission/',
            teacherNotes: '保底院校，英语成绩要求较低',
            materials: []
          },
        ],
        checklist: {
          general: [
            { id: 1, item: '毕业证书(日文翻译+公证)', completed: true, deadline: '2025-09-30', checkedBy: 'teacher', checkedAt: '2025-09-15', url: '' },
            { id: 2, item: '成绩单(日文翻译+公证)', completed: false, deadline: '2025-09-30', checkedBy: null, checkedAt: null, url: '' },
            { id: 3, item: '护照复印件', completed: false, deadline: '2025-08-31', checkedBy: null, checkedAt: null, url: '' },
            { id: 4, item: 'JLPT成绩单', completed: false, deadline: '2025-10-15', checkedBy: null, checkedAt: null, url: '' },
            { id: 5, item: '银行存款证明', completed: false, deadline: '2025-10-31', checkedBy: null, checkedAt: null, url: '' },
          ],
          schoolSpecific: {
            '东京大学': [
              { id: 101, item: '研究计划书', completed: false, deadline: '2025-11-10', checkedBy: null, checkedAt: null, url: 'https://example.com/template1.pdf' },
              { id: 102, item: '推荐信', completed: false, deadline: '2025-11-05', checkedBy: null, checkedAt: null, url: '' },
            ],
            '京都大学': [
              { id: 201, item: '志望理由书', completed: false, deadline: '2025-11-15', checkedBy: null, checkedAt: null, url: '' },
            ]
          }
        }
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

  // 设置事件更新函数
  const setUpcomingEvents = (newEvents) => {
    const key = getStudentDataKey();

    setStudentData(prev => {
      // 使用 prev 中的最新数据，而不是可能过时的 currentStudentData
      const currentData = prev[key] || getOrInitStudentData();
      const resolvedEvents = typeof newEvents === 'function' ? newEvents(currentData.events || upcomingEvents) : newEvents;
      const updated = {
        ...prev,
        [key]: {
          ...currentData,
          events: resolvedEvents
        }
      };
      localStorage.setItem('studentData', JSON.stringify(updated));
      return updated;
    });
  };

  // 设置学校更新函数
  const setSchools = (newSchools) => {
    const key = getStudentDataKey();

    setStudentData(prev => {
      // 使用 prev 中的最新数据
      const currentData = prev[key] || getOrInitStudentData();
      const currentSchools = currentData.schools || schools;
      const resolvedSchools = typeof newSchools === 'function' ? newSchools(currentSchools) : newSchools;
      const updated = {
        ...prev,
        [key]: {
          ...currentData,
          schools: resolvedSchools
        }
      };
      localStorage.setItem('studentData', JSON.stringify(updated));
      return updated;
    });
  };

  // 设置清单更新函数
  const setChecklist = (newChecklist) => {
    const key = getStudentDataKey();

    setStudentData(prev => {
      // 使用 prev 中的最新数据，而不是可能过时的 currentStudentData
      const currentData = prev[key] || getOrInitStudentData();
      const resolvedChecklist = typeof newChecklist === 'function' ? newChecklist(currentData.checklist || checklist) : newChecklist;
      const updated = {
        ...prev,
        [key]: {
          ...currentData,
          checklist: resolvedChecklist
        }
      };
      localStorage.setItem('studentData', JSON.stringify(updated));
      return updated;
    });
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


  // 老师列表 (动态从allUsers中获取)
  const getTeacherList = () => {
    return allUsers
      .filter(u => u.role === 'teacher')
      .map(u => ({
        id: u.teacherId,
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
      return allStudents.filter(s => s.teacherId === user.teacherId); // 老师只看到自己的学生
    }
    return []; // 学生不需要看到学生列表
  };

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
      preparing: 'bg-blue-100 text-blue-700 border-blue-200',
      contacted: 'bg-green-100 text-green-700 border-green-200',
      submitted: 'bg-purple-100 text-purple-700 border-purple-200',
      admitted: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const getStatusText = (status) => {
    const texts = {
      preparing: '准备中',
      contacted: '已联系',
      submitted: '已提交',
      admitted: '已合格',
    };
    return texts[status] || '未开始';
  };

  const getTypeColor = (type) => {
    const colors = {
      exam: 'bg-red-50 border-red-200',
      deadline: 'bg-orange-50 border-orange-200',
      contact: 'bg-blue-50 border-blue-200',
      document: 'bg-green-50 border-green-200',
    };
    return colors[type] || 'bg-gray-50 border-gray-200';
  };

  const getTypeIcon = (type) => {
    const icons = {
      exam: '📝',
      deadline: '⏰',
      contact: '✉️',
      document: '📄',
    };
    return icons[type] || '📌';
  };

  // 删除事件
  const handleDeleteEvent = (eventId) => {
    if (window.confirm('确定要删除这个事项吗？')) {
      setUpcomingEvents(upcomingEvents.filter(e => e.id !== eventId));
    }
  };

  // 删除学校
  const handleDeleteSchool = (schoolId) => {
    if (window.confirm('确定要删除这个学校吗？这将同时删除相关的时间线事件和材料清单。')) {
      // 找到要删除的学校
      const schoolToDelete = schools.find(s => s.id === schoolId);

      if (schoolToDelete) {
        // 删除学校
        setSchools(schools.filter(s => s.id !== schoolId));

        // 删除相关的时间线事件（学校关联的事件）
        setUpcomingEvents(upcomingEvents.filter(e => e.schoolId !== schoolId));

        // 删除学校专用材料清单
        const newChecklist = {...checklist};
        if (newChecklist.schoolSpecific && newChecklist.schoolSpecific[schoolToDelete.name]) {
          delete newChecklist.schoolSpecific[schoolToDelete.name];
          setChecklist(newChecklist);
        }
      }
    }
  };

  // 删除材料
  const handleDeleteMaterial = (type, itemId, schoolName = null) => {
    if (window.confirm('确定要删除这个材料项吗？')) {
      const newChecklist = {...checklist};
      if (type === 'general') {
        newChecklist.general = checklist.general.filter(item => item.id !== itemId);
      } else if (schoolName) {
        newChecklist.schoolSpecific[schoolName] = newChecklist.schoolSpecific[schoolName].filter(
          item => item.id !== itemId
        );
      }
      setChecklist(newChecklist);
    }
  };

  // 处理材料勾选
  const handleMaterialCheck = (type, itemId, checked, schoolName = null) => {
    const newChecklist = {...checklist};
    const currentTime = new Date().toISOString().split('T')[0];

    if (type === 'general') {
      newChecklist.general = checklist.general.map(item =>
        item.id === itemId
          ? {...item, completed: checked, checkedBy: user.role, checkedAt: checked ? currentTime : null}
          : item
      );
    } else if (schoolName) {
      newChecklist.schoolSpecific[schoolName] = newChecklist.schoolSpecific[schoolName].map(item =>
        item.id === itemId
          ? {...item, completed: checked, checkedBy: user.role, checkedAt: checked ? currentTime : null}
          : item
      );
    }

    setChecklist(newChecklist);
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

    const handleSubmit = (e) => {
      e.preventDefault();
      const eventData = {
        ...formData,
        daysLeft: calculateDaysLeft(formData.date),
        schoolId: null
      };

      if (editingEvent) {
        setUpcomingEvents(upcomingEvents.map(event =>
          event.id === editingEvent.id ? { ...eventData, id: editingEvent.id, schoolId: event.schoolId } : event
        ));
      } else {
        setUpcomingEvents([...upcomingEvents, { ...eventData, id: Date.now() }]);
      }

      setShowEventModal(false);
      setEditingEvent(null);
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-scale-in">
          <div className="p-6 border-b flex items-center justify-between">
            <h3 className="font-bold text-xl">{editingEvent ? '编辑事项' : '添加新事项'}</h3>
            <button
              onClick={() => {
                setShowEventModal(false);
                setEditingEvent(null);
              }}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">标题</label>
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
                  <option value="contact">联系</option>
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
                  <option value="研究室联系">研究室联系</option>
                  <option value="材料准备">材料准备</option>
                  <option value="考试">考试</option>
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
                className="flex-1 bg-blue-500 text-white py-2 rounded-lg font-semibold hover:bg-blue-600"
              >
                {editingEvent ? '保存修改' : '添加事项'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEventModal(false);
                  setEditingEvent(null);
                }}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300"
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
    const [formData, setFormData] = useState(
      editingSchool || {
        name: '',
        nameJa: '',
        type: '国立',
        location: '',
        website: '',
        ranking: '',
        difficulty: '普通',
        acceptanceRate: '',
        program: '',
        status: 'preparing',
        applicationStartDate: '',
        applicationEndDate: '',
        examDate: '',
        resultDate: '',
        requirementsUrl: '',
        requirements: '',
        teacherNotes: '',
        materials: []
      }
    );

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
        website: dbSchool.website || prev.website,
        ranking: dbSchool.ranking || prev.ranking,
        difficulty: dbSchool.difficulty || prev.difficulty,
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

    const handleSubmit = (e) => {
      e.preventDefault();

      const schoolData = {
        name: formData.name,
        nameJa: formData.nameJa,
        type: formData.type,
        location: formData.location,
        website: formData.website,
        ranking: formData.ranking,
        difficulty: formData.difficulty,
        acceptanceRate: formData.acceptanceRate,
        program: formData.program,
        status: formData.status,
        applicationStartDate: formData.applicationStartDate,
        applicationEndDate: formData.applicationEndDate,
        examDate: formData.examDate,
        resultDate: formData.resultDate,
        requirementsUrl: formData.requirementsUrl,
        requirements: formData.requirements,
        teacherNotes: formData.teacherNotes,
        materials: formData.materials || []
      };

      if (editingSchool) {
        // 更新现有学校
        const updatedSchool = { ...schoolData, id: editingSchool.id };
        setSchools(schools.map(school =>
          school.id === editingSchool.id ? updatedSchool : school
        ));
        // 同步更新时间线事件
        syncSchoolDatesToTimeline(updatedSchool, false);
        // 同步更新材料清单
        if (schoolData.materials && schoolData.materials.length > 0) {
          syncSchoolMaterialsToChecklist(updatedSchool, schoolData.materials);
        }
      } else {
        // 添加新学校
        const newSchool = { ...schoolData, id: Date.now() };
        setSchools([...schools, newSchool]);
        // 同步新增时间线事件
        syncSchoolDatesToTimeline(newSchool, true);
        // 同步新增材料清单
        if (schoolData.materials && schoolData.materials.length > 0) {
          syncSchoolMaterialsToChecklist(newSchool, schoolData.materials);
        }
      }

      setShowSchoolModal(false);
      setEditingSchool(null);
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
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-scale-in">
          <div className="p-6 border-b flex items-center justify-between">
            <h3 className="font-bold text-xl">{editingSchool ? '编辑学校' : '添加新学校'}</h3>
            <button
              onClick={() => {
                setShowSchoolModal(false);
                setEditingSchool(null);
              }}
              className="p-2 hover:bg-gray-100 rounded-lg"
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
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    <div className="px-3 py-1.5 text-xs text-gray-400 border-b bg-gray-50">从学校信息库选择（点击自动补全）</div>
                    {schoolSuggestions.map(s => (
                      <button key={s.id} type="button"
                        onMouseDown={(e) => { e.preventDefault(); handleSelectDbSchool(s); }}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center justify-between text-sm border-b last:border-0">
                        <span className="font-medium">{s.name}</span>
                        <span className="text-xs text-gray-400">{s.type} {s.location || ''}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">学校名称 (日文)</label>
                <input type="text" value={formData.nameJa || ''}
                  onChange={(e) => setFormData({...formData, nameJa: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="例: 東京大学" />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
                <label className="block text-sm font-medium mb-2">难度</label>
                <select value={formData.difficulty || '普通'}
                  onChange={(e) => setFormData({...formData, difficulty: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option value="极难">极难</option><option value="难">难</option>
                  <option value="普通">普通</option><option value="容易">容易</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">排名</label>
                <input type="number" value={formData.ranking || ''}
                  onChange={(e) => setFormData({...formData, ranking: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="日本排名" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">录取率</label>
                <input type="text" value={formData.acceptanceRate || ''}
                  onChange={(e) => setFormData({...formData, acceptanceRate: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="例: 约10%" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">地点</label>
                <input type="text" value={formData.location || ''}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="例: 东京都文京区" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">官网链接</label>
                <input type="url" value={formData.website || ''}
                  onChange={(e) => setFormData({...formData, website: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="https://..." />
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
                  <option value="preparing">准备中</option>
                  <option value="contacted">已联系</option>
                  <option value="submitted">已提交</option>
                  <option value="admitted">已合格</option>
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
                <span className="text-gray-500 text-xs ml-2">（学校官方招生信息链接）</span>
              </label>
              <div className="relative">
                <Link2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
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

            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold text-sm text-gray-700">重要日期</h4>

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
                    className="flex items-center justify-between px-3 py-2 bg-blue-50 rounded-lg text-sm"
                  >
                    <span>{material.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">{material.deadline}</span>
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
                className="flex-1 bg-blue-500 text-white py-2 rounded-lg font-semibold hover:bg-blue-600"
              >
                {editingSchool ? '保存修改' : '添加学校'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSchoolModal(false);
                  setEditingSchool(null);
                }}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300"
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

    const handleSubmit = (e) => {
      e.preventDefault();
      const newChecklist = {...checklist};

      if (formData.type === 'general') {
        if (editingMaterial) {
          newChecklist.general = checklist.general.map(item =>
            item.id === editingMaterial.id
              ? { ...item, item: formData.item, deadline: formData.deadline, url: formData.url, completed: formData.completed }
              : item
          );
        } else {
          newChecklist.general.push({
            id: Date.now(),
            item: formData.item,
            deadline: formData.deadline,
            url: formData.url,
            completed: formData.completed,
            checkedBy: formData.completed ? user.role : null,
            checkedAt: formData.completed ? new Date().toISOString().split('T')[0] : null
          });
        }
      } else {
        if (!newChecklist.schoolSpecific[formData.school]) {
          newChecklist.schoolSpecific[formData.school] = [];
        }

        if (editingMaterial) {
          newChecklist.schoolSpecific[formData.school] =
            newChecklist.schoolSpecific[formData.school].map(item =>
              item.id === editingMaterial.id
                ? { ...item, item: formData.item, deadline: formData.deadline, url: formData.url, completed: formData.completed }
                : item
            );
        } else {
          newChecklist.schoolSpecific[formData.school].push({
            id: Date.now(),
            item: formData.item,
            deadline: formData.deadline,
            url: formData.url,
            completed: formData.completed,
            checkedBy: formData.completed ? user.role : null,
            checkedAt: formData.completed ? new Date().toISOString().split('T')[0] : null
          });
        }
      }

      setChecklist(newChecklist);
      setShowMaterialModal(false);
      setEditingMaterial(null);
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-white rounded-xl max-w-md w-full animate-scale-in">
          <div className="p-6 border-b flex items-center justify-between">
            <h3 className="font-bold text-xl">{editingMaterial ? '编辑材料' : '添加新材料'}</h3>
            <button
              onClick={() => {
                setShowMaterialModal(false);
                setEditingMaterial(null);
              }}
              className="p-2 hover:bg-gray-100 rounded-lg"
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
              <label className="block text-sm font-medium mb-2">
                参考链接
                <span className="text-gray-500 text-xs ml-2">（模板或参考资料）</span>
              </label>
              <div className="relative">
                <Link2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
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
                className="flex-1 bg-blue-500 text-white py-2 rounded-lg font-semibold hover:bg-blue-600"
              >
                {editingMaterial ? '保存修改' : '添加材料'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMaterialModal(false);
                  setEditingMaterial(null);
                }}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300"
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
    };

    // 学生tag列表
    const allTags = [...new Set(visibleStudents.flatMap(s => s.tags || []).filter(Boolean))];

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-white rounded-xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col animate-scale-in">
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
          <div className="p-4 border-b bg-gray-50 space-y-3">
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input type="text" placeholder="搜索学生姓名/学号..." value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
              </div>
              <div className="flex bg-gray-200 rounded-lg p-0.5">
                <button onClick={() => setStudentListView('card')}
                  className={`p-1.5 rounded-md transition ${studentListView === 'card' ? 'bg-white shadow-sm' : 'hover:bg-gray-300'}`}>
                  <LayoutGrid size={16} />
                </button>
                <button onClick={() => setStudentListView('list')}
                  className={`p-1.5 rounded-md transition ${studentListView === 'list' ? 'bg-white shadow-sm' : 'hover:bg-gray-300'}`}>
                  <LayoutList size={16} />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {['all', '文科', '理科', 'unassigned'].map(f => (
                <button key={f} onClick={() => setStudentFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                    studentFilter === f ? 'bg-purple-500 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'
                  }`}>
                  {f === 'all' ? '全部' : f === 'unassigned' ? '待分配' : f}
                </button>
              ))}
              {allTags.map(tag => (
                <span key={tag} className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-medium">
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
                    className="p-4 border-2 rounded-lg hover:border-blue-400 hover:shadow-lg cursor-pointer transition-all bg-white"
                  >
                    <div onClick={() => selectStudent(student)}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="text-3xl">{student.avatar}</div>
                          <div>
                            <div className="font-semibold text-lg">{student.name}</div>
                            <div className="text-sm text-gray-500">{student.studentId}</div>
                            {user.role === 'admin' && (
                              <div className="text-xs text-gray-400">
                                负责老师: {getTeacherList().find(t => t.id === student.teacherId)?.name || '待分配'}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {student.subject && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              student.subject === '理科' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                            }`}>{student.subject}</span>
                          )}
                          {student.urgentTasks > 0 && (
                            <span className="bg-red-100 text-red-700 text-xs px-3 py-0.5 rounded-full font-semibold">
                              {student.urgentTasks}个紧急
                            </span>
                          )}
                          {(student.tags || []).map(tag => (
                            <span key={tag} className="text-[10px] px-2 py-0.5 bg-green-50 text-green-700 rounded-full">{tag}</span>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">整体进度</span>
                          <span className="font-semibold">{student.progress}%</span>
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
                              <span className="text-xs text-gray-500 w-14 flex-shrink-0">文/理科</span>
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
                              className="w-full text-gray-500 hover:bg-gray-100 py-1 rounded text-xs">收起</button>
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
                            className="px-2 py-1.5 text-gray-500 hover:bg-gray-100 rounded-lg text-sm">
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
                    className="flex items-center gap-4 p-3 border rounded-lg hover:border-blue-400 hover:shadow-sm cursor-pointer transition-all bg-white"
                  >
                    <div className="text-2xl flex-shrink-0" onClick={() => selectStudent(student)}>{student.avatar}</div>
                    <div className="flex-1 min-w-0" onClick={() => selectStudent(student)}>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold truncate">{student.name}</span>
                        <span className="text-xs text-gray-400">{student.studentId}</span>
                        {student.subject && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            student.subject === '理科' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                          }`}>{student.subject}</span>
                        )}
                        {(student.tags || []).map(tag => (
                          <span key={tag} className="text-[10px] px-2 py-0.5 bg-green-50 text-green-700 rounded-full">{tag}</span>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                        <span>进度: {student.progress}%</span>
                        {user.role === 'admin' && <span>老师: {getTeacherList().find(t => t.id === student.teacherId)?.name || '待分配'}</span>}
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
              <div className="text-center py-12 text-gray-400">
                <Users size={48} className="mx-auto mb-4 text-gray-300" />
                <p>暂无匹配的学生</p>
              </div>
            )}
          </div>
          {/* 只有管理员可以添加学生 */}
          {user.role === 'admin' && (
            <div className="p-4 border-t bg-gray-50">
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
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-white rounded-xl max-w-md w-full animate-scale-in">
          <div className="p-6 border-b">
            <h3 className="font-bold text-xl">转移学生</h3>
            <p className="text-sm text-gray-600 mt-1">
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
          <div className="p-6 border-t flex gap-3">
            <button
              onClick={handleTransfer}
              disabled={!selectedTeacher}
              className="flex-1 bg-orange-500 text-white py-2 rounded-lg font-semibold hover:bg-orange-600 disabled:bg-gray-300"
            >
              确认转移
            </button>
            <button
              onClick={() => setShowTransferModal(false)}
              className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300"
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
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-white rounded-xl max-w-md w-full animate-scale-in">
          <div className="p-6 border-b">
            <h3 className="font-bold text-xl">添加新学生</h3>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">学号（自动生成）</label>
              <input type="text" value={newStudentId} disabled
                className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-600" />
              <p className="text-xs text-gray-500 mt-1">学生需要使用此学号进行账号注册</p>
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
            {/* 分配老师（含"待分配"选项） */}
            <div>
              <label className="block text-sm font-medium mb-2">分配给老师</label>
              <select value={newStudent.teacherId}
                onChange={(e) => setNewStudent({ ...newStudent, teacherId: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                <option value="">待分配老师</option>
                {getTeacherList().map(teacher => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name} ({teacher.email})
                  </option>
                ))}
              </select>
            </div>
            {/* 标签 */}
            <div>
              <label className="block text-sm font-medium mb-2">标签</label>
              <div className="flex flex-wrap gap-1 mb-2">
                {(newStudent.tags || []).map((tag, i) => (
                  <span key={i} className="px-2 py-1 bg-green-50 text-green-700 rounded-full text-xs flex items-center gap-1">
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
                  className="px-3 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600">
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>
          <div className="p-6 border-t flex gap-3">
            <button onClick={handleAddStudent} disabled={!newStudent.name}
              className="flex-1 bg-blue-500 text-white py-2 rounded-lg font-semibold hover:bg-blue-600 disabled:bg-gray-300">
              添加学生
            </button>
            <button onClick={() => setShowAddStudentModal(false)}
              className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300">
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
        <div className="bg-white rounded-xl max-w-md w-full animate-scale-in">
          <div className="p-6 border-b">
            <h3 className="font-bold text-xl">添加新老师账号</h3>
          </div>
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
          <div className="p-6 border-t flex gap-3">
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
              className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300"
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
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-white rounded-xl max-w-md w-full animate-scale-in">
          <div className="p-6 border-b">
            <h3 className="font-bold text-xl">修改密码</h3>
            <p className="text-sm text-gray-600 mt-1">请输入当前密码并设置新密码</p>
          </div>

          {showSuccess ? (
            <div className="p-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check size={32} className="text-green-600" />
                </div>
                <p className="text-green-600 font-semibold">密码修改成功！</p>
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
                className="flex-1 bg-blue-500 text-white py-2 rounded-lg font-semibold hover:bg-blue-600"
              >
                确认修改
              </button>
              <button
                onClick={() => {
                  setShowChangePasswordModal(false);
                  setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  setErrors({});
                }}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300"
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

    // 过滤和搜索账号
    const getFilteredAccounts = () => {
      let filtered = allUsers;

      // 按角色过滤
      if (filterType !== 'all') {
        filtered = filtered.filter(u => u.role === filterType);
      }

      // 搜索过滤
      if (searchQuery) {
        filtered = filtered.filter(u =>
          u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (u.studentId && u.studentId.includes(searchQuery)) ||
          (u.teacherId && u.teacherId.includes(searchQuery))
        );
      }

      return filtered;
    };

    const filteredAccounts = getFilteredAccounts();

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-white rounded-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-scale-in">
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
                className={`p-4 rounded-lg transition cursor-pointer ${
                  filterType === 'all' ? 'bg-gray-600 text-white' : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <div className="text-2xl font-bold">{allUsers.length}</div>
                <div className="text-sm">全部账号</div>
              </button>
              <button
                onClick={() => setFilterType('student')}
                className={`p-4 rounded-lg transition cursor-pointer ${
                  filterType === 'student' ? 'bg-blue-600 text-white' : 'bg-blue-50 hover:bg-blue-100'
                }`}
              >
                <div className="text-2xl font-bold">{allUsers.filter(u => u.role === 'student').length}</div>
                <div className="text-sm">学生账号</div>
              </button>
              <button
                onClick={() => setFilterType('teacher')}
                className={`p-4 rounded-lg transition cursor-pointer ${
                  filterType === 'teacher' ? 'bg-purple-600 text-white' : 'bg-purple-50 hover:bg-purple-100'
                }`}
              >
                <div className="text-2xl font-bold">{allUsers.filter(u => u.role === 'teacher').length}</div>
                <div className="text-sm">老师账号</div>
              </button>
              <button
                onClick={() => setFilterType('admin')}
                className={`p-4 rounded-lg transition cursor-pointer ${
                  filterType === 'admin' ? 'bg-red-600 text-white' : 'bg-red-50 hover:bg-red-100'
                }`}
              >
                <div className="text-2xl font-bold">{allUsers.filter(u => u.role === 'admin').length}</div>
                <div className="text-sm">管理员账号</div>
              </button>
            </div>

            {/* 搜索栏和密码显示切换 */}
            <div className="mb-4 flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="搜索姓名、邮箱、学号或教师ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={() => setShowPasswords(!showPasswords)}
                className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                  showPasswords ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
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
                <span className="text-sm text-gray-500 ml-2">共 {filteredAccounts.length} 个</span>
              </h4>
              <div className="space-y-2">
                {filteredAccounts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    没有找到匹配的账号
                  </div>
                ) : (
                  filteredAccounts.map(account => (
                    <div key={account.id} className="border rounded-lg p-4 hover:bg-gray-50 transition">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              account.role === 'admin' ? 'bg-red-100 text-red-700' :
                              account.role === 'teacher' ? 'bg-purple-100 text-purple-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {account.role === 'admin' ? '管理员' :
                               account.role === 'teacher' ? '老师' : '学生'}
                            </div>
                            <div className="font-medium">{account.name}</div>
                          </div>
                          <div className="text-sm text-gray-600 mt-1">{account.email}</div>
                          <div className="text-xs text-gray-500 mt-1 space-y-1">
                            {account.studentId && <div>学号: {account.studentId}</div>}
                            {account.teacherId && <div>教师ID: {account.teacherId}</div>}
                            {showPasswords && (
                              <div className="flex items-center gap-2">
                                <span>密码: </span>
                                <code className="bg-gray-100 px-2 py-0.5 rounded text-red-600 font-mono">
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
                            onClick={() => {
                              if (window.confirm(`确定要删除账号 ${account.name} 吗？`)) {
                                setAllUsers(prev => prev.filter(u => u.id !== account.id));
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

          <div className="p-6 border-t bg-gray-50 flex gap-3">
            <button
              onClick={() => setShowAddTeacherModal(true)}
              className="flex-1 bg-purple-500 text-white py-3 rounded-lg font-semibold hover:bg-purple-600 flex items-center justify-center gap-2"
            >
              <Plus size={18} />
              添加老师账号
            </button>
            <button
              onClick={() => setShowAccountManagementModal(false)}
              className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    );
  };
  const TimelineView = () => (
    <div className="space-y-6">
      {/* 搜索和筛选栏 */}
      <div className="bg-white rounded-xl shadow-sm p-4 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="搜索事项..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">所有分类</option>
            <option value="日语考试">日语考试</option>
            <option value="出愿">出愿</option>
            <option value="留考">留考</option>
            <option value="研究室联系">研究室联系</option>
            <option value="材料准备">材料准备</option>
            <option value="考试">考试</option>
            <option value="合格发表">合格发表</option>
          </select>
          {/* 视图切换 */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setTimelineViewMode('card')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                timelineViewMode === 'card' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <LayoutGrid size={16} /> 卡片
            </button>
            <button
              onClick={() => setTimelineViewMode('linear')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                timelineViewMode === 'linear' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <LayoutList size={16} /> 线形
            </button>
            <button
              onClick={() => setTimelineViewMode('calendar')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                timelineViewMode === 'calendar' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
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
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-20">
                <button
                  onClick={() => {
                    const studentInfo = studentList.find(s => s.studentId === currentStudent.studentId) || currentStudent;
                    exportStudentToCSV(studentInfo, currentStudentData);
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm flex items-center gap-2"
                >
                  <FileText size={16} /> 导出学生信息 (CSV)
                </button>
                <button
                  onClick={() => {
                    exportEventsToICS(upcomingEvents, currentStudent.name);
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm flex items-center gap-2"
                >
                  <Calendar size={16} /> 导出日历 (.ics)
                </button>
                <button
                  onClick={() => {
                    exportChecklistToPDF(currentStudent, checklist, schools);
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm flex items-center gap-2"
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
      <div className={`bg-gradient-to-r ${user.role === 'teacher' ? 'from-purple-500 to-blue-600' : 'from-blue-500 to-purple-600'} text-white p-6 lg:p-8 rounded-xl shadow-lg`}>
        <h2 className="text-2xl lg:text-3xl font-bold mb-2">考学进度概览</h2>
        <p className="text-blue-100 text-sm lg:text-base">
          {user.role === 'teacher'
            ? `正在查看: ${currentStudent.name} (${currentStudent.studentId})`
            : `你有 ${filteredEvents.filter(e => e.urgent).length} 个紧急事项需要关注`
          }
        </p>
        <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white bg-opacity-20 rounded-lg p-3">
            <div className="text-2xl font-bold">{filteredEvents.length}</div>
            <div className="text-xs opacity-90">待办事项</div>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg p-3">
            <div className="text-2xl font-bold">{schools.length}</div>
            <div className="text-xs opacity-90">目标学校</div>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg p-3">
            <div className="text-2xl font-bold">
              {filteredEvents.filter(e => e.daysLeft <= 7).length}
            </div>
            <div className="text-xs opacity-90">本周任务</div>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg p-3">
            <div className="text-2xl font-bold">
              {filteredEvents.filter(e => e.urgent).length}
            </div>
            <div className="text-xs opacity-90">紧急事项</div>
          </div>
        </div>
      </div>

      {/* 事件列表 - 卡片视图 */}
      {timelineViewMode === 'card' && (
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredEvents.map(event => (
          <div
            key={event.id}
            className={`border-2 rounded-xl p-4 lg:p-5 ${getTypeColor(event.type)}
              transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer ${event.completed ? 'opacity-60' : ''}`}
            onClick={() => setSelectedEventId(selectedEventId === event.id ? null : event.id)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{getTypeIcon(event.type)}</span>
                  <span className="text-xs font-semibold px-2 py-1 bg-white rounded">
                    {event.category}
                  </span>
                  {event.urgent && (
                    <span className="flex items-center gap-1 text-xs text-red-600 font-semibold">
                      <AlertCircle size={14} />
                      紧急
                    </span>
                  )}
                  {event.schoolId && (
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                      学校关联
                    </span>
                  )}
                </div>
                <h3 className={`font-bold text-lg mb-1 ${event.completed ? 'line-through' : ''}`}>
                  {event.title}
                </h3>
                <p className="text-sm text-gray-600">{event.date}</p>
              </div>
              <div className="text-right">
                <div className={`text-3xl font-bold ${
                  event.daysLeft <= 0 ? 'text-gray-600' :
                  event.daysLeft <= 7 ? 'text-red-600' :
                  event.daysLeft <= 30 ? 'text-orange-600' : 'text-gray-700'
                }`}>
                  {event.daysLeft <= 0 ? '已过期' : event.daysLeft}
                </div>
                <div className="text-xs text-gray-500">
                  {event.daysLeft <= 0 ? '' : '天后'}
                </div>
              </div>
            </div>

            {(selectedEventId === event.id || !isMobile) && (
              <div className="mt-3 p-3 bg-white bg-opacity-70 rounded-lg animate-slide-up">
                {event.notes && <p className="text-sm text-gray-700 mb-3">{event.notes}</p>}
                {(user.role === 'teacher' || user.role === 'admin') && (
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const newEvents = upcomingEvents.map(ev =>
                          ev.id === event.id ? {...ev, completed: !ev.completed} : ev
                        );
                        setUpcomingEvents(newEvents);
                      }}
                      className="flex-1 bg-green-500 text-white py-2 rounded-lg text-sm font-semibold hover:bg-green-600 flex items-center justify-center gap-1"
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
                      className="flex-1 bg-blue-500 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-600 flex items-center justify-center gap-1"
                    >
                      <Edit size={16} />
                      编辑
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteEvent(event.id);
                      }}
                      className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-semibold hover:bg-red-600 flex items-center justify-center gap-1"
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
          onToggleComplete={(eventId) => {
            const newEvents = upcomingEvents.map(ev =>
              ev.id === eventId ? {...ev, completed: !ev.completed} : ev
            );
            setUpcomingEvents(newEvents);
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
          onUpdateEvent={(eventId, updates) => {
            const newEvents = upcomingEvents.map(ev =>
              ev.id === eventId ? {...ev, ...updates} : ev
            );
            setUpcomingEvents(newEvents);
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
          className="w-full bg-gradient-to-r from-purple-500 to-blue-600 text-white py-4 rounded-xl font-semibold hover:shadow-lg transition flex items-center justify-center gap-2"
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-2xl lg:text-3xl font-bold text-gray-800">志愿学校</h2>
        {(user.role === 'teacher' || user.role === 'admin') && (
          <button
            onClick={() => {
              setEditingSchool(null);
              setShowSchoolModal(true);
            }}
            className="bg-gradient-to-r from-purple-500 to-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:shadow-lg transition flex items-center gap-2"
          >
            <Plus size={16} />
            添加学校
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {schools.map(school => {
          const progress = calculateSchoolProgress(school.name);
          return (
            <div key={school.id} className="bg-white border-2 border-gray-200 rounded-xl p-5 hover:shadow-xl transition-all card-hover">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold text-xl">{school.name}</h3>
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                      {school.type}
                    </span>
                  </div>
                  <span className={`inline-block text-xs px-3 py-1 rounded-full border ${getStatusColor(school.status)}`}>
                    {getStatusText(school.status)}
                  </span>
                  <p className="text-sm text-gray-600 mt-2">{school.program}</p>
                </div>
                {(user.role === 'teacher' || user.role === 'admin') && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setEditingSchool(school);
                        setShowSchoolModal(true);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-lg transition"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteSchool(school.id)}
                      className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition"
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
                    className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition text-sm"
                  >
                    <BookOpen size={16} />
                    查看募集要项
                    <ExternalLink size={14} />
                  </a>
                )}

                {/* 日期信息 */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-green-50 p-2 rounded">
                    <div className="text-gray-600">出愿开始</div>
                    <div className="font-semibold">{school.applicationStartDate}</div>
                  </div>
                  <div className="bg-orange-50 p-2 rounded">
                    <div className="text-gray-600">出愿截止</div>
                    <div className="font-semibold">{school.applicationEndDate}</div>
                  </div>
                  <div className="bg-blue-50 p-2 rounded">
                    <div className="text-gray-600">考试日期</div>
                    <div className="font-semibold">{school.examDate}</div>
                  </div>
                  <div className="bg-purple-50 p-2 rounded">
                    <div className="text-gray-600">合格发表</div>
                    <div className="font-semibold">{school.resultDate}</div>
                  </div>
                </div>

                {user.role === 'teacher' && school.teacherNotes && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="text-xs text-gray-600 mb-1 font-semibold">老师备注:</div>
                    <div className="text-sm text-gray-700">{school.teacherNotes}</div>
                  </div>
                )}

                {/* 材料准备进度 - 与材料清单同步 */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">材料准备进度</span>
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-2xl lg:text-3xl font-bold text-gray-800">材料清单</h2>
        <div className="flex gap-2">
          <button
            onClick={() => exportChecklistToPDF(currentStudent, checklist, schools)}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-600 transition flex items-center gap-2">
            <Download size={16} />
            导出清单
          </button>
          {(user.role === 'teacher' || user.role === 'admin') && (
            <>
              <button className="bg-purple-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-600 transition flex items-center gap-2">
                <Upload size={16} />
                上传材料
              </button>
              <button
                onClick={() => {
                  setEditingMaterial(null);
                  setShowMaterialModal(true);
                }}
                className="bg-green-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-600 transition flex items-center gap-2"
              >
                <Plus size={16} />
                添加材料
              </button>
            </>
          )}
        </div>
      </div>

      {/* 进度统计 - 移到顶部 */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border-2 border-gray-200">
        <h3 className="font-bold text-lg mb-4">材料准备总进度</h3>
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
      <div className="bg-white border-2 border-gray-200 rounded-xl p-5">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <FileText size={20} />
          通用材料
          <span className="text-sm text-gray-500 font-normal">
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
          <div key={schoolName} className="bg-white border-2 border-gray-200 rounded-xl p-5">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <School size={20} />
              {schoolName}
              <span className="text-sm text-gray-500 font-normal">
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
    { id: 'timeline', label: '时间线', icon: Clock },
    { id: 'schools', label: '学校', icon: School },
    { id: 'checklist', label: '材料', icon: CheckSquare },
    // 学生账号不显示学生信息页面
    ...(user.role !== 'student' ? [{ id: 'profile', label: '学生信息', icon: UserCircle }] : []),
    ...(user.role === 'admin' ? [{ id: 'teachers', label: '老师管理', icon: GraduationCap }] : []),
    ...((user.role === 'admin' || hasPermission('manage_school_db')) ? [{ id: 'schooldb', label: '学校信息库', icon: BookOpen }] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto">
          <div className="px-4 lg:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {isMobile && (
                  <button
                    onClick={() => setShowMobileMenu(!showMobileMenu)}
                    className="p-2 hover:bg-gray-100 rounded-lg lg:hidden"
                  >
                    <Menu size={24} />
                  </button>
                )}
                <div>
                  <h1 className="text-xl lg:text-2xl font-bold text-gray-800">
                    日本留学考学助手
                  </h1>
                  <p className="text-xs lg:text-sm text-gray-500">
                    {user.role === 'teacher' ? '老师管理端' :
                     user.role === 'admin' ? '管理员端' : '学生查看端'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 lg:gap-4">
                {/* 通知按钮 */}
                <button className="p-2 hover:bg-gray-100 rounded-lg relative">
                  <Bell size={20} />
                  {filteredEvents.filter(e => e.urgent).length > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                  )}
                </button>

                {(user.role === 'teacher' || user.role === 'admin') && (
                  <button
                    onClick={() => setShowStudentList(true)}
                    className={`p-2 ${user.role === 'admin' ? 'bg-red-50 text-red-600' : 'bg-purple-50 text-purple-600'} rounded-lg hover:opacity-80`}
                  >
                    <Users size={20} />
                  </button>
                )}

                {/* 用户菜单 */}
                <div className="relative group">
                  <button className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg">
                    <div className="text-2xl">{currentStudent.avatar}</div>
                    {!isMobile && (
                      <>
                        <span className="font-medium">{user.name}</span>
                        <ChevronDown size={16} />
                      </>
                    )}
                  </button>

                  {/* 下拉菜单 */}
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                    <div className="p-3 border-b">
                      <div className="text-sm font-medium">{user.name}</div>
                      <div className="text-xs text-gray-500">{user.email}</div>
                      {user.role === 'student' && (
                        <div className="text-xs text-gray-500">学号: {user.studentId}</div>
                      )}
                    </div>
                    {user.role === 'admin' && (
                      <>
                        <button
                          onClick={() => setShowAccountManagementModal(true)}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-red-600"
                        >
                          <Shield size={16} />
                          账号管理
                        </button>
                        <button
                          onClick={() => setShowAddTeacherModal(true)}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-purple-600"
                        >
                          <UserPlus size={16} />
                          添加老师
                        </button>
                      </>
                    )}
                    {user.role === 'teacher' && (
                      <button
                        onClick={() => { setShowSettingsModal(true); setSettingsModalInitTab('security'); }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-blue-600"
                      >
                        <Lock size={16} />
                        修改密码
                      </button>
                    )}
                    <button
                      onClick={() => { setShowSettingsModal(true); setSettingsModalInitTab('profile'); }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Settings size={16} />
                      设置
                    </button>
                    <button
                      onClick={onLogout}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-red-600"
                    >
                      <LogOut size={16} />
                      退出登录
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 角色提示 */}
            <div className={`mt-3 p-2 rounded-lg flex items-center gap-2 ${
              user.role === 'teacher' ? 'bg-purple-50 text-purple-700' :
              user.role === 'admin' ? 'bg-red-50 text-red-700' :
              'bg-blue-50 text-blue-700'
            }`}>
              <Shield size={16} />
              <span className="text-sm">
                您当前以{user.role === 'teacher' ? '老师' :
                        user.role === 'admin' ? '管理员' : '学生'}身份登录
                {(user.role === 'teacher' || user.role === 'admin') && currentStudent.name !== user.name && ` · 正在查看学生: ${currentStudent.name}`}
              </span>
            </div>
          </div>

          {/* Desktop Tabs */}
          {!isMobile && (
            <div className="px-4 lg:px-6">
              <div className="flex gap-1">
                {tabs.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-4 py-3 font-medium transition-all relative
                        ${isActive
                          ? user.role === 'teacher'
                            ? 'text-purple-600'
                            : 'text-blue-600'
                          : 'text-gray-600 hover:text-gray-900'
                        }
                        ${isActive ? 'tab-active' : ''}`}
                    >
                      <Icon size={18} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Sidebar */}
      {isMobile && showMobileMenu && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black bg-opacity-50 animate-fade-in" onClick={() => setShowMobileMenu(false)} />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white animate-slide-in-left">
            <div className={`p-4 bg-gradient-to-r ${user.role === 'teacher' ? 'from-purple-500 to-blue-600' : 'from-blue-500 to-purple-600'} text-white`}>
              <h2 className="text-xl font-bold">菜单</h2>
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
                    className={`w-full flex items-center gap-3 px-6 py-3 transition
                      ${isActive
                        ? `${user.role === 'teacher' ? 'bg-purple-50 text-purple-600 border-r-4 border-purple-600' : 'bg-blue-50 text-blue-600 border-r-4 border-blue-600'}`
                        : 'text-gray-600 hover:bg-gray-50'
                      }`}
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
      <div className={`max-w-7xl mx-auto px-4 lg:px-6 py-6 lg:py-8 ${isMobile ? 'pb-24' : ''}`}>
        <div key={activeTab} className="page-transition">
        {activeTab === 'timeline' && <TimelineView />}
        {activeTab === 'schools' && <SchoolsView />}
        {activeTab === 'checklist' && <ChecklistView />}
        {activeTab === 'profile' && (
          <StudentProfile
            student={currentStudent}
            studentData={currentStudentData}
            onBack={() => setActiveTab('timeline')}
            onUpdate={(updated) => {
              setCurrentStudent(prev => ({...prev, ...updated}));
            }}
          />
        )}
        {activeTab === 'teachers' && <TeacherManagement />}
        {activeTab === 'schooldb' && <SchoolDatabase />}
        {activeTab === 'upcoming' && (
          <UpcomingSchools
            studentList={studentList}
            currentStudent={currentStudent}
            user={user}
          />
        )}
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-30">
          <div className="flex justify-around py-2">
            {tabs.slice(0, 4).map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg flex-1 transition ${
                    isActive
                      ? user.role === 'teacher'
                        ? 'text-purple-600 bg-purple-50'
                        : 'text-blue-600 bg-blue-50'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  <Icon size={22} />
                  <span className="text-[10px] mt-0.5 font-medium">{tab.label}</span>
                </button>
              );
            })}
            {tabs.length > 4 && (
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className={`flex flex-col items-center justify-center p-2 rounded-lg flex-1 transition ${
                  tabs.slice(4).some(t => t.id === activeTab)
                    ? user.role === 'teacher'
                      ? 'text-purple-600 bg-purple-50'
                      : 'text-blue-600 bg-blue-50'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <Menu size={22} />
                <span className="text-[10px] mt-0.5 font-medium">更多</span>
              </button>
            )}
          </div>
        </div>
      )}

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

      {/* 设置弹窗 */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="font-bold text-lg">设置</h3>
              <button onClick={() => { setShowSettingsModal(false); setSettingsModalInitTab(null); }}
                className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-0">
              <SettingsPage
                user={user}
                allUsers={allUsers}
                setAllUsers={setAllUsers}
                onLogout={onLogout}
                initTab={settingsModalInitTab}
                onInitTabConsumed={() => setSettingsModalInitTab(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 根组件
const JapanStudyApp = () => {
  const [user, setUser] = useState(null);

  // 用户账号数据库 - 移到根组件以便AuthPage和MainApp都可以访问
  const [allUsers, setAllUsers] = useState(() => {
    // 从localStorage读取用户数据，如果没有则使用默认数据
    const savedUsers = localStorage.getItem('registeredUsers');
    if (savedUsers) {
      return JSON.parse(savedUsers);
    }
    return [
      // 管理员账号
      {
        id: 'admin1',
        email: 'admin@jsa.com',
        password: 'admin123',
        role: 'admin',
        name: '系统管理员',
        createdAt: new Date().toISOString()
      },
      // 老师账号
      {
        id: 'teacher1',
        email: 'wang@school.com',
        password: 'wang123',
        role: 'teacher',
        teacherId: 'teacher_1',
        name: '王老师',
        createdAt: new Date().toISOString()
      },
      {
        id: 'teacher2',
        email: 'li@school.com',
        password: 'li123',
        role: 'teacher',
        teacherId: 'teacher_2',
        name: '李老师',
        createdAt: new Date().toISOString()
      },
      // 学生账号（已注册的）
      {
        id: 'student1',
        email: 'zhangsan@example.com',
        password: 'zhang123',
        role: 'student',
        studentId: '2024001',
        name: '张三',
        createdAt: new Date().toISOString()
      }
    ];
  });

  // 学生列表数据 - 包含学生的详细信息
  const [studentList, setStudentList] = useState(() => {
    const savedStudents = localStorage.getItem('studentList');
    if (savedStudents) {
      return JSON.parse(savedStudents);
    }
    return [
      { id: 1, name: '张三', studentId: '2024001', progress: 65, urgentTasks: 2, avatar: '👨‍🎓', teacherId: 'teacher_1', birthday: '', highSchool: '', languageSchool: '', jlptScore: '', ejuScores: [], englishScore: '', followUpNotes: '', photo: '' },
      { id: 2, name: '李四', studentId: '2024002', progress: 45, urgentTasks: 4, avatar: '👩‍🎓', teacherId: 'teacher_1', birthday: '', highSchool: '', languageSchool: '', jlptScore: '', ejuScores: [], englishScore: '', followUpNotes: '', photo: '' },
      { id: 3, name: '王五', studentId: '2024003', progress: 80, urgentTasks: 1, avatar: '👨‍🎓', teacherId: 'teacher_2', birthday: '', highSchool: '', languageSchool: '', jlptScore: '', ejuScores: [], englishScore: '', followUpNotes: '', photo: '' },
      { id: 4, name: '赵六', studentId: '2024004', progress: 55, urgentTasks: 3, avatar: '👩‍🎓', teacherId: 'teacher_2', birthday: '', highSchool: '', languageSchool: '', jlptScore: '', ejuScores: [], englishScore: '', followUpNotes: '', photo: '' },
    ];
  });

  // 保存用户数据到localStorage
  useEffect(() => {
    localStorage.setItem('registeredUsers', JSON.stringify(allUsers));
  }, [allUsers]);

  // 保存学生列表到localStorage
  useEffect(() => {
    localStorage.setItem('studentList', JSON.stringify(studentList));
  }, [studentList]);

  const handleLogin = (userData) => {
    setUser(userData);
    // 这里可以保存到 localStorage 实现持久化
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  // 检查是否有已登录用户
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  return (
    <ErrorBoundary>
      <AppProvider>
        {user ? (
          <MainApp user={user} onLogout={handleLogout} allUsers={allUsers} setAllUsers={setAllUsers} studentList={studentList} setStudentList={setStudentList} />
        ) : (
          <AuthPage onLogin={handleLogin} allUsers={allUsers} studentList={studentList} />
        )}
      </AppProvider>
    </ErrorBoundary>
  );
};

export default JapanStudyApp;
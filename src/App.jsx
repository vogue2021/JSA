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
import { schoolsAPI, eventsAPI, materialsAPI } from './services/api';
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
import { exportStudentToCSV, exportEventsToICS, exportChecklistToPDF } from './utils/exportUtils';
import { generateTestData } from './utils/generateTestData';
import { logAction, logInfo, logError, LOG_CATEGORIES } from './utils/logService';

// ErrorBoundary 已拆分到 src/components/common/ErrorBoundary.jsx

// 登录注册页面组件
const AuthPage = ({ onLogin, allUsers, studentList }) => {
  const { isDark, tokens, backgroundStyle, glassEnabled } = useTheme();
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
    {
      id: 'teacher3',
      email: 'zhang@school.com',
      password: 'zhang123',
      role: 'teacher',
      teacherId: 'teacher_3',
      name: '张老师'
    },
    // 学生账号（已注册的）
    {
      id: 'student1',
      email: 'zhangsan@student.jsa.com',
      password: 'stu2024001',
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
          logAction(LOG_CATEGORIES.AUTH, `用户登录: ${user.name} (${user.role})`, { email: user.email });
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
    <div className="min-h-screen flex items-center justify-center p-4 themed-bg noise-overlay" style={backgroundStyle}>
      {/* 登录页背景光斑 */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="animate-glow-float absolute rounded-full" style={{
          width: '50vw', height: '50vw', top: '5%', left: '-5%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.2), transparent 70%)',
          filter: 'blur(80px)',
        }} />
        <div className="animate-glow-float-slow absolute rounded-full" style={{
          width: '40vw', height: '40vw', bottom: '10%', right: '-5%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.18), transparent 70%)',
          filter: 'blur(60px)',
        }} />
        <div className="animate-glow-float absolute rounded-full" style={{
          width: '30vw', height: '30vw', top: '50%', left: '60%',
          background: 'radial-gradient(circle, rgba(16,185,129,0.12), transparent 70%)',
          filter: 'blur(50px)', animationDelay: '4s',
        }} />
      </div>

      <div className="max-w-5xl w-full grid lg:grid-cols-2 rounded-2xl overflow-hidden relative z-10 animate-scale-in"
        style={{
          background: glassEnabled ? tokens.colors.surface.glass : tokens.colors.surface.solid,
          backdropFilter: glassEnabled ? `blur(${tokens.blur.heavyBlur}px)` : 'none',
          WebkitBackdropFilter: glassEnabled ? `blur(${tokens.blur.heavyBlur}px)` : 'none',
          border: `1px solid ${tokens.colors.border.hairline}`,
          boxShadow: `${tokens.shadow.elevation}, ${tokens.shadow.innerHighlight}`,
        }}>
        {/* 左侧装饰面板 */}
        <div className="hidden lg:flex flex-col justify-center items-center p-12 text-white relative overflow-hidden">
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.9), rgba(139,92,246,0.9))',
          }} />
          {/* 装饰光斑 */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute w-40 h-40 rounded-full animate-pulse-glow" style={{
              top: '15%', right: '10%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.15), transparent 70%)',
            }} />
            <div className="absolute w-32 h-32 rounded-full animate-pulse-glow" style={{
              bottom: '20%', left: '5%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.1), transparent 70%)',
              animationDelay: '1.5s',
            }} />
          </div>
          <div className="mb-8 relative z-10">
            <div className="w-32 h-32 rounded-full flex items-center justify-center mb-6"
              style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)' }}>
              <GraduationCap size={64} className="text-white" />
            </div>
            <h1 className="text-4xl font-bold mb-4">日本留学考学助手</h1>
            <p className="text-center" style={{ color: 'rgba(255,255,255,0.8)' }}>
              专业的日本留学申请管理平台<br/>
              让留学之路更加清晰高效
            </p>
          </div>

          <div className="space-y-4 w-full max-w-sm relative z-10">
            <div className="flex items-center gap-3 rounded-xl p-3 transition-all"
              style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.15)' }}>
              <Calendar className="text-white" size={24} />
              <span>智能时间线管理</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl p-3 transition-all"
              style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.15)' }}>
              <School className="text-white" size={24} />
              <span>多校申请追踪</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl p-3 transition-all"
              style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.15)' }}>
              <FileText className="text-white" size={24} />
              <span>材料清单管理</span>
            </div>
          </div>
        </div>

        {/* 右侧登录/注册表单 */}
        <div className="p-8 lg:p-12">
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2" style={{ color: tokens.colors.text.primary }}>
              {isLogin ? '欢迎回来' : '学生注册'}
            </h2>
            <p style={{ color: tokens.colors.text.secondary }}>
              {isLogin ? '登录您的账号继续管理留学申请' : '学生使用学号注册账号'}
            </p>
          </div>

          {/* 角色选择 - 只在登录页显示 */}
          {isLogin && (
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2" style={{ color: tokens.colors.text.secondary }}>我是</label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setUserType('student')}
                  className="p-3 rounded-xl border-2 transition flex items-center justify-center gap-2"
                  style={{
                    borderColor: userType === 'student' ? tokens.colors.accent.primary : tokens.colors.border.subtle,
                    background: userType === 'student' ? (isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)') : 'transparent',
                    color: userType === 'student' ? tokens.colors.accent.primary : tokens.colors.text.secondary,
                  }}
                >
                  <User size={20} />
                  <span className="font-medium">学生</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUserType('teacher')}
                  className="p-3 rounded-xl border-2 transition flex items-center justify-center gap-2"
                  style={{
                    borderColor: userType === 'teacher' ? tokens.colors.accent.secondary : tokens.colors.border.subtle,
                    background: userType === 'teacher' ? (isDark ? 'rgba(139,92,246,0.1)' : 'rgba(139,92,246,0.06)') : 'transparent',
                    color: userType === 'teacher' ? tokens.colors.accent.secondary : tokens.colors.text.secondary,
                  }}
                >
                  <GraduationCap size={20} />
                  <span className="font-medium">老师</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUserType('admin')}
                  className="p-3 rounded-xl border-2 transition flex items-center justify-center gap-2"
                  style={{
                    borderColor: userType === 'admin' ? tokens.colors.accent.danger : tokens.colors.border.subtle,
                    background: userType === 'admin' ? (isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.06)') : 'transparent',
                    color: userType === 'admin' ? tokens.colors.accent.danger : tokens.colors.text.secondary,
                  }}
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
                  <label className="block text-sm font-medium mb-1" style={{ color: tokens.colors.text.secondary }}>姓名</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent
                      ${errors.name ? 'border-red-500' : ''}`}
                    style={{ borderColor: errors.name ? undefined : (isDark ? 'rgba(255,255,255,0.15)' : '#d1d5db'), background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', color: tokens.colors.text.primary }}
                    placeholder="请输入您的姓名"
                  />
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                </div>

                {userType === 'student' && (
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: tokens.colors.text.secondary }}>学号</label>
                    <input
                      type="text"
                      value={formData.studentId}
                      onChange={(e) => setFormData({...formData, studentId: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent
                        ${errors.studentId ? 'border-red-500' : ''}`}
                      style={{ borderColor: errors.studentId ? undefined : (isDark ? 'rgba(255,255,255,0.15)' : '#d1d5db'), background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', color: tokens.colors.text.primary }}
                      placeholder="请输入学号"
                    />
                    {errors.studentId && <p className="text-red-500 text-xs mt-1">{errors.studentId}</p>}
                  </div>
                )}
              </>
            )}

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: tokens.colors.text.secondary }}>邮箱</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2" size={20} style={{ color: tokens.colors.text.muted }} />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    ${errors.email ? 'border-red-500' : ''}`}
                  style={{ borderColor: errors.email ? undefined : (isDark ? 'rgba(255,255,255,0.15)' : '#d1d5db'), background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', color: tokens.colors.text.primary }}
                  placeholder="your@email.com"
                />
              </div>
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>

            {!isLogin && (
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: tokens.colors.text.secondary }}>邮箱验证码</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.verificationCode}
                    onChange={(e) => setFormData({...formData, verificationCode: e.target.value})}
                    className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent
                      ${errors.verificationCode ? 'border-red-500' : ''}`}
                    style={{ borderColor: errors.verificationCode ? undefined : (isDark ? 'rgba(255,255,255,0.15)' : '#d1d5db'), background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', color: tokens.colors.text.primary }}
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
              <label className="block text-sm font-medium mb-1" style={{ color: tokens.colors.text.secondary }}>密码</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2" size={20} style={{ color: tokens.colors.text.muted }} />
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    ${errors.password ? 'border-red-500' : ''}`}
                  style={{ borderColor: errors.password ? undefined : (isDark ? 'rgba(255,255,255,0.15)' : '#d1d5db'), background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', color: tokens.colors.text.primary }}
                  placeholder="••••••••"
                />
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
            </div>

            {!isLogin && (
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: tokens.colors.text.secondary }}>确认密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2" size={20} style={{ color: tokens.colors.text.muted }} />
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent
                      ${errors.confirmPassword ? 'border-red-500' : ''}`}
                    style={{ borderColor: errors.confirmPassword ? undefined : (isDark ? 'rgba(255,255,255,0.15)' : '#d1d5db'), background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', color: tokens.colors.text.primary }}
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
              <p style={{ color: tokens.colors.text.secondary }}>
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
              <p style={{ color: tokens.colors.text.secondary }}>
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
            <div className="mt-6 p-4 rounded-xl text-xs" style={{
              background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
              border: `1px solid ${tokens.colors.border.subtle}`,
              color: tokens.colors.text.secondary,
            }}>
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
                  <p className="mt-1" style={{ color: tokens.colors.text.muted }}>未注册学号: 2024002（李四）</p>
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

  const [activeTab, setActiveTab] = useState(
    // 老师和管理员默认进入仪表盘，学生进入时间线
    (user.role === 'teacher' || user.role === 'admin') ? 'dashboard' : 'timeline'
  );
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
  const [showThemeCustomizer, setShowThemeCustomizer] = useState(false);
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
      return allStudents.filter(s => s.teacherId === user.teacherId); // 老师只看到自己的学生
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
      preparing: 'bg-blue-100 text-blue-700 border-blue-200',
      contacted: 'bg-green-100 text-green-700 border-green-200',
      submitted: 'bg-purple-100 text-purple-700 border-purple-200',
      admitted: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    };
    return colors[status] || (isDark ? 'bg-[rgba(255,255,255,0.06)] text-gray-300 border-[rgba(255,255,255,0.1)]' : 'bg-gray-100 text-gray-700 border-gray-200');
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
    return colors[type] || (isDark ? 'bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.08)]' : 'bg-gray-50 border-gray-200');
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
        <div className="rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-scale-in" style={{ background: tokens.colors.surface.solid, border: `1px solid ${tokens.colors.border.subtle}` }}>
          <div className="p-6 border-b flex items-center justify-between">
            <h3 className="font-bold text-xl">{editingEvent ? '编辑事项' : '添加新事项'}</h3>
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
      // 点击学生后导航到学生独立页面
      setActiveTab('profile');
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
  // === 学生选择器组件（老师/管理员可用）===
  const StudentSelector = () => {
    if (user.role === 'student') return null;
    const visibleStudents = getVisibleStudents();
    if (visibleStudents.length === 0) return null;
    return (
      <div className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-3 border-2 border-gray-100">
        <div className="flex items-center gap-2 text-sm text-gray-500">
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
          className="flex-1 max-w-xs px-3 py-1.5 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
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
              <div className="mt-3 p-3 rounded-lg animate-slide-up" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.7)' }}>
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
      {/* 学生选择器 */}
      {user.role !== 'student' && <StudentSelector />}
      {(user.role === 'teacher' || user.role === 'admin') && (
        <div className="flex justify-end">
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
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {schools.map(school => {
          const progress = calculateSchoolProgress(school.name);
          return (
            <div key={school.id} className={`bg-white border-2 border-gray-200 rounded-xl p-5 hover:shadow-xl transition-all card-hover ${user.role === 'student' ? 'cursor-pointer' : ''}`}
              onClick={user.role === 'student' ? () => setSchoolDetailModal(school) : undefined}
            >
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
      {/* 学生选择器 */}
      {user.role !== 'student' && <StudentSelector />}
      <div className="flex justify-end">
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
      <div className="rounded-xl p-6 border-2" style={{ background: isDark ? 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(168,85,247,0.08))' : 'linear-gradient(to right, #eff6ff, #faf5ff)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb' }}>
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
      <div className="rounded-xl p-5 border-2" style={{ background: tokens.colors.surface.solid, borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb' }}>
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
          <div key={schoolName} className="rounded-xl p-5 border-2" style={{ background: tokens.colors.surface.solid, borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb' }}>
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
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 text-gray-600 text-xs">
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
          {/* 导航菜单 */}
          <div className="flex-1 pt-2 pb-2 overflow-y-auto">
            {tabs.map(tab => {
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
            currentStudent={currentStudent}
            user={user}
          />
        )}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setSchoolDetailModal(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto animate-scale-in" onClick={e => e.stopPropagation()}>
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
                    schoolDetailModal.status === 'submitted' ? 'bg-purple-400 text-purple-900' :
                    schoolDetailModal.status === 'contacted' ? 'bg-green-400 text-green-900' :
                    'bg-blue-400 text-blue-900'
                  }`}>
                    {getStatusText(schoolDetailModal.status)}
                  </span>
                </div>
              </div>

              <div className="p-6 space-y-5">
                {/* 重要日期 */}
                <div>
                  <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><Calendar size={16} /> 重要日期</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {schoolDetailModal.applicationStartDate && (
                      <div className="bg-green-50 p-3 rounded-lg">
                        <div className="text-xs text-gray-500">出愿开始</div>
                        <div className="font-semibold text-sm">{schoolDetailModal.applicationStartDate}</div>
                      </div>
                    )}
                    {schoolDetailModal.applicationEndDate && (
                      <div className="bg-orange-50 p-3 rounded-lg">
                        <div className="text-xs text-gray-500">出愿截止</div>
                        <div className="font-semibold text-sm">{schoolDetailModal.applicationEndDate}</div>
                      </div>
                    )}
                    {schoolDetailModal.examDate && (
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="text-xs text-gray-500">考试日期</div>
                        <div className="font-semibold text-sm">{schoolDetailModal.examDate}</div>
                      </div>
                    )}
                    {schoolDetailModal.resultDate && (
                      <div className="bg-purple-50 p-3 rounded-lg">
                        <div className="text-xs text-gray-500">合格发表</div>
                        <div className="font-semibold text-sm">{schoolDetailModal.resultDate}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 材料准备进度 */}
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2"><CheckSquare size={16} /> 材料准备</h4>
                  {(() => {
                    const progress = calculateSchoolProgress(schoolDetailModal.name);
                    return (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-500">{progress.completed}/{progress.total} 完成</span>
                          <span className="font-bold">{progress.percentage}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
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
                    className="flex items-center gap-2 px-4 py-3 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition text-sm font-medium">
                    <BookOpen size={18} /> 查看募集要项 <ExternalLink size={14} className="ml-auto" />
                  </a>
                )}

                {/* 提交材料 */}
                {schoolDetailModal.materials && schoolDetailModal.materials.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2"><FileText size={16} /> 需提交材料</h4>
                    <div className="space-y-2">
                      {schoolDetailModal.materials.map((m, i) => (
                        <div key={i} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg text-sm">
                          <span>{m.name}</span>
                          <span className="text-xs text-gray-400">截止: {m.deadline}</span>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
              <h3 className="font-bold text-lg">设置</h3>
              <button onClick={() => { setShowSettingsModal(false); setSettingsModalInitTab(null); }}
                className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            {/* 如果没有指定初始 tab，则显示一览页面 */}
            {!settingsModalInitTab ? (
              <div className="p-6">
                <p className="text-sm text-gray-500 mb-4">选择要修改的设置项目</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => setSettingsModalInitTab('profile')}
                    className="flex items-center gap-4 p-4 bg-white border-2 border-gray-100 rounded-xl hover:border-blue-300 hover:bg-blue-50/50 transition text-left group"
                  >
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-200 transition">
                      <User size={20} className="text-blue-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800 text-sm">个人信息</div>
                      <div className="text-xs text-gray-400">姓名、邮箱、电话、住址等</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setSettingsModalInitTab('security')}
                    className="flex items-center gap-4 p-4 bg-white border-2 border-gray-100 rounded-xl hover:border-orange-300 hover:bg-orange-50/50 transition text-left group"
                  >
                    <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center group-hover:bg-orange-200 transition">
                      <Lock size={20} className="text-orange-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800 text-sm">安全设置</div>
                      <div className="text-xs text-gray-400">修改登录密码</div>
                    </div>
                  </button>
                  <button
                    onClick={() => { setShowSettingsModal(false); setShowThemeCustomizer(true); }}
                    className="flex items-center gap-4 p-4 bg-white border-2 border-gray-100 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/50 transition text-left group"
                  >
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center group-hover:bg-indigo-200 transition">
                      <Palette size={20} className="text-indigo-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800 text-sm">外观设置</div>
                      <div className="text-xs text-gray-400">主题、背景、玻璃效果、动效</div>
                    </div>
                  </button>
                  {user.role === 'admin' && (
                    <>
                      <button
                        onClick={() => setSettingsModalInitTab('analytics')}
                        className="flex items-center gap-4 p-4 bg-white border-2 border-gray-100 rounded-xl hover:border-green-300 hover:bg-green-50/50 transition text-left group"
                      >
                        <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center group-hover:bg-green-200 transition">
                          <BarChart3 size={20} className="text-green-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-800 text-sm">数据统计</div>
                          <div className="text-xs text-gray-400">学生、学校、老师数据概览</div>
                        </div>
                      </button>
                      <button
                        onClick={() => setSettingsModalInitTab('logs')}
                        className="flex items-center gap-4 p-4 bg-white border-2 border-gray-100 rounded-xl hover:border-purple-300 hover:bg-purple-50/50 transition text-left group"
                      >
                        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center group-hover:bg-purple-200 transition">
                          <FileText size={20} className="text-purple-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-800 text-sm">系统日志</div>
                          <div className="text-xs text-gray-400">查看操作日志和系统事件</div>
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
      {
        id: 'teacher3',
        email: 'zhang@school.com',
        password: 'zhang123',
        role: 'teacher',
        teacherId: 'teacher_3',
        name: '张老师',
        createdAt: new Date().toISOString()
      },
      // 学生账号
      {
        id: 'student1',
        email: 'zhangsan@student.jsa.com',
        password: 'stu2024001',
        role: 'student',
        studentId: '2024001',
        name: '张三',
        createdAt: new Date().toISOString()
      },    ];
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
      <ThemeProvider>
      <AppProvider>
        {user ? (
          <MainApp user={user} onLogout={handleLogout} allUsers={allUsers} setAllUsers={setAllUsers} studentList={studentList} setStudentList={setStudentList} />
        ) : (
          <AuthPage onLogin={handleLogin} allUsers={allUsers} studentList={studentList} />
        )}
      </AppProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default JapanStudyApp;
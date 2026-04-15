import React, { useState, useEffect } from 'react';
import {
  User, Save, Camera, Mail, Phone, MapPin, Lock, Check,
  GraduationCap, Calendar, Briefcase, Shield, BarChart3,
  Users, School, TrendingUp, CheckCircle, Clock, AlertCircle, PieChart, Plus,
  FileText, Search, Trash2, Download, Filter, ChevronDown, ChevronUp,
  RefreshCw, Link2, ArrowDownToLine, Eye, UserPlus
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { getLogs, clearLogs, filterLogs, LOG_LEVELS, LOG_CATEGORIES } from '../utils/logService';
import { studentsAPI, teachersAPI, usersAPI, xuebangAPI } from '../services/api';

const SettingsPage = ({ user, allUsers, setAllUsers, onLogout, initTab, onInitTabConsumed, studentList }) => {
  const { showNotification, apiRequest, loadStudentList, setUser } = useApp();
  const { isDark, tokens, glassEnabled } = useTheme();
  const [activeTab, setActiveTab] = useState('profile');

  // 从外部跳转时切换到指定tab
  useEffect(() => {
    if (initTab) {
      setActiveTab(initTab);
      if (onInitTabConsumed) onInitTabConsumed();
    }
  }, [initTab]);

  // 个人信息表单
  const [profileForm, setProfileForm] = useState({});
  const [profileDetails, setProfileDetails] = useState(() => {
    const saved = localStorage.getItem('profileDetails');
    return saved ? JSON.parse(saved) : {};
  });

  const getProfileKey = () => `${user.role}_${user.email}`;

  useEffect(() => {
    const key = getProfileKey();
    const saved = profileDetails[key] || {};
    setProfileForm({
      name: user.name || '',
      email: user.email || '',
      phone: saved.phone || '',
      address: saved.address || '',
      photo: saved.photo || '',
      birthday: saved.birthday || '',
      // 学生专属
      studentId: user.studentId || '',
      highSchool: saved.highSchool || '',
      languageSchool: saved.languageSchool || '',
      targetLevel: saved.targetLevel || '修士',
      // 老师专属
      department: saved.department || '',
      school: saved.school || '',
      faculty: saved.faculty || '',
      education: saved.education || '',
      subject: saved.subject || '',
      joinDate: saved.joinDate || '',
    });
  }, [user.email, user.role]);

  const handleSaveProfile = async () => {
    const key = getProfileKey();
    const newDetails = {
      ...profileDetails,
      [key]: {
        phone: profileForm.phone,
        address: profileForm.address,
        photo: profileForm.photo,
        birthday: profileForm.birthday,
        highSchool: profileForm.highSchool,
        languageSchool: profileForm.languageSchool,
        targetLevel: profileForm.targetLevel,
        department: profileForm.department,
        school: profileForm.school,
        faculty: profileForm.faculty,
        education: profileForm.education,
        subject: profileForm.subject,
        joinDate: profileForm.joinDate,
      }
    };
    setProfileDetails(newDetails);
    localStorage.setItem('profileDetails', JSON.stringify(newDetails));

    // 同步到后端数据库
    try {
      if (user.role === 'student' && user.studentId) {
        await studentsAPI.update(user.studentId, {
          name: profileForm.name,
          email: profileForm.email,
          birthday: profileForm.birthday,
          high_school: profileForm.highSchool,
          language_school: profileForm.languageSchool,
          phone: profileForm.phone,
          photo: profileForm.photo,
          subject: profileForm.subject,
        });
      } else if (user.role === 'teacher' && user.id) {
        await teachersAPI.update(user.id, {
          name: profileForm.name,
          email: profileForm.email,
          department: profileForm.department,
          subject: profileForm.subject,
          phone: profileForm.phone,
          address: profileForm.address,
          education: profileForm.education,
          hire_date: profileForm.joinDate,
          photo: profileForm.photo,
          birthday: profileForm.birthday,
        });
      } else if (user.role === 'admin' && user.id) {
        // 管理员通过 users API 更新（使用 apiRequest 直接调用）
        await apiRequest(`/users/${user.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: profileForm.name,
          }),
        });
      }
    } catch (err) {
      console.error('同步个人信息到后端失败:', err);
      if (showNotification) showNotification('后端同步失败，但本地已保存', 'warn');
    }

    // 更新 allUsers 中的名字
    if (profileForm.name !== user.name) {
      setAllUsers(prev => prev.map(u =>
        u.email === user.email && u.role === user.role ? { ...u, name: profileForm.name } : u
      ));
      // 同步更新当前登录用户的 name（侧边栏、Header 等处立即生效）
      const updatedUser = { ...user, name: profileForm.name };
      setUser(updatedUser);
      sessionStorage.setItem('user', JSON.stringify(updatedUser));
    }
    // 刷新学生列表，确保学生信息页面显示最新名字
    if (loadStudentList) {
      loadStudentList();
    }
    if (showNotification) showNotification('个人信息已保存');
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setProfileForm({ ...profileForm, photo: reader.result });
      reader.readAsDataURL(file);
    }
  };

  // 修改密码
  const [passwordForm, setPasswordForm] = useState({ current: '', newPwd: '', confirm: '' });
  const [pwdErrors, setPwdErrors] = useState({});
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);

  const handleChangePassword = async () => {
    const errors = {};
    if (!passwordForm.current) errors.current = '请输入当前密码';
    if (!passwordForm.newPwd) errors.newPwd = '请输入新密码';
    else if (passwordForm.newPwd.length < 6) errors.newPwd = '密码至少6位';
    if (passwordForm.newPwd !== passwordForm.confirm) errors.confirm = '两次输入不一致';

    if (Object.keys(errors).length > 0) { setPwdErrors(errors); return; }

    setPwdLoading(true);
    try {
      await apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          oldPassword: passwordForm.current,
          newPassword: passwordForm.newPwd,
        }),
      });
      setPwdSuccess(true);
      setTimeout(() => {
        setPwdSuccess(false);
        setPasswordForm({ current: '', newPwd: '', confirm: '' });
        setPwdErrors({});
      }, 2000);
      if (showNotification) showNotification('密码修改成功');
    } catch (err) {
      setPwdErrors({ current: err.message || '密码修改失败，请重试' });
    } finally {
      setPwdLoading(false);
    }
  };

  const tabs = [
    { id: 'profile', label: '个人信息', icon: User },
    { id: 'security', label: '安全设置', icon: Lock },
    ...(user.role === 'admin' ? [{ id: 'analytics', label: '数据统计', icon: BarChart3 }] : []),
    ...(user.role === 'admin' ? [{ id: 'logs', label: '系统日志', icon: FileText }] : []),
    ...(user.role === 'admin' ? [{ id: 'xuebang', label: '学邦同步', icon: Link2 }] : []),
  ];

  // === 数据统计逻辑（仅管理员）===
  const analyticsData = React.useMemo(() => {
    if (user.role !== 'admin') return null;

    const teachers = allUsers.filter(u => u.role === 'teacher');
    const students = studentList || [];

    // 从 localStorage 读取所有学生的学校数据
    const allSchoolApplications = [];
    const schoolStats = {}; // schoolName -> { total, not_started, preparing, applied, submitted, admitted, rejected }
    const teacherStudentCounts = {}; // teacherId -> count

    students.forEach(student => {
      // 统计老师名下学生
      const tid = student.teacherId || 'unassigned';
      teacherStudentCounts[tid] = (teacherStudentCounts[tid] || 0) + 1;

      try {
        const key = student.studentId || 'default';
        const savedData = localStorage.getItem(`studentData_${key}`);
        if (!savedData) return;
        const data = JSON.parse(savedData);
        const studentSchools = data.schools || [];
        studentSchools.forEach(school => {
          allSchoolApplications.push({ ...school, studentName: student.name, studentId: student.studentId });
          if (!schoolStats[school.name]) {
            schoolStats[school.name] = { total: 0, not_started: 0, preparing: 0, applied: 0, submitted: 0, admitted: 0, rejected: 0, type: school.type || '' };
          }
          schoolStats[school.name].total++;
          const status = school.status || 'preparing';
          if (schoolStats[school.name][status] !== undefined) {
            schoolStats[school.name][status]++;
          }
        });
      } catch {}
    });

    // 排序学校：按报考人数降序
    const sortedSchools = Object.entries(schoolStats)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.total - a.total);

    // 总体统计
    const totalApplications = allSchoolApplications.length;
    const totalAdmitted = allSchoolApplications.filter(a => a.status === 'admitted').length;
    const totalRejected = allSchoolApplications.filter(a => a.status === 'rejected').length;
    const totalSubmitted = allSchoolApplications.filter(a => a.status === 'submitted').length;
    const totalPreparing = allSchoolApplications.filter(a => a.status === 'preparing').length;
    const totalApplied = allSchoolApplications.filter(a => a.status === 'applied').length;
    const unassignedStudents = students.filter(s => !s.teacherId || s.teacherId === 'unassigned').length;

    // 学校信息库数据
    let schoolDbCount = 0;
    try {
      const savedDb = localStorage.getItem('schoolDatabase');
      if (savedDb) schoolDbCount = JSON.parse(savedDb).length;
    } catch {}

    return {
      totalStudents: students.length,
      totalTeachers: teachers.length,
      unassignedStudents,
      totalApplications,
      totalAdmitted,
      totalRejected,
      totalSubmitted,
      totalPreparing,
      totalApplied,
      admissionRate: totalApplications > 0 ? Math.round(totalAdmitted / totalApplications * 100) : 0,
      sortedSchools,
      teacherStudentCounts,
      teachers,
      schoolDbCount,
    };
  }, [user.role, allUsers, studentList]);

  return (
    <div className="space-y-4 p-4 animate-fade-in">
      <div className="flex gap-2 pb-2 overflow-x-auto" style={{ borderBottom: `1px solid ${tokens.colors.border.subtle}` }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition whitespace-nowrap"
              style={{
                background: isActive ? (isDark ? 'rgba(99,102,241,0.12)' : '#eff6ff') : 'transparent',
                color: isActive ? tokens.colors.accent.primary : tokens.colors.text.muted,
              }}>
              <Icon size={18} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* 个人信息 */}
      {activeTab === 'profile' && (
        <div className="glass-panel overflow-hidden">
          {/* 头部 */}
          <div className={`p-6 text-white bg-gradient-to-r ${
            user.role === 'admin' ? 'from-red-500 to-purple-500' :
            user.role === 'teacher' ? 'from-purple-500 to-blue-500' :
            'from-blue-500 to-purple-500'
          }`}>
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0">
                {profileForm.photo ? (
                  <img src={profileForm.photo} alt="" className="w-20 h-20 rounded-full object-cover border-4 border-white/30" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-3xl border-4 border-white/30">
                    {user.role === 'admin' ? '👑' : user.role === 'teacher' ? '👨‍🏫' : '👨‍🎓'}
                  </div>
                )}
                <label className="absolute bottom-0 right-0 p-1.5 bg-themed-surface rounded-full cursor-pointer shadow-lg">
                  <Camera size={14} className="text-themed-secondary" />
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                </label>
              </div>
              <div>
                <h3 className="text-xl font-bold">{profileForm.name}</h3>
                <p className="text-white/80 text-sm">{profileForm.email}</p>
                <span className="inline-block mt-1 px-2 py-0.5 bg-white/20 rounded text-xs">
                  {user.role === 'admin' ? '管理员' : user.role === 'teacher' ? '老师' : '学生'}
                </span>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* 基本信息 - 所有角色通用 */}
            <div>
              <h4 className="font-bold text-lg mb-4 flex items-center gap-2"><User size={20} /> 基本信息</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-themed-secondary mb-1">姓名</label>
                  <input type="text" value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-themed-secondary mb-1">邮箱</label>
                  <input type="email" value={profileForm.email} disabled
                    className="w-full px-3 py-2 border rounded-lg bg-themed-elevated text-themed-secondary" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-themed-secondary mb-1">生日</label>
                  <input type="date" value={profileForm.birthday} onChange={e => setProfileForm({...profileForm, birthday: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-themed-secondary mb-1">电话号码</label>
                  <input type="text" value={profileForm.phone} onChange={e => setProfileForm({...profileForm, phone: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="输入电话号码" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-themed-secondary mb-1">住址</label>
                  <input type="text" value={profileForm.address} onChange={e => setProfileForm({...profileForm, address: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="输入住址" />
                </div>
              </div>
            </div>

            {/* 学生专属 */}
            {user.role === 'student' && (
              <div>
                <h4 className="font-bold text-lg mb-4 flex items-center gap-2"><GraduationCap size={20} /> 学业信息</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-themed-secondary mb-1">学号</label>
                    <input type="text" value={profileForm.studentId} disabled
                      className="w-full px-3 py-2 border rounded-lg bg-themed-elevated text-themed-secondary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-themed-secondary mb-1">目标学位</label>
                    <select value={profileForm.targetLevel} onChange={e => setProfileForm({...profileForm, targetLevel: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                      <option value="学部">学部</option><option value="修士">修士</option><option value="博士">博士</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-themed-secondary mb-1">毕业高中</label>
                    <input type="text" value={profileForm.highSchool} onChange={e => setProfileForm({...profileForm, highSchool: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="输入毕业高中" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-themed-secondary mb-1">在读语言学校</label>
                    <input type="text" value={profileForm.languageSchool} onChange={e => setProfileForm({...profileForm, languageSchool: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="输入语言学校" />
                  </div>
                </div>
              </div>
            )}

            {/* 老师专属 */}
            {user.role === 'teacher' && (
              <div>
                <h4 className="font-bold text-lg mb-4 flex items-center gap-2"><Briefcase size={20} /> 职务信息</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-themed-secondary mb-1">所属部门</label>
                    <input type="text" value={profileForm.department} onChange={e => setProfileForm({...profileForm, department: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="例: 升学指导部" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-themed-secondary mb-1">毕业学校</label>
                    <input type="text" value={profileForm.school} onChange={e => setProfileForm({...profileForm, school: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-themed-secondary mb-1">学部/学科</label>
                    <input type="text" value={profileForm.faculty} onChange={e => setProfileForm({...profileForm, faculty: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-themed-secondary mb-1">最终学历</label>
                    <select value={profileForm.education} onChange={e => setProfileForm({...profileForm, education: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                      <option value="">请选择</option><option value="学士">学士</option><option value="硕士">硕士</option><option value="博士">博士</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-themed-secondary mb-1">文科/理科</label>
                    <select value={profileForm.subject} onChange={e => setProfileForm({...profileForm, subject: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                      <option value="">请选择</option><option value="文科">文科</option><option value="理科">理科</option><option value="文理兼修">文理兼修</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-themed-secondary mb-1">入职时间</label>
                    <input type="date" value={profileForm.joinDate} onChange={e => setProfileForm({...profileForm, joinDate: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>
            )}

            <button onClick={handleSaveProfile}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium">
              <Save size={18} /> 保存个人信息
            </button>
          </div>
        </div>
      )}

      {/* 数据统计（仅管理员） */}
      {activeTab === 'analytics' && user.role === 'admin' && analyticsData && (
        <div className="space-y-6">
          {/* 概览指标卡片 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)' }}>
                  <Users size={16} style={{ color: '#3b82f6' }} />
                </div>
                <span className="text-xs" style={{ color: tokens.colors.text.muted }}>学生总数</span>
              </div>
              <div className="text-2xl font-bold" style={{ color: tokens.colors.text.primary }}>{analyticsData.totalStudents}</div>
              {analyticsData.unassignedStudents > 0 && (
                <p className="text-xs mt-1" style={{ color: '#f97316' }}>{analyticsData.unassignedStudents} 人待分配</p>
              )}
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: isDark ? 'rgba(168,85,247,0.15)' : 'rgba(168,85,247,0.1)' }}>
                  <GraduationCap size={16} style={{ color: '#a855f7' }} />
                </div>
                <span className="text-xs" style={{ color: tokens.colors.text.muted }}>老师人数</span>
              </div>
              <div className="text-2xl font-bold" style={{ color: tokens.colors.text.primary }}>{analyticsData.totalTeachers}</div>
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)' }}>
                  <School size={16} style={{ color: '#22c55e' }} />
                </div>
                <span className="text-xs" style={{ color: tokens.colors.text.muted }}>报考总数</span>
              </div>
              <div className="text-2xl font-bold" style={{ color: tokens.colors.text.primary }}>{analyticsData.totalApplications}</div>
              <p className="text-xs mt-1" style={{ color: tokens.colors.text.muted }}>信息库 {analyticsData.schoolDbCount} 所</p>
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: isDark ? 'rgba(234,179,8,0.15)' : 'rgba(234,179,8,0.1)' }}>
                  <TrendingUp size={16} style={{ color: '#eab308' }} />
                </div>
                <span className="text-xs" style={{ color: tokens.colors.text.muted }}>合格率</span>
              </div>
              <div className="text-2xl font-bold" style={{ color: tokens.colors.text.primary }}>{analyticsData.admissionRate}%</div>
              <p className="text-xs mt-1" style={{ color: '#22c55e' }}>{analyticsData.totalAdmitted} 人合格</p>
            </div>
          </div>

          {/* 申请状态分布 */}
          <div className="glass-panel p-5">
            <h4 className="font-bold text-lg mb-4 flex items-center gap-2"><PieChart size={20} className="text-blue-500" /> 申请状态分布</h4>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="glass-card text-center p-4">
                <Clock size={24} className="mx-auto mb-2" style={{ color: '#3b82f6' }} />
                <div className="text-2xl font-bold" style={{ color: '#3b82f6' }}>{analyticsData.totalPreparing}</div>
                <div className="text-xs mt-1" style={{ color: tokens.colors.text.muted }}>准备中</div>
                {analyticsData.totalApplications > 0 && (
                  <div className="w-full rounded-full h-1.5 mt-2" style={{ background: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.2)' }}>
                    <div className="h-1.5 rounded-full" style={{width: `${Math.round(analyticsData.totalPreparing / analyticsData.totalApplications * 100)}%`, background: '#3b82f6'}} />
                  </div>
                )}
              </div>
              <div className="glass-card text-center p-4">
                <CheckCircle size={24} className="mx-auto mb-2" style={{ color: '#22c55e' }} />
                <div className="text-2xl font-bold" style={{ color: '#22c55e' }}>{analyticsData.totalApplied}</div>
                <div className="text-xs mt-1" style={{ color: tokens.colors.text.muted }}>出愿完成</div>
                {analyticsData.totalApplications > 0 && (
                  <div className="w-full rounded-full h-1.5 mt-2" style={{ background: isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.2)' }}>
                    <div className="h-1.5 rounded-full" style={{width: `${Math.round(analyticsData.totalApplied / analyticsData.totalApplications * 100)}%`, background: '#22c55e'}} />
                  </div>
                )}
              </div>
              <div className="glass-card text-center p-4">
                <AlertCircle size={24} className="mx-auto mb-2" style={{ color: '#f97316' }} />
                <div className="text-2xl font-bold" style={{ color: '#f97316' }}>{analyticsData.totalSubmitted}</div>
                <div className="text-xs mt-1" style={{ color: tokens.colors.text.muted }}>邮寄完成</div>
                {analyticsData.totalApplications > 0 && (
                  <div className="w-full rounded-full h-1.5 mt-2" style={{ background: isDark ? 'rgba(249,115,22,0.15)' : 'rgba(249,115,22,0.2)' }}>
                    <div className="h-1.5 rounded-full" style={{width: `${Math.round(analyticsData.totalSubmitted / analyticsData.totalApplications * 100)}%`, background: '#f97316'}} />
                  </div>
                )}
              </div>
              <div className="glass-card text-center p-4">
                <TrendingUp size={24} className="mx-auto mb-2" style={{ color: '#eab308' }} />
                <div className="text-2xl font-bold" style={{ color: '#eab308' }}>{analyticsData.totalAdmitted}</div>
                <div className="text-xs mt-1" style={{ color: tokens.colors.text.muted }}>合格</div>
                {analyticsData.totalApplications > 0 && (
                  <div className="w-full rounded-full h-1.5 mt-2" style={{ background: isDark ? 'rgba(234,179,8,0.15)' : 'rgba(234,179,8,0.2)' }}>
                    <div className="h-1.5 rounded-full" style={{width: `${Math.round(analyticsData.totalAdmitted / analyticsData.totalApplications * 100)}%`, background: '#eab308'}} />
                  </div>
                )}
              </div>
              <div className="glass-card text-center p-4">
                <AlertCircle size={24} className="mx-auto mb-2" style={{ color: '#ef4444' }} />
                <div className="text-2xl font-bold" style={{ color: '#ef4444' }}>{analyticsData.totalRejected || 0}</div>
                <div className="text-xs mt-1" style={{ color: tokens.colors.text.muted }}>未合格</div>
                {analyticsData.totalApplications > 0 && (
                  <div className="w-full rounded-full h-1.5 mt-2" style={{ background: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.2)' }}>
                    <div className="h-1.5 rounded-full" style={{width: `${Math.round((analyticsData.totalRejected || 0) / analyticsData.totalApplications * 100)}%`, background: '#ef4444'}} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 各学校报考情况 */}
          <div className="glass-panel p-5">
            <h4 className="font-bold text-lg mb-4 flex items-center gap-2"><School size={20} className="text-green-500" /> 各学校报考情况</h4>
            {analyticsData.sortedSchools.length > 0 ? (
              <div className="space-y-3">
                {analyticsData.sortedSchools.map((school, idx) => (
                  <div key={school.name} className="flex items-center gap-4 p-3 bg-themed-elevated rounded-lg hover:bg-themed-elevated transition">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-themed-primary truncate">{school.name}</span>
                        {school.type && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-themed-elevated text-themed-secondary rounded">{school.type}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <div className="flex-1 bg-themed-elevated rounded-full h-2 overflow-hidden">
                          <div className="h-2 rounded-full bg-gradient-to-r from-blue-400 via-purple-400 to-yellow-400"
                            style={{width: `${school.total > 0 ? Math.max(10, school.admitted / school.total * 100) : 0}%`}} />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs flex-shrink-0">
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)', color: '#3b82f6' }}>
                        {school.total}人报考
                      </span>
                      {school.admitted > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: isDark ? 'rgba(234,179,8,0.12)' : 'rgba(234,179,8,0.08)', color: '#eab308' }}>
                          {school.admitted}人合格
                        </span>
                      )}
                      {school.rejected > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
                          {school.rejected}人未合格
                        </span>
                      )}
                      {school.submitted > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: isDark ? 'rgba(249,115,22,0.12)' : 'rgba(249,115,22,0.08)', color: '#f97316' }}>
                          {school.submitted}人邮寄
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-themed-muted">
                <School size={32} className="mx-auto mb-2 text-themed-muted" />
                <p>暂无报考数据</p>
                <p className="text-xs mt-1">学生添加志愿学校后将在此显示统计</p>
              </div>
            )}
          </div>

          {/* 老师名下学生分布 */}
          <div className="glass-panel p-5">
            <h4 className="font-bold text-lg mb-4 flex items-center gap-2"><Users size={20} className="text-purple-500" /> 老师名下学生分布</h4>
            <div className="space-y-3">
              {analyticsData.teachers.map(teacher => {
                const count = analyticsData.teacherStudentCounts[teacher.teacherId] || 0;
                const maxCount = Math.max(...Object.values(analyticsData.teacherStudentCounts), 1);
                return (
                  <div key={teacher.email} className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg" style={{ background: isDark ? 'rgba(168,85,247,0.15)' : 'rgba(168,85,247,0.1)' }}>👨‍🏫</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-themed-primary text-sm truncate">{teacher.name}</span>
                        <span className="text-sm font-bold text-purple-600">{count} 人</span>
                      </div>
                      <div className="w-full rounded-full h-2" style={{ background: isDark ? 'rgba(168,85,247,0.15)' : 'rgba(168,85,247,0.2)' }}>
                        <div className="h-2 rounded-full transition-all" style={{ background: '#a855f7', width: `${(count / maxCount) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
              {analyticsData.unassignedStudents > 0 && (
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg" style={{ background: isDark ? 'rgba(249,115,22,0.15)' : 'rgba(249,115,22,0.1)' }}>❓</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-orange-600 text-sm">待分配</span>
                      <span className="text-sm font-bold text-orange-600">{analyticsData.unassignedStudents} 人</span>
                    </div>
                    <div className="w-full rounded-full h-2" style={{ background: isDark ? 'rgba(249,115,22,0.15)' : 'rgba(249,115,22,0.2)' }}>
                      <div className="h-2 rounded-full transition-all" style={{ background: '#f97316', width: `${(analyticsData.unassignedStudents / Math.max(...Object.values(analyticsData.teacherStudentCounts), 1)) * 100}%` }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 系统日志（仅管理员） */}
      {activeTab === 'logs' && user.role === 'admin' && <LogsPanel />}

      {/* 学邦同步（仅管理员） */}
      {activeTab === 'xuebang' && user.role === 'admin' && <XuebangSyncPanel />}

      {/* 安全设置 */}
      {activeTab === 'security' && (
        <div className="glass-panel p-6">
          <h4 className="font-bold text-lg mb-6 flex items-center gap-2"><Lock size={20} /> 修改密码</h4>
          {pwdSuccess ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)' }}>
                <Check size={32} className="text-green-600" />
              </div>
              <p className="text-green-600 font-semibold">密码修改成功！</p>
            </div>
          ) : (
            <div className="max-w-md space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">当前密码</label>
                <input type="password" value={passwordForm.current} onChange={e => setPasswordForm({...passwordForm, current: e.target.value})}
                  className={`w-full px-3 py-2 border rounded-lg ${pwdErrors.current ? 'border-red-500' : ''}`} placeholder="输入当前密码" />
                {pwdErrors.current && <p className="text-red-500 text-xs mt-1">{pwdErrors.current}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">新密码</label>
                <input type="password" value={passwordForm.newPwd} onChange={e => setPasswordForm({...passwordForm, newPwd: e.target.value})}
                  className={`w-full px-3 py-2 border rounded-lg ${pwdErrors.newPwd ? 'border-red-500' : ''}`} placeholder="至少6位" />
                {pwdErrors.newPwd && <p className="text-red-500 text-xs mt-1">{pwdErrors.newPwd}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">确认新密码</label>
                <input type="password" value={passwordForm.confirm} onChange={e => setPasswordForm({...passwordForm, confirm: e.target.value})}
                  className={`w-full px-3 py-2 border rounded-lg ${pwdErrors.confirm ? 'border-red-500' : ''}`} placeholder="再次输入新密码" />
                {pwdErrors.confirm && <p className="text-red-500 text-xs mt-1">{pwdErrors.confirm}</p>}
              </div>
              <button onClick={handleChangePassword} disabled={pwdLoading}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium disabled:opacity-50">
                <Lock size={18} /> {pwdLoading ? '修改中...' : '确认修改'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// === 学邦数据同步面板组件（管理员专用）===
const XuebangSyncPanel = () => {
  const { isDark, tokens } = useTheme();
  const { showNotification } = useApp();
  const [loading, setLoading] = useState(false);
  const [configData, setConfigData] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [syncLogs, setSyncLogs] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showPreview, setShowPreview] = useState(false);
  const [teacherList, setTeacherList] = useState([]);
  const [defaultTeacherId, setDefaultTeacherId] = useState('');

  // 加载初始数据
  useEffect(() => {
    loadConfig();
    loadSyncLogs();
    loadTeachers();
  }, []);

  const loadConfig = async () => {
    try {
      const data = await xuebangAPI.getConfig();
      setConfigData(data);
    } catch (err) {
      console.error('加载学邦配置失败:', err);
    }
  };

  const loadSyncLogs = async () => {
    try {
      const data = await xuebangAPI.getSyncLogs();
      setSyncLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('加载同步日志失败:', err);
    }
  };

  const loadTeachers = async () => {
    try {
      const data = await teachersAPI.getAll();
      setTeacherList(Array.isArray(data) ? data : []);
    } catch {}
  };

  // 预览学邦数据
  const handlePreview = async () => {
    setLoading(true);
    try {
      const data = await xuebangAPI.preview();
      setPreviewData(data);
      setShowPreview(true);
      // 默认全选新学生
      setSelectedIds(new Set((data.newStudents || []).map(s => s.xuebangId)));
    } catch (err) {
      showNotification('获取学邦数据失败: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // 执行同步
  const handleSync = async () => {
    if (selectedIds.size === 0) {
      showNotification('请选择要同步的学生', 'error');
      return;
    }
    if (!window.confirm(`确定要同步 ${selectedIds.size} 名学生到 JSA 系统吗？`)) return;
    setSyncing(true);
    try {
      const result = await xuebangAPI.sync({
        selectedIds: Array.from(selectedIds),
        defaultTeacherId,
      });
      showNotification(result.message || `成功同步 ${result.syncedCount} 名学生`, 'success');
      setShowPreview(false);
      setPreviewData(null);
      loadConfig();
      loadSyncLogs();
    } catch (err) {
      showNotification('同步失败: ' + err.message, 'error');
    } finally {
      setSyncing(false);
    }
  };

  // 刷新已关联学生信息
  const handleRefresh = async () => {
    if (!window.confirm('确定要从学邦刷新所有已关联学生的信息吗？（会更新姓名、电话、生日等基础信息）')) return;
    setRefreshing(true);
    try {
      const result = await xuebangAPI.refresh();
      showNotification(result.message || '刷新完成', 'success');
    } catch (err) {
      showNotification('刷新失败: ' + err.message, 'error');
    } finally {
      setRefreshing(false);
    }
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (!previewData?.newStudents) return;
    if (selectedIds.size === previewData.newStudents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(previewData.newStudents.map(s => s.xuebangId)));
    }
  };

  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  return (
    <div className="space-y-6">
      {/* 标题 + 状态 */}
      <div className="glass-panel p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <h4 className="font-bold text-lg flex items-center gap-2" style={{ color: tokens.colors.text.primary }}>
              <Link2 size={20} className="text-blue-500" /> 学邦数据同步
            </h4>
            <p className="text-sm mt-1" style={{ color: tokens.colors.text.muted }}>
              从学邦系统同步学生数据到 JSA，学邦注册的学生可直接在 JSA 登录
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleRefresh} disabled={refreshing || !configData?.configured}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
              style={{ background: isDark ? 'rgba(168,85,247,0.12)' : 'rgba(168,85,247,0.08)', color: '#a855f7' }}>
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> {refreshing ? '刷新中...' : '刷新已关联'}
            </button>
            <button onClick={handlePreview} disabled={loading || !configData?.configured}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
              style={{ background: isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)', color: '#3b82f6' }}>
              <ArrowDownToLine size={16} className={loading ? 'animate-bounce' : ''} /> {loading ? '获取中...' : '获取学邦数据'}
            </button>
          </div>
        </div>

        {/* 配置状态卡片 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb' }}>
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-2.5 h-2.5 rounded-full ${configData?.configured ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-xs font-medium" style={{ color: tokens.colors.text.muted }}>连接状态</span>
            </div>
            <p className="font-semibold" style={{ color: tokens.colors.text.primary }}>
              {configData?.configured ? '✅ 已配置' : '❌ 未配置 Token'}
            </p>
            {!configData?.configured && (
              <p className="text-xs mt-1" style={{ color: '#f97316' }}>
                请在 Workers Secrets 中设置 XUEBANG_TOKEN
              </p>
            )}
          </div>
          <div className="p-4 rounded-lg" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb' }}>
            <span className="text-xs font-medium" style={{ color: tokens.colors.text.muted }}>上次同步</span>
            <p className="font-semibold" style={{ color: tokens.colors.text.primary }}>
              {configData?.lastSyncTime
                ? new Date(configData.lastSyncTime).toLocaleString('zh-CN')
                : '从未同步'}
            </p>
          </div>
          <div className="p-4 rounded-lg" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb' }}>
            <span className="text-xs font-medium" style={{ color: tokens.colors.text.muted }}>上次同步结果</span>
            <p className="font-semibold" style={{ color: tokens.colors.text.primary }}>
              {configData?.lastSyncResult === 'success' ? '✅ 成功' :
               configData?.lastSyncResult === 'partial' ? '⚠️ 部分成功' :
               configData?.lastSyncResult === 'error' ? '❌ 失败' : '—'}
              {configData?.lastSyncCount > 0 && ` (${configData.lastSyncCount} 人)`}
            </p>
          </div>
        </div>
      </div>

      {/* 预览面板 */}
      {showPreview && previewData && (
        <div className="glass-panel p-5">
          <div className="flex items-center justify-between mb-4">
            <h5 className="font-bold text-base flex items-center gap-2" style={{ color: tokens.colors.text.primary }}>
              <Eye size={18} className="text-blue-500" /> 数据预览
              <span className="text-xs font-normal px-2 py-0.5 rounded-full" style={{ background: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
                共 {previewData.total} 人
              </span>
            </h5>
            <button onClick={() => setShowPreview(false)}
              className="text-xs px-3 py-1 rounded-lg transition"
              style={{ color: tokens.colors.text.muted, background: isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6' }}>
              关闭预览
            </button>
          </div>

          {/* 统计概览 */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-3 rounded-lg flex items-center gap-3"
              style={{ background: isDark ? 'rgba(34,197,94,0.08)' : 'rgba(34,197,94,0.05)' }}>
              <UserPlus size={20} className="text-green-500" />
              <div>
                <p className="text-lg font-bold text-green-600">{previewData.newCount}</p>
                <p className="text-xs" style={{ color: tokens.colors.text.muted }}>新增学生</p>
              </div>
            </div>
            <div className="p-3 rounded-lg flex items-center gap-3"
              style={{ background: isDark ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.05)' }}>
              <Link2 size={20} className="text-blue-500" />
              <div>
                <p className="text-lg font-bold text-blue-600">{previewData.existingCount}</p>
                <p className="text-xs" style={{ color: tokens.colors.text.muted }}>已关联学生</p>
              </div>
            </div>
          </div>

          {/* 分配老师选择 */}
          {previewData.newCount > 0 && (
            <div className="mb-4 p-3 rounded-lg" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb' }}>
              <label className="text-sm font-medium flex items-center gap-2 mb-2" style={{ color: tokens.colors.text.secondary }}>
                <GraduationCap size={16} /> 分配到老师（可选）
              </label>
              <select value={defaultTeacherId} onChange={e => setDefaultTeacherId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', color: tokens.colors.text.primary, border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#d1d5db'}` }}>
                <option value="">不分配（待分配）</option>
                {teacherList.map(t => (
                  <option key={t.teacherId || t.teacher_id} value={t.teacherId || t.teacher_id}>
                    {t.name} {t.department ? `(${t.department})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 新增学生列表 */}
          {previewData.newCount > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h6 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#22c55e' }}>
                  <UserPlus size={16} /> 待导入的新学生 ({previewData.newCount})
                </h6>
                <button onClick={toggleSelectAll}
                  className="text-xs px-3 py-1 rounded-lg transition"
                  style={{ background: isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)', color: '#3b82f6' }}>
                  {selectedIds.size === previewData.newStudents.length ? '取消全选' : '全选'}
                </button>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {previewData.newStudents.map(s => (
                  <label key={s.xuebangId}
                    className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition"
                    style={{ background: selectedIds.has(s.xuebangId)
                      ? (isDark ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.05)')
                      : (isDark ? 'rgba(255,255,255,0.03)' : '#fff'),
                      border: `1px solid ${selectedIds.has(s.xuebangId)
                        ? (isDark ? 'rgba(59,130,246,0.3)' : '#93c5fd')
                        : (isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb')}`,
                    }}>
                    <input type="checkbox" checked={selectedIds.has(s.xuebangId)}
                      onChange={() => toggleSelect(s.xuebangId)}
                      className="w-4 h-4 rounded accent-blue-500" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm" style={{ color: tokens.colors.text.primary }}>{s.name}</span>
                        {s.studentNo && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6', color: tokens.colors.text.muted }}>学号: {s.studentNo}</span>}
                        {s.statusName && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: isDark ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.08)', color: '#22c55e' }}>{s.statusName}</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: tokens.colors.text.muted }}>
                        {s.contact && <span>📞 {s.contact}</span>}
                        {s.birthday && <span>🎂 {s.birthday}</span>}
                        {s.gradeName && <span>📚 {s.gradeName}</span>}
                        {s.campusName && <span>🏫 {s.campusName}</span>}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* 已关联学生列表 */}
          {previewData.existingCount > 0 && (
            <div className="mb-4">
              <h6 className="text-sm font-semibold flex items-center gap-2 mb-2" style={{ color: '#3b82f6' }}>
                <Link2 size={16} /> 已关联学生 ({previewData.existingCount})
              </h6>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {previewData.existingMatches.map(s => (
                  <div key={s.xuebangId} className="flex items-center gap-3 p-2 rounded-lg text-sm"
                    style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb' }}>
                    <CheckCircle size={16} className="text-blue-500 flex-shrink-0" />
                    <span style={{ color: tokens.colors.text.primary }}>{s.xuebangName}</span>
                    <span className="text-xs" style={{ color: tokens.colors.text.muted }}>→ JSA: {s.jsaName} ({s.jsaStudentId})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 同步按钮 */}
          {previewData.newCount > 0 && (
            <div className="flex items-center justify-between pt-3" style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}` }}>
              <span className="text-sm" style={{ color: tokens.colors.text.muted }}>
                已选择 <strong style={{ color: '#3b82f6' }}>{selectedIds.size}</strong> / {previewData.newCount} 名学生
              </span>
              <button onClick={handleSync} disabled={syncing || selectedIds.size === 0}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition disabled:opacity-50"
                style={{ background: syncing ? '#6b7280' : '#3b82f6' }}>
                <ArrowDownToLine size={16} className={syncing ? 'animate-bounce' : ''} />
                {syncing ? '同步中...' : `同步 ${selectedIds.size} 名学生`}
              </button>
            </div>
          )}

          {previewData.newCount === 0 && (
            <div className="text-center py-6" style={{ color: tokens.colors.text.muted }}>
              <CheckCircle size={32} className="mx-auto mb-2 text-green-500" />
              <p className="font-medium">所有学邦学生已同步到 JSA</p>
              <p className="text-xs mt-1">没有需要导入的新学生</p>
            </div>
          )}
        </div>
      )}

      {/* 同步历史 */}
      <div className="glass-panel p-5">
        <h5 className="font-bold text-base flex items-center gap-2 mb-4" style={{ color: tokens.colors.text.primary }}>
          <Clock size={18} className="text-purple-500" /> 同步历史
        </h5>
        {syncLogs.length > 0 ? (
          <div className="space-y-2">
            {syncLogs.map((log, i) => (
              <div key={log.id || i} className="flex items-center gap-3 p-3 rounded-lg text-sm"
                style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb' }}>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  log.result === 'success' ? 'bg-green-500' :
                  log.result === 'partial' ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <span style={{ color: tokens.colors.text.primary }}>{log.message}</span>
                  <span className="text-xs ml-2" style={{ color: tokens.colors.text.muted }}>
                    同步 {log.synced_count} 人
                  </span>
                </div>
                <span className="text-xs flex-shrink-0" style={{ color: tokens.colors.text.muted }}>
                  {log.synced_at ? new Date(log.synced_at).toLocaleString('zh-CN') : ''}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8" style={{ color: tokens.colors.text.muted }}>
            <Clock size={32} className="mx-auto mb-2" />
            <p>暂无同步记录</p>
          </div>
        )}
      </div>

      {/* 使用说明 */}
      <div className="glass-panel p-5">
        <h5 className="font-bold text-base flex items-center gap-2 mb-3" style={{ color: tokens.colors.text.primary }}>
          <AlertCircle size={18} className="text-orange-500" /> 使用说明
        </h5>
        <div className="space-y-2 text-sm" style={{ color: tokens.colors.text.secondary }}>
          <p>1. 首次使用需要在 Cloudflare Workers Secrets 中配置 <code className="px-1.5 py-0.5 rounded text-xs" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6' }}>XUEBANG_TOKEN</code>（学邦系统 API Token）</p>
          <p>2. 点击「获取学邦数据」预览学邦系统中的学生列表，勾选要导入的学生后执行同步</p>
          <p>3. 同步会在 JSA 的 students 表中创建对应记录，学号使用学邦学号</p>
          <p>4. 同步后的学生需要在 JSA 中注册账号才能登录（使用学邦学号作为 student_id 注册）</p>
          <p>5. 「刷新已关联」会从学邦拉取最新的姓名、电话、生日等信息更新到 JSA</p>
        </div>
      </div>
    </div>
  );
};

// === 账号管理面板组件（管理员专用）===
const AccountManagementPanel = ({ allUsers, setAllUsers, user }) => {
  const { isDark, tokens } = useTheme();
  const { showNotification } = useApp();
  const [accountList, setAccountList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '' });
  const [creating, setCreating] = useState(false);

  // 加载用户列表
  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const data = await usersAPI.getAll();
      setAccountList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('加载用户列表失败:', err);
      if (showNotification) showNotification('加载用户列表失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (userId, currentName) => {
    const target = accountList.find(u => u.id === userId);
    const action = target?.is_active ? '禁用' : '启用';
    if (!window.confirm(`确定要${action}用户「${currentName}」的账号吗？`)) return;

    try {
      await usersAPI.toggleActive(userId);
      setAccountList(prev => prev.map(u =>
        u.id === userId ? { ...u, is_active: u.is_active ? 0 : 1 } : u
      ));
      if (showNotification) showNotification(`已${action}「${currentName}」的账号`);
    } catch (err) {
      console.error('操作失败:', err);
      if (showNotification) showNotification(`${action}失败: ${err.message}`, 'error');
    }
  };

  const handleCreateAdmin = async () => {
    if (!createForm.name || !createForm.email || !createForm.password) {
      if (showNotification) showNotification('请填写所有字段', 'error');
      return;
    }
    if (createForm.password.length < 6) {
      if (showNotification) showNotification('密码至少6位', 'error');
      return;
    }

    setCreating(true);
    try {
      const result = await usersAPI.createAdmin(createForm);
      if (showNotification) showNotification('管理员账号已创建');
      setCreateForm({ name: '', email: '', password: '' });
      setShowCreateAdmin(false);
      loadAccounts();
    } catch (err) {
      console.error('创建管理员失败:', err);
      if (showNotification) showNotification(`创建失败: ${err.message}`, 'error');
    } finally {
      setCreating(false);
    }
  };

  const filteredAccounts = accountList.filter(u => {
    const matchSearch = !searchQuery ||
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchRole = filterRole === 'all' || u.role === filterRole;
    return matchSearch && matchRole;
  });

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin': return '管理员';
      case 'teacher': return '老师';
      case 'student': return '学生';
      default: return role;
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return '#ef4444';
      case 'teacher': return '#a855f7';
      case 'student': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  return (
    <div className="space-y-6">
      {/* 工具栏 */}
      <div className="glass-panel p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h4 className="font-bold text-lg flex items-center gap-2" style={{ color: tokens.colors.text.primary }}>
            <Users size={20} className="text-blue-500" /> 账号管理
            <span className="text-sm font-normal" style={{ color: tokens.colors.text.muted }}>({accountList.length} 个账号)</span>
          </h4>
          <button
            onClick={() => setShowCreateAdmin(!showCreateAdmin)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition"
            style={{ background: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)', color: '#ef4444' }}
          >
            <Plus size={16} /> 创建管理员账号
          </button>
        </div>

        {/* 搜索和筛选 */}
        <div className="flex flex-col sm:flex-row gap-3 mt-3">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: tokens.colors.text.muted }} />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索姓名或邮箱..."
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
              style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', color: tokens.colors.text.primary, borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#d1d5db' }} />
          </div>
          <div className="flex gap-2">
            {['all', 'student', 'teacher', 'admin'].map(role => (
              <button key={role} onClick={() => setFilterRole(role)}
                className="px-3 py-2 rounded-lg text-xs font-medium transition"
                style={{
                  background: filterRole === role ? (isDark ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.1)') : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                  color: filterRole === role ? '#3b82f6' : tokens.colors.text.secondary,
                }}>
                {role === 'all' ? '全部' : getRoleLabel(role)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 创建管理员表单 */}
      {showCreateAdmin && (
        <div className="glass-panel p-6">
          <h5 className="font-semibold text-base mb-4 flex items-center gap-2" style={{ color: tokens.colors.text.primary }}>
            <Shield size={18} className="text-red-500" /> 创建新管理员账号
          </h5>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: tokens.colors.text.secondary }}>姓名</label>
              <input type="text" value={createForm.name} onChange={e => setCreateForm({...createForm, name: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="管理员姓名"
                style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', color: tokens.colors.text.primary, borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#d1d5db' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: tokens.colors.text.secondary }}>邮箱</label>
              <input type="email" value={createForm.email} onChange={e => setCreateForm({...createForm, email: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="admin@example.com"
                style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', color: tokens.colors.text.primary, borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#d1d5db' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: tokens.colors.text.secondary }}>密码（至少6位）</label>
              <input type="password" value={createForm.password} onChange={e => setCreateForm({...createForm, password: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="初始密码"
                style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', color: tokens.colors.text.primary, borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#d1d5db' }} />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleCreateAdmin} disabled={creating}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition disabled:opacity-50">
              {creating ? '创建中...' : '确认创建'}
            </button>
            <button onClick={() => setShowCreateAdmin(false)}
              className="px-4 py-2 rounded-lg text-sm transition"
              style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6', color: tokens.colors.text.secondary }}>
              取消
            </button>
          </div>
        </div>
      )}

      {/* 用户列表 */}
      <div className="glass-panel overflow-hidden">
        {loading ? (
          <div className="text-center py-12" style={{ color: tokens.colors.text.muted }}>加载中...</div>
        ) : filteredAccounts.length > 0 ? (
          <div className="divide-y" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb' }}>
            {filteredAccounts.map(account => (
              <div key={account.id} className="flex items-center gap-4 px-5 py-3 transition"
                style={{ ':hover': { background: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb' } }}
                onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0"
                  style={{ background: `${getRoleColor(account.role)}20`, color: getRoleColor(account.role) }}>
                  {account.name?.charAt(0) || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate" style={{ color: tokens.colors.text.primary }}>{account.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{ background: `${getRoleColor(account.role)}15`, color: getRoleColor(account.role) }}>
                      {getRoleLabel(account.role)}
                    </span>
                    {!account.is_active && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ background: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                        已禁用
                      </span>
                    )}
                  </div>
                  <div className="text-xs truncate" style={{ color: tokens.colors.text.muted }}>{account.email}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {account.id !== user.id && (
                    <button
                      onClick={() => handleToggleActive(account.id, account.name)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition"
                      style={{
                        background: account.is_active
                          ? (isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)')
                          : (isDark ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.08)'),
                        color: account.is_active ? '#ef4444' : '#22c55e',
                      }}
                    >
                      {account.is_active ? '禁用' : '启用'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12" style={{ color: tokens.colors.text.muted }}>
            <Users size={32} className="mx-auto mb-2" />
            <p>没有匹配的用户</p>
          </div>
        )}
      </div>
    </div>
  );
};

// === 数据迁移面板组件（管理员专用）===
const MigrationPanel = () => {
  const { isDark, tokens } = useTheme();
  const [stats, setStats] = useState(null);
  const [migrating, setMigrating] = useState(false);
  const [progress, setProgress] = useState('');
  const [report, setReport] = useState(null);
  const { showNotification } = useApp();

  const loadStats = () => {
    try {
      const s = getMigrationStats();
      setStats(s);
    } catch (e) {
      setStats({ students: 0, schools: 0, events: 0, materials: 0, feedbacks: 0 });
    }
  };

  React.useEffect(() => { loadStats(); }, []);

  const handleMigrate = async (dryRun) => {
    setMigrating(true);
    setReport(null);
    setProgress(dryRun ? '正在统计待迁移数据...' : '正在迁移数据，请勿关闭页面...');
    try {
      const result = await runMigration({
        dryRun,
        onProgress: (msg) => setProgress(msg),
      });
      setReport(result);
      if (!dryRun) {
        showNotification('数据迁移完成！');
        loadStats();
      }
    } catch (e) {
      setProgress(`迁移失败: ${e.message}`);
      showNotification(`迁移失败: ${e.message}`);
    } finally {
      setMigrating(false);
    }
  };

  const statItems = [
    { label: '学生', value: stats?.students ?? '-', color: '#6366f1' },
    { label: '学校申请', value: stats?.schools ?? '-', color: '#10b981' },
    { label: '时间线事件', value: stats?.events ?? '-', color: '#f59e0b' },
    { label: '材料清单', value: stats?.materials ?? '-', color: '#8b5cf6' },
    { label: '反馈记录', value: stats?.feedbacks ?? '-', color: '#ec4899' },
  ];

  return (
    <div className="glass-panel p-6 space-y-6">
      <div>
        <h4 className="font-bold text-lg mb-1 flex items-center gap-2" style={{ color: tokens.colors.text.primary }}>
          <Download size={20} /> 数据迁移
        </h4>
        <p className="text-sm" style={{ color: tokens.colors.text.muted }}>
          将浏览器 localStorage 中的数据迁移到后端数据库，实现跨设备同步和数据持久化。
        </p>
      </div>

      {/* 待迁移数据统计 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium" style={{ color: tokens.colors.text.secondary }}>localStorage 中的数据</span>
          <button onClick={loadStats} className="text-xs px-2 py-1 rounded"
            style={{ background: 'rgba(99,102,241,0.1)', color: tokens.colors.accent.primary }}>
            刷新统计
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {statItems.map(item => (
            <div key={item.label} className="glass-card p-3 text-center">
              <div className="text-2xl font-bold" style={{ color: item.color }}>{item.value}</div>
              <div className="text-xs mt-1" style={{ color: tokens.colors.text.muted }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 迁移操作 */}
      <div className="space-y-3">
        <div className="p-4 rounded-lg" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <p className="text-sm font-medium mb-1" style={{ color: '#f59e0b' }}>⚠️ 迁移前注意事项</p>
          <ul className="text-xs space-y-1" style={{ color: tokens.colors.text.muted }}>
            <li>• 请确保已登录管理员账号（需要有效 JWT Token）</li>
            <li>• 建议先使用「演练模式」确认数据量，再执行正式迁移</li>
            <li>• 迁移过程中请勿关闭页面或刷新浏览器</li>
            <li>• 迁移完成后，localStorage 数据不会自动删除（可手动清理）</li>
          </ul>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => handleMigrate(true)}
            disabled={migrating}
            className="flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all"
            style={{ background: 'rgba(99,102,241,0.1)', color: tokens.colors.accent.primary, border: '1px solid rgba(99,102,241,0.2)' }}
          >
            {migrating ? '处理中...' : '🔍 演练模式（仅统计）'}
          </button>
          <button
            onClick={() => {
              if (window.confirm('确认将 localStorage 数据迁移到后端数据库？此操作不可撤销。')) {
                handleMigrate(false);
              }
            }}
            disabled={migrating}
            className="flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all"
            style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}
          >
            {migrating ? '迁移中...' : '🚀 正式迁移'}
          </button>
        </div>
      </div>

      {/* 进度和报告 */}
      {(migrating || progress) && (
        <div className="p-4 rounded-lg" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
          <p className="text-sm" style={{ color: tokens.colors.text.secondary }}>{progress}</p>
        </div>
      )}

      {report && (
        <div className="p-4 rounded-lg space-y-2" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
          <p className="text-sm font-medium" style={{ color: '#10b981' }}>📊 迁移报告</p>
          {[
            { label: '学生', r: report.students },
            { label: '学校申请', r: report.schools },
            { label: '时间线事件', r: report.events },
            { label: '材料清单', r: report.materials },
          ].map(({ label, r }) => (
            <div key={label} className="flex justify-between text-xs" style={{ color: tokens.colors.text.muted }}>
              <span>{label}</span>
              <span style={{ color: r.failed > 0 ? '#ef4444' : '#10b981' }}>
                {r.success}/{r.total} 成功{r.failed > 0 ? `，${r.failed} 失败` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// === 日志面板组件 ===
const LogsPanel = () => {
  const { isDark, tokens } = useTheme();
  const [logs, setLogs] = useState([]);
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  useEffect(() => {
    refreshLogs();
  }, [filterLevel, filterCategory, searchQuery, dateFrom, dateTo]);

  const refreshLogs = () => {
    const filtered = filterLogs({
      level: filterLevel,
      category: filterCategory,
      search: searchQuery,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
    setLogs(filtered);
    setPage(1);
  };

  const handleClearLogs = () => {
    if (window.confirm('确定要清空所有日志吗？此操作不可恢复。')) {
      clearLogs();
      refreshLogs();
    }
  };

  const handleExportLogs = () => {
    const data = JSON.stringify(logs, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system_logs_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLevelStyle = (level) => {
    const styles = {
      info: { background: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)', color: '#3b82f6' },
      warn: { background: isDark ? 'rgba(234,179,8,0.15)' : 'rgba(234,179,8,0.1)', color: '#eab308' },
      error: { background: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)', color: '#ef4444' },
      action: { background: isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)', color: '#22c55e' },
    };
    return styles[level] || { background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', color: tokens.colors.text.primary };
  };

  const getLevelLabel = (level) => {
    switch (level) {
      case 'info': return '信息';
      case 'warn': return '警告';
      case 'error': return '错误';
      case 'action': return '操作';
      default: return level;
    }
  };

  const formatTime = (ts) => {
    try {
      const d = new Date(ts);
      return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch { return ts; }
  };

  const paginatedLogs = logs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(logs.length / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="glass-panel p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h4 className="font-bold text-lg flex items-center gap-2">
              <FileText size={20} className="text-blue-500" /> 系统日志
            </h4>
            <span className="text-xs text-themed-muted">{logs.length} 条记录</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1 px-3 py-1.5 border rounded-lg text-sm hover:bg-themed-elevated">
              <Filter size={14} /> 筛选 {showFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            <button onClick={handleExportLogs}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition"
              style={{ background: isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)', color: '#3b82f6' }}>
              <Download size={14} /> 导出
            </button>
            <button onClick={handleClearLogs}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition"
              style={{ background: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
              <Trash2 size={14} /> 清空
            </button>
          </div>
        </div>

        {/* 筛选面板 */}
        {showFilters && (
          <div className="mt-3 pt-3 border-t grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-themed-secondary mb-1 block">搜索</label>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-themed-muted" />
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="搜索日志内容..." className="w-full pl-8 pr-3 py-1.5 border rounded-lg text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs text-themed-secondary mb-1 block">级别</label>
              <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)}
                className="w-full px-3 py-1.5 border rounded-lg text-sm">
                <option value="all">全部级别</option>
                <option value="action">操作</option>
                <option value="info">信息</option>
                <option value="warn">警告</option>
                <option value="error">错误</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-themed-secondary mb-1 block">类别</label>
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                className="w-full px-3 py-1.5 border rounded-lg text-sm">
                <option value="all">全部类别</option>
                {Object.values(LOG_CATEGORIES).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-themed-secondary mb-1 block">起始日期</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="w-full px-2 py-1.5 border rounded-lg text-sm" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-themed-secondary mb-1 block">截止日期</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="w-full px-2 py-1.5 border rounded-lg text-sm" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 日志列表 */}
      <div className="glass-panel overflow-hidden">
        {paginatedLogs.length > 0 ? (
          <div className="divide-y">
            {paginatedLogs.map(log => (
              <div key={log.id} className="px-4 py-3 hover:bg-themed-elevated transition">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={getLevelStyle(log.level)}>
                      {getLevelLabel(log.level)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs px-1.5 py-0.5 bg-themed-elevated text-themed-secondary rounded">{log.category}</span>
                      <span className="text-xs text-themed-muted">{formatTime(log.timestamp)}</span>
                      {log.user && (
                        <span className="text-xs text-themed-muted">
                          {log.user.name} ({log.user.role === 'admin' ? '管理员' : log.user.role === 'teacher' ? '老师' : '学生'})
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-themed-primary">{log.message}</p>
                    {log.details && (
                      <p className="text-xs text-themed-muted mt-1 truncate">{JSON.stringify(log.details)}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-themed-muted">
            <FileText size={48} className="mx-auto mb-3 text-themed-muted" />
            <p>暂无日志记录</p>
            <p className="text-xs mt-1">用户操作和系统事件将在此显示</p>
          </div>
        )}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
            className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-themed-elevated">上一页</button>
          <span className="text-sm text-themed-secondary">{page} / {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
            className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-themed-elevated">下一页</button>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;

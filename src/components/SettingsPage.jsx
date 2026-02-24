import React, { useState, useEffect } from 'react';
import {
  User, Save, Camera, Mail, Phone, MapPin, Lock, Check,
  GraduationCap, Calendar, Briefcase, Shield, BarChart3,
  Users, School, TrendingUp, CheckCircle, Clock, AlertCircle, PieChart,
  FileText, Search, Trash2, Download, Filter, ChevronDown, ChevronUp
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { getLogs, clearLogs, filterLogs, LOG_LEVELS, LOG_CATEGORIES } from '../utils/logService';

const SettingsPage = ({ user, allUsers, setAllUsers, onLogout, initTab, onInitTabConsumed, studentList }) => {
  const { showNotification } = useApp();
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

  const handleSaveProfile = () => {
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

    // 更新 allUsers 中的名字
    if (profileForm.name !== user.name) {
      setAllUsers(prev => prev.map(u =>
        u.email === user.email && u.role === user.role ? { ...u, name: profileForm.name } : u
      ));
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

  const handleChangePassword = () => {
    const errors = {};
    const currentUser = allUsers.find(u => u.email === user.email && u.role === user.role);
    if (!passwordForm.current) errors.current = '请输入当前密码';
    else if (!currentUser || currentUser.password !== passwordForm.current) errors.current = '当前密码不正确';
    if (!passwordForm.newPwd) errors.newPwd = '请输入新密码';
    else if (passwordForm.newPwd.length < 6) errors.newPwd = '密码至少6位';
    if (passwordForm.newPwd !== passwordForm.confirm) errors.confirm = '两次输入不一致';

    if (Object.keys(errors).length > 0) { setPwdErrors(errors); return; }

    setAllUsers(prev => prev.map(u =>
      u.email === user.email && u.role === user.role ? { ...u, password: passwordForm.newPwd } : u
    ));
    setPwdSuccess(true);
    setTimeout(() => {
      setPwdSuccess(false);
      setPasswordForm({ current: '', newPwd: '', confirm: '' });
      setPwdErrors({});
    }, 2000);
    if (showNotification) showNotification('密码修改成功');
  };

  const tabs = [
    { id: 'profile', label: '个人信息', icon: User },
    { id: 'security', label: '安全设置', icon: Lock },
    ...(user.role === 'admin' ? [{ id: 'analytics', label: '数据统计', icon: BarChart3 }] : []),
    ...(user.role === 'admin' ? [{ id: 'logs', label: '系统日志', icon: FileText }] : []),
  ];

  // === 数据统计逻辑（仅管理员）===
  const analyticsData = React.useMemo(() => {
    if (user.role !== 'admin') return null;

    const teachers = allUsers.filter(u => u.role === 'teacher');
    const students = studentList || [];

    // 从 localStorage 读取所有学生的学校数据
    const allSchoolApplications = [];
    const schoolStats = {}; // schoolName -> { total, preparing, contacted, submitted, admitted }
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
            schoolStats[school.name] = { total: 0, preparing: 0, contacted: 0, submitted: 0, admitted: 0, type: school.type || '' };
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
    const totalSubmitted = allSchoolApplications.filter(a => a.status === 'submitted').length;
    const totalPreparing = allSchoolApplications.filter(a => a.status === 'preparing').length;
    const totalContacted = allSchoolApplications.filter(a => a.status === 'contacted').length;
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
      totalSubmitted,
      totalPreparing,
      totalContacted,
      admissionRate: totalApplications > 0 ? Math.round(totalAdmitted / totalApplications * 100) : 0,
      sortedSchools,
      teacherStudentCounts,
      teachers,
      schoolDbCount,
    };
  }, [user.role, allUsers, studentList]);

  return (
    <div className="space-y-4 p-4">
      <div className="flex gap-2 border-b pb-2 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition whitespace-nowrap ${
                activeTab === tab.id ? 'bg-blue-50 text-blue-600' : 'text-themed-secondary hover:bg-themed-elevated'
              }`}>
              <Icon size={18} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* 个人信息 */}
      {activeTab === 'profile' && (
        <div className="bg-themed-surface rounded-xl border-2 border-themed-subtle overflow-hidden">
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
            <div className="bg-themed-surface rounded-xl p-4 border-2 border-themed-subtle">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users size={16} className="text-blue-600" />
                </div>
                <span className="text-xs text-themed-secondary">学生总数</span>
              </div>
              <div className="text-2xl font-bold text-themed-primary">{analyticsData.totalStudents}</div>
              {analyticsData.unassignedStudents > 0 && (
                <p className="text-xs text-orange-500 mt-1">{analyticsData.unassignedStudents} 人待分配</p>
              )}
            </div>
            <div className="bg-themed-surface rounded-xl p-4 border-2 border-themed-subtle">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <GraduationCap size={16} className="text-purple-600" />
                </div>
                <span className="text-xs text-themed-secondary">老师人数</span>
              </div>
              <div className="text-2xl font-bold text-themed-primary">{analyticsData.totalTeachers}</div>
            </div>
            <div className="bg-themed-surface rounded-xl p-4 border-2 border-themed-subtle">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <School size={16} className="text-green-600" />
                </div>
                <span className="text-xs text-themed-secondary">报考总数</span>
              </div>
              <div className="text-2xl font-bold text-themed-primary">{analyticsData.totalApplications}</div>
              <p className="text-xs text-themed-muted mt-1">信息库 {analyticsData.schoolDbCount} 所</p>
            </div>
            <div className="bg-themed-surface rounded-xl p-4 border-2 border-themed-subtle">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <TrendingUp size={16} className="text-yellow-600" />
                </div>
                <span className="text-xs text-themed-secondary">合格率</span>
              </div>
              <div className="text-2xl font-bold text-themed-primary">{analyticsData.admissionRate}%</div>
              <p className="text-xs text-green-500 mt-1">{analyticsData.totalAdmitted} 人合格</p>
            </div>
          </div>

          {/* 申请状态分布 */}
          <div className="bg-themed-surface rounded-xl border-2 border-themed-subtle p-5">
            <h4 className="font-bold text-lg mb-4 flex items-center gap-2"><PieChart size={20} className="text-blue-500" /> 申请状态分布</h4>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-xl">
                <Clock size={24} className="mx-auto mb-2 text-blue-500" />
                <div className="text-2xl font-bold text-blue-700">{analyticsData.totalPreparing}</div>
                <div className="text-xs text-blue-500 mt-1">准备中</div>
                {analyticsData.totalApplications > 0 && (
                  <div className="w-full bg-blue-200 rounded-full h-1.5 mt-2">
                    <div className="bg-blue-500 h-1.5 rounded-full" style={{width: `${Math.round(analyticsData.totalPreparing / analyticsData.totalApplications * 100)}%`}} />
                  </div>
                )}
              </div>
              <div className="text-center p-4 bg-green-50 rounded-xl">
                <CheckCircle size={24} className="mx-auto mb-2 text-green-500" />
                <div className="text-2xl font-bold text-green-700">{analyticsData.totalContacted}</div>
                <div className="text-xs text-green-500 mt-1">已联系</div>
                {analyticsData.totalApplications > 0 && (
                  <div className="w-full bg-green-200 rounded-full h-1.5 mt-2">
                    <div className="bg-green-500 h-1.5 rounded-full" style={{width: `${Math.round(analyticsData.totalContacted / analyticsData.totalApplications * 100)}%`}} />
                  </div>
                )}
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-xl">
                <AlertCircle size={24} className="mx-auto mb-2 text-purple-500" />
                <div className="text-2xl font-bold text-purple-700">{analyticsData.totalSubmitted}</div>
                <div className="text-xs text-purple-500 mt-1">已提交</div>
                {analyticsData.totalApplications > 0 && (
                  <div className="w-full bg-purple-200 rounded-full h-1.5 mt-2">
                    <div className="bg-purple-500 h-1.5 rounded-full" style={{width: `${Math.round(analyticsData.totalSubmitted / analyticsData.totalApplications * 100)}%`}} />
                  </div>
                )}
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-xl">
                <TrendingUp size={24} className="mx-auto mb-2 text-yellow-500" />
                <div className="text-2xl font-bold text-yellow-700">{analyticsData.totalAdmitted}</div>
                <div className="text-xs text-yellow-500 mt-1">已合格</div>
                {analyticsData.totalApplications > 0 && (
                  <div className="w-full bg-yellow-200 rounded-full h-1.5 mt-2">
                    <div className="bg-yellow-500 h-1.5 rounded-full" style={{width: `${Math.round(analyticsData.totalAdmitted / analyticsData.totalApplications * 100)}%`}} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 各学校报考情况 */}
          <div className="bg-themed-surface rounded-xl border-2 border-themed-subtle p-5">
            <h4 className="font-bold text-lg mb-4 flex items-center gap-2"><School size={20} className="text-green-500" /> 各学校报考情况</h4>
            {analyticsData.sortedSchools.length > 0 ? (
              <div className="space-y-3">
                {analyticsData.sortedSchools.map((school, idx) => (
                  <div key={school.name} className="flex items-center gap-4 p-3 bg-themed-elevated rounded-lg hover:bg-themed-elevated transition">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold text-blue-600">
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
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full" title="报考人数">
                        {school.total}人报考
                      </span>
                      {school.admitted > 0 && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full" title="合格人数">
                          {school.admitted}人合格
                        </span>
                      )}
                      {school.submitted > 0 && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full" title="已提交">
                          {school.submitted}人提交
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
          <div className="bg-themed-surface rounded-xl border-2 border-themed-subtle p-5">
            <h4 className="font-bold text-lg mb-4 flex items-center gap-2"><Users size={20} className="text-purple-500" /> 老师名下学生分布</h4>
            <div className="space-y-3">
              {analyticsData.teachers.map(teacher => {
                const count = analyticsData.teacherStudentCounts[teacher.teacherId] || 0;
                const maxCount = Math.max(...Object.values(analyticsData.teacherStudentCounts), 1);
                return (
                  <div key={teacher.email} className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-lg">👨‍🏫</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-themed-primary text-sm truncate">{teacher.name}</span>
                        <span className="text-sm font-bold text-purple-600">{count} 人</span>
                      </div>
                      <div className="w-full bg-purple-100 rounded-full h-2">
                        <div className="bg-purple-500 h-2 rounded-full transition-all"
                          style={{width: `${(count / maxCount) * 100}%`}} />
                      </div>
                    </div>
                  </div>
                );
              })}
              {analyticsData.unassignedStudents > 0 && (
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-lg">❓</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-orange-600 text-sm">待分配</span>
                      <span className="text-sm font-bold text-orange-600">{analyticsData.unassignedStudents} 人</span>
                    </div>
                    <div className="w-full bg-orange-100 rounded-full h-2">
                      <div className="bg-orange-500 h-2 rounded-full transition-all"
                        style={{width: `${(analyticsData.unassignedStudents / Math.max(...Object.values(analyticsData.teacherStudentCounts), 1)) * 100}%`}} />
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

      {/* 安全设置 */}
      {activeTab === 'security' && (
        <div className="bg-themed-surface rounded-xl border-2 border-themed-subtle p-6">
          <h4 className="font-bold text-lg mb-6 flex items-center gap-2"><Lock size={20} /> 修改密码</h4>
          {pwdSuccess ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
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
              <button onClick={handleChangePassword}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium">
                <Lock size={18} /> 确认修改
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// === 日志面板组件 ===
const LogsPanel = () => {
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
    switch (level) {
      case 'info': return 'bg-blue-100 text-blue-700';
      case 'warn': return 'bg-yellow-100 text-yellow-700';
      case 'error': return 'bg-red-100 text-red-700';
      case 'action': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-themed-primary';
    }
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
      <div className="bg-themed-surface rounded-xl border-2 border-themed-subtle p-4">
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
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm hover:bg-blue-100">
              <Download size={14} /> 导出
            </button>
            <button onClick={handleClearLogs}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm hover:bg-red-100">
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
      <div className="bg-themed-surface rounded-xl border-2 border-themed-subtle overflow-hidden">
        {paginatedLogs.length > 0 ? (
          <div className="divide-y">
            {paginatedLogs.map(log => (
              <div key={log.id} className="px-4 py-3 hover:bg-themed-elevated transition">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getLevelStyle(log.level)}`}>
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

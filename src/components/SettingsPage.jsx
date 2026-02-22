import React, { useState, useEffect } from 'react';
import {
  User, Save, Camera, Mail, Phone, MapPin, Lock, Check,
  GraduationCap, Calendar, Briefcase, Shield
} from 'lucide-react';
import { useApp } from '../context/AppContext';

const SettingsPage = ({ user, allUsers, setAllUsers, onLogout, initTab, onInitTabConsumed }) => {
  const { showNotification } = useApp();
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
  ];

  return (
    <div className="space-y-4 p-4">
      <div className="flex gap-2 border-b pb-2 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition whitespace-nowrap ${
                activeTab === tab.id ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'
              }`}>
              <Icon size={18} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* 个人信息 */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
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
                <label className="absolute bottom-0 right-0 p-1.5 bg-white rounded-full cursor-pointer shadow-lg">
                  <Camera size={14} className="text-gray-600" />
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
                  <label className="block text-sm font-medium text-gray-600 mb-1">姓名</label>
                  <input type="text" value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">邮箱</label>
                  <input type="email" value={profileForm.email} disabled
                    className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">生日</label>
                  <input type="date" value={profileForm.birthday} onChange={e => setProfileForm({...profileForm, birthday: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">电话号码</label>
                  <input type="text" value={profileForm.phone} onChange={e => setProfileForm({...profileForm, phone: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="输入电话号码" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-600 mb-1">住址</label>
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
                    <label className="block text-sm font-medium text-gray-600 mb-1">学号</label>
                    <input type="text" value={profileForm.studentId} disabled
                      className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">目标学位</label>
                    <select value={profileForm.targetLevel} onChange={e => setProfileForm({...profileForm, targetLevel: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                      <option value="学部">学部</option><option value="修士">修士</option><option value="博士">博士</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">毕业高中</label>
                    <input type="text" value={profileForm.highSchool} onChange={e => setProfileForm({...profileForm, highSchool: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="输入毕业高中" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">在读语言学校</label>
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
                    <label className="block text-sm font-medium text-gray-600 mb-1">所属部门</label>
                    <input type="text" value={profileForm.department} onChange={e => setProfileForm({...profileForm, department: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="例: 升学指导部" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">毕业学校</label>
                    <input type="text" value={profileForm.school} onChange={e => setProfileForm({...profileForm, school: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">学部/学科</label>
                    <input type="text" value={profileForm.faculty} onChange={e => setProfileForm({...profileForm, faculty: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">最终学历</label>
                    <select value={profileForm.education} onChange={e => setProfileForm({...profileForm, education: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                      <option value="">请选择</option><option value="学士">学士</option><option value="硕士">硕士</option><option value="博士">博士</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">文科/理科</label>
                    <select value={profileForm.subject} onChange={e => setProfileForm({...profileForm, subject: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                      <option value="">请选择</option><option value="文科">文科</option><option value="理科">理科</option><option value="文理兼修">文理兼修</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">入职时间</label>
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

      {/* 安全设置 */}
      {activeTab === 'security' && (
        <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
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

export default SettingsPage;

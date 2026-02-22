import React, { useState, useEffect } from 'react';
import {
  User, Edit, Save, X, Plus, Trash2, Search, Camera,
  GraduationCap, Mail, Phone, MapPin, Calendar, Briefcase, Shield, ChevronLeft
} from 'lucide-react';
import { useApp } from '../context/AppContext';

const TeacherManagement = () => {
  const { allUsers, setAllUsers, showNotification, user } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [filterDepartment, setFilterDepartment] = useState('all');

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 从 localStorage 读取老师详细信息
  const [teacherDetails, setTeacherDetails] = useState(() => {
    const saved = localStorage.getItem('teacherDetails');
    return saved ? JSON.parse(saved) : {};
  });

  const saveTeacherDetails = (details) => {
    setTeacherDetails(details);
    localStorage.setItem('teacherDetails', JSON.stringify(details));
  };

  // 获取所有老师账号
  const teachers = allUsers.filter(u => u.role === 'teacher');

  const getTeacherDetail = (teacherId) => {
    return teacherDetails[teacherId] || {};
  };

  // 获取所有唯一部门列表（用于tag分类筛选）
  const allDepartments = [...new Set(
    teachers.map(t => getTeacherDetail(t.teacherId)?.department).filter(Boolean)
  )];

  const filteredTeachers = teachers.filter(t => {
    const matchSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.email.toLowerCase().includes(searchQuery.toLowerCase());
    const detail = getTeacherDetail(t.teacherId);
    const matchDept = filterDepartment === 'all' || detail.department === filterDepartment;
    return matchSearch && matchDept;
  });

  // 权限选项列表
  const permissionOptions = [
    { id: 'manage_students', label: '学生管理', desc: '添加、编辑、转移学生' },
    { id: 'manage_events', label: '事件管理', desc: '添加、编辑、删除时间线事件' },
    { id: 'manage_schools', label: '学校管理', desc: '添加、编辑学校信息' },
    { id: 'manage_materials', label: '材料管理', desc: '管理材料清单' },
    { id: 'manage_school_db', label: '学校信息库录入', desc: '录入和编辑学校信息数据库' },
    { id: 'export_data', label: '数据导出', desc: '导出学生数据和报表' },
    { id: 'view_all_students', label: '查看所有学生', desc: '查看所有学生（不限于自己负责的）' },
  ];

  const [editForm, setEditForm] = useState({});

  const handleSelectTeacher = (teacher) => {
    setSelectedTeacher(teacher);
    const detail = getTeacherDetail(teacher.teacherId);
    setEditForm({
      name: teacher.name || '',
      email: teacher.email || '',
      gender: detail.gender || '',
      age: detail.age || '',
      birthday: detail.birthday || '',
      photo: detail.photo || '',
      department: detail.department || '',
      school: detail.school || '',
      faculty: detail.faculty || '',
      education: detail.education || '',
      joinDate: detail.joinDate || '',
      phone: detail.phone || '',
      address: detail.address || '',
      subject: detail.subject || '文科',
      employmentType: detail.employmentType || '正社员',
      permissions: detail.permissions || ['manage_students', 'manage_events', 'manage_schools', 'manage_materials'],
    });
    setIsEditing(false);
    if (isMobile) setMobileShowDetail(true);
  };

  const handleSave = () => {
    // 更新 allUsers 中的名字和邮箱
    setAllUsers(prev => prev.map(u =>
      u.teacherId === selectedTeacher.teacherId
        ? { ...u, name: editForm.name, email: editForm.email }
        : u
    ));
    // 保存详细信息
    const newDetails = {
      ...teacherDetails,
      [selectedTeacher.teacherId]: {
        gender: editForm.gender,
        age: editForm.age,
        birthday: editForm.birthday,
        photo: editForm.photo,
        department: editForm.department,
        school: editForm.school,
        faculty: editForm.faculty,
        education: editForm.education,
        joinDate: editForm.joinDate,
        phone: editForm.phone,
        address: editForm.address,
        subject: editForm.subject,
        employmentType: editForm.employmentType,
        permissions: editForm.permissions,
      }
    };
    saveTeacherDetails(newDetails);
    setIsEditing(false);
    if (showNotification) showNotification('老师信息已保存');
    setSelectedTeacher(prev => ({ ...prev, name: editForm.name, email: editForm.email }));
  };

  const handleDelete = (teacher) => {
    setAllUsers(prev => prev.filter(u => u.id !== teacher.id));
    const newDetails = { ...teacherDetails };
    delete newDetails[teacher.teacherId];
    saveTeacherDetails(newDetails);
    setShowDeleteConfirm(null);
    setSelectedTeacher(null);
    if (showNotification) showNotification(`已注销老师账号: ${teacher.name}`);
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditForm({ ...editForm, photo: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const togglePermission = (permId) => {
    const perms = editForm.permissions || [];
    if (perms.includes(permId)) {
      setEditForm({ ...editForm, permissions: perms.filter(p => p !== permId) });
    } else {
      setEditForm({ ...editForm, permissions: [...perms, permId] });
    }
  };

  // 计算在职时长
  const getWorkDuration = (joinDate) => {
    if (!joinDate) return '-';
    const start = new Date(joinDate);
    const now = new Date();
    const years = now.getFullYear() - start.getFullYear();
    const months = now.getMonth() - start.getMonth();
    const totalMonths = years * 12 + months;
    if (totalMonths < 12) return `${totalMonths}个月`;
    return `${Math.floor(totalMonths / 12)}年${totalMonths % 12}个月`;
  };

  // 添加老师
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '', confirmPassword: '', department: '', subject: '文科' });
  const [addErrors, setAddErrors] = useState({});

  const handleAddTeacher = () => {
    const errors = {};
    if (!addForm.name) errors.name = '请输入姓名';
    if (!addForm.email) errors.email = '请输入邮箱';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addForm.email)) errors.email = '邮箱格式不正确';
    if (allUsers.find(u => u.email === addForm.email)) errors.email = '邮箱已被使用';
    if (!addForm.password) errors.password = '请输入密码';
    else if (addForm.password.length < 6) errors.password = '密码至少6位';
    if (addForm.password !== addForm.confirmPassword) errors.confirmPassword = '两次密码不一致';

    if (Object.keys(errors).length > 0) { setAddErrors(errors); return; }

    const newTeacherId = `teacher_${Date.now()}`;
    setAllUsers(prev => [...prev, {
      id: `teacher${prev.length + 1}`,
      email: addForm.email,
      password: addForm.password,
      role: 'teacher',
      teacherId: newTeacherId,
      name: addForm.name,
      createdAt: new Date().toISOString()
    }]);
    // 同步保存部门和学科信息到teacherDetails
    if (addForm.department || addForm.subject) {
      const newDetails = {
        ...teacherDetails,
        [newTeacherId]: {
          department: addForm.department,
          subject: addForm.subject,
          permissions: ['manage_students', 'manage_events', 'manage_schools', 'manage_materials'],
        }
      };
      saveTeacherDetails(newDetails);
    }
    setShowAddModal(false);
    setAddForm({ name: '', email: '', password: '', confirmPassword: '', department: '', subject: '文科' });
    setAddErrors({});
    if (showNotification) showNotification(`老师账号 ${addForm.name} 已创建`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-800">老师信息管理</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition"
        >
          <Plus size={16} /> 添加老师
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 老师列表 - 移动端选中后隐藏 */}
        {(!isMobile || !mobileShowDetail) && (
        <div className="lg:col-span-1 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text" placeholder="搜索老师..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>
          {/* 部门Tag分类筛选 */}
          {allDepartments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilterDepartment('all')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                  filterDepartment === 'all' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                全部
              </button>
              {allDepartments.map(dept => (
                <button
                  key={dept}
                  onClick={() => setFilterDepartment(dept)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                    filterDepartment === dept ? 'bg-purple-500 text-white' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                  }`}
                >
                  {dept}
                </button>
              ))}
            </div>
          )}
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filteredTeachers.map(teacher => {
              const detail = getTeacherDetail(teacher.teacherId);
              return (
                <div
                  key={teacher.id}
                  onClick={() => handleSelectTeacher(teacher)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition ${
                    selectedTeacher?.teacherId === teacher.teacherId
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {detail.photo ? (
                      <img src={detail.photo} alt={teacher.name} className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                        <GraduationCap size={24} className="text-purple-600" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{teacher.name}</div>
                      <div className="text-xs text-gray-500 truncate">{teacher.email}</div>
                      {detail.department && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full text-[10px] font-medium">{detail.department}</span>
                      )}
                      {!detail.department && <div className="text-xs text-gray-400">未设置部门</div>}
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredTeachers.length === 0 && (
              <p className="text-center text-gray-400 py-8">暂无老师</p>
            )}
          </div>
        </div>
        )}

        {/* 老师详情 - 移动端使用全宽面板 */}
        {(!isMobile || mobileShowDetail) && (
        <div className="lg:col-span-2">
          {selectedTeacher ? (
            <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
              {/* 头部 */}
              <div className="bg-gradient-to-r from-purple-500 to-blue-500 p-4 sm:p-6 text-white">
                {isMobile && (
                  <button onClick={() => setMobileShowDetail(false)} className="flex items-center gap-1 mb-3 text-white/80 hover:text-white text-sm">
                    <ChevronLeft size={16} /> 返回列表
                  </button>
                )}
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="relative flex-shrink-0">
                    {editForm.photo ? (
                      <img src={editForm.photo} alt="" className="w-20 h-20 rounded-full object-cover border-4 border-white/30" />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center">
                        <GraduationCap size={36} className="text-white" />
                      </div>
                    )}
                    {isEditing && (
                      <label className="absolute bottom-0 right-0 p-1.5 bg-white rounded-full cursor-pointer shadow-lg">
                        <Camera size={14} className="text-gray-600" />
                        <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                      </label>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold">{editForm.name}</h3>
                    <p className="text-purple-100 text-sm">{editForm.email}</p>
                    <p className="text-purple-200 text-xs mt-1">ID: {selectedTeacher.teacherId}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!isEditing ? (
                      <>
                        <button onClick={() => setIsEditing(true)} className="flex items-center gap-1 px-3 py-2 bg-white/20 rounded-lg hover:bg-white/30 text-sm">
                          <Edit size={14} /> 编辑
                        </button>
                        <button onClick={() => setShowDeleteConfirm(selectedTeacher)} className="flex items-center gap-1 px-3 py-2 bg-red-500/80 rounded-lg hover:bg-red-500 text-sm">
                          <Trash2 size={14} /> 注销
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={handleSave} className="flex items-center gap-1 px-3 py-2 bg-green-500 rounded-lg hover:bg-green-600 text-sm">
                          <Save size={14} /> 保存
                        </button>
                        <button onClick={() => setIsEditing(false)} className="flex items-center gap-1 px-3 py-2 bg-white/20 rounded-lg hover:bg-white/30 text-sm">
                          <X size={14} /> 取消
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* 基本信息 */}
                <div>
                  <h4 className="font-bold text-lg mb-4 flex items-center gap-2"><User size={20} /> 基本信息</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <Field label="姓名" value={editForm.name} editing={isEditing} onChange={v => setEditForm({...editForm, name: v})} />
                    <Field label="性别" value={editForm.gender} editing={isEditing} type="select" options={['', '男', '女']} onChange={v => setEditForm({...editForm, gender: v})} />
                    <Field label="出生日期" value={editForm.birthday} editing={isEditing} type="date" onChange={v => setEditForm({...editForm, birthday: v})} />
                    <Field label="邮箱" value={editForm.email} editing={isEditing} type="email" onChange={v => setEditForm({...editForm, email: v})} />
                    <Field label="电话号" value={editForm.phone} editing={isEditing} onChange={v => setEditForm({...editForm, phone: v})} placeholder="输入电话号码" />
                    <Field label="住所" value={editForm.address} editing={isEditing} onChange={v => setEditForm({...editForm, address: v})} placeholder="输入住所" />
                  </div>
                </div>

                {/* 职务信息 */}
                <div>
                  <h4 className="font-bold text-lg mb-4 flex items-center gap-2"><Briefcase size={20} /> 职务信息</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <Field label="所属部门" value={editForm.department} editing={isEditing} onChange={v => setEditForm({...editForm, department: v})} placeholder="例: 升学指导部" />
                    <Field label="在读/毕业学校" value={editForm.school} editing={isEditing} onChange={v => setEditForm({...editForm, school: v})} />
                    <Field label="学部/学科" value={editForm.faculty} editing={isEditing} onChange={v => setEditForm({...editForm, faculty: v})} />
                    <Field label="最终学历" value={editForm.education} editing={isEditing} type="select" options={['', '学士', '硕士', '博士', '其他']} onChange={v => setEditForm({...editForm, education: v})} />
                    <Field label="文科/理科" value={editForm.subject} editing={isEditing} type="select" options={['文科', '理科', '文理兼修']} onChange={v => setEditForm({...editForm, subject: v})} />
                    <Field label="雇佣类型" value={editForm.employmentType} editing={isEditing} type="select" options={['正社员', '兼职']} onChange={v => setEditForm({...editForm, employmentType: v})} />
                    <Field label="入职时间" value={editForm.joinDate} editing={isEditing} type="date" onChange={v => setEditForm({...editForm, joinDate: v})} />
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">在职时长</label>
                      <div className="text-gray-800 font-medium">{getWorkDuration(editForm.joinDate)}</div>
                    </div>
                  </div>
                </div>

                {/* 权限管理 */}
                <div>
                  <h4 className="font-bold text-lg mb-4 flex items-center gap-2"><Shield size={20} /> 权限分配</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {permissionOptions.map(perm => (
                      <label key={perm.id} className={`flex items-start gap-3 p-3 rounded-lg border-2 transition cursor-pointer ${
                        (editForm.permissions || []).includes(perm.id) ? 'border-purple-300 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
                      } ${!isEditing ? 'pointer-events-none' : ''}`}>
                        <input
                          type="checkbox"
                          checked={(editForm.permissions || []).includes(perm.id)}
                          onChange={() => isEditing && togglePermission(perm.id)}
                          className="w-5 h-5 mt-0.5 text-purple-600 rounded"
                          disabled={!isEditing}
                        />
                        <div>
                          <div className="font-medium text-sm">{perm.label}</div>
                          <div className="text-xs text-gray-500">{perm.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
              <GraduationCap size={48} className="text-gray-300 mx-auto mb-4" />
              <p className="text-gray-400">请从左侧选择一位老师查看详情</p>
            </div>
          )}
        </div>
        )}
      </div>

      {/* 删除确认弹窗 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-red-600 mb-3">确认注销老师账号</h3>
            <p className="text-gray-600 mb-2">
              您确定要注销 <strong>{showDeleteConfirm.name}</strong> 的账号吗？
            </p>
            <p className="text-sm text-gray-500 mb-4">此操作将删除该老师的账号信息，该老师将无法登录系统。</p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(showDeleteConfirm)} className="flex-1 bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 font-medium">
                确认注销
              </button>
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 font-medium">
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 添加老师弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">添加新老师</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">姓名</label>
                <input type="text" value={addForm.name} onChange={e => setAddForm({...addForm, name: e.target.value})}
                  className={`w-full px-3 py-2 border rounded-lg ${addErrors.name ? 'border-red-500' : ''}`} placeholder="老师姓名" />
                {addErrors.name && <p className="text-red-500 text-xs mt-1">{addErrors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">邮箱</label>
                <input type="email" value={addForm.email} onChange={e => setAddForm({...addForm, email: e.target.value})}
                  className={`w-full px-3 py-2 border rounded-lg ${addErrors.email ? 'border-red-500' : ''}`} placeholder="teacher@school.com" />
                {addErrors.email && <p className="text-red-500 text-xs mt-1">{addErrors.email}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">密码</label>
                <input type="password" value={addForm.password} onChange={e => setAddForm({...addForm, password: e.target.value})}
                  className={`w-full px-3 py-2 border rounded-lg ${addErrors.password ? 'border-red-500' : ''}`} placeholder="至少6位" />
                {addErrors.password && <p className="text-red-500 text-xs mt-1">{addErrors.password}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">确认密码</label>
                <input type="password" value={addForm.confirmPassword} onChange={e => setAddForm({...addForm, confirmPassword: e.target.value})}
                  className={`w-full px-3 py-2 border rounded-lg ${addErrors.confirmPassword ? 'border-red-500' : ''}`} placeholder="再次输入密码" />
                {addErrors.confirmPassword && <p className="text-red-500 text-xs mt-1">{addErrors.confirmPassword}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">所属部门</label>
                <input type="text" value={addForm.department} onChange={e => setAddForm({...addForm, department: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg" placeholder="例: 升学指导部" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">文科/理科</label>
                <select value={addForm.subject} onChange={e => setAddForm({...addForm, subject: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg">
                  <option value="文科">文科</option>
                  <option value="理科">理科</option>
                  <option value="文理兼修">文理兼修</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleAddTeacher} className="flex-1 bg-purple-500 text-white py-2 rounded-lg hover:bg-purple-600 font-medium">创建</button>
              <button onClick={() => { setShowAddModal(false); setAddForm({ name: '', email: '', password: '', confirmPassword: '', department: '', subject: '文科' }); setAddErrors({}); }}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 font-medium">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Field = ({ label, value, editing, onChange, type = 'text', placeholder, options }) => {
  if (editing) {
    if (type === 'select') {
      return (
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">{label}</label>
          <select value={value || ''} onChange={e => onChange(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 text-sm">
            {options.map(opt => <option key={opt} value={opt}>{opt || '请选择'}</option>)}
          </select>
        </div>
      );
    }
    return (
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">{label}</label>
        <input type={type} value={value || ''} onChange={e => onChange(e.target.value)}
          placeholder={placeholder || `请输入${label}`}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 text-sm" />
      </div>
    );
  }
  return (
    <div>
      <label className="block text-sm font-medium text-gray-400 mb-1">{label}</label>
      <div className="text-gray-800 font-medium text-sm">{value || '-'}</div>
    </div>
  );
};

export default TeacherManagement;

import React, { useState, useEffect } from 'react';
import {
  User, Edit, Save, X, Camera, GraduationCap, School, BookOpen,
  Calendar, FileText, Plus, Trash2, Mail, Clock, ChevronDown, ChevronUp, CheckCircle, Circle, Package, UserCheck
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { studentsAPI } from '../services/api';

const StudentProfile = ({ student, studentData, onBack, onUpdate }) => {
  const { user, studentList, setStudentList, showNotification, getTeacherList } = useApp();
  const { isDark, tokens, glassEnabled } = useTheme();
  const teachers = getTeacherList ? getTeacherList() : [];

  // 升学老师 = 学部升学组/教务/无部门（直接从 API 返回的 teacher.department 判断）
  const upgradeTeachers = teachers.filter(t => {
    const dept = t.department;
    return !dept || dept === '学部升学组' || dept === '教务';
  });
  // 学管老师 = 学管部门/无部门
  const academicAdvisors = teachers.filter(t => {
    const dept = t.department;
    return !dept || dept === '学管';
  });

  // 玻璃卡片通用样式
  const glassCardStyle = glassEnabled ? {
    background: tokens.colors.surface.glass,
    backdropFilter: `blur(${tokens.blur.backdropBlur}px)`,
    WebkitBackdropFilter: `blur(${tokens.blur.backdropBlur}px)`,
    border: `1px solid ${tokens.colors.border.hairline}`,
    boxShadow: `${tokens.shadow.elevation}, ${tokens.shadow.innerHighlight}`,
    borderRadius: `${tokens.radius.card}px`,
  } : {
    background: tokens.colors.surface.solid,
    border: `1px solid ${tokens.colors.border.subtle}`,
    borderRadius: `${tokens.radius.card}px`,
  };

  const sectionCardClass = 'glass-panel';
  const [isEditing, setIsEditing] = useState(false);
  const [activeSection, setActiveSection] = useState('basic');

  // 根据当前 student prop 获取最新信息
  const studentInfo = studentList.find(s => s.studentId === student.studentId) || student;

  const [formData, setFormData] = useState({
    name: studentInfo.name || '',
    birthday: studentInfo.birthday || '',
    highSchool: studentInfo.highSchool || '',
    languageSchool: studentInfo.languageSchool || '',
    jlptScore: studentInfo.jlptScore || '',
    englishScore: studentInfo.englishScore || '',
    ejuScores: Array.isArray(studentInfo.ejuScores) ? studentInfo.ejuScores : [],
    followUpNotes: Array.isArray(studentInfo.followUpNotes) ? studentInfo.followUpNotes : [],
    photo: studentInfo.photo || '',
    email: studentInfo.email || student.email || '',
    targetLevel: studentInfo.targetLevel || student.targetLevel || '修士',
    packageName: studentInfo.packageName || '',
    packageEndDate: studentInfo.packageEndDate || '',
    academicAdvisorId: studentInfo.academicAdvisorId || '',
    teacherId: studentInfo.teacherId || '',
    subject: studentInfo.subject || '',
  });

  // 套餐列表（与实际数据保持一致）
  const packageOptions = ['私塾', '校内考专家 1+2', '校内考专家 1+2+3', '丁老师规划 1+2', '丁老师规划 1+2+3'];

  // 套餐状态计算
  const getPackageStatus = () => {
    if (!formData.packageEndDate) return null;
    const endDate = new Date(formData.packageEndDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return endDate < today ? 'expired' : 'active';
  };

  // 切换学生时重新初始化 formData
  useEffect(() => {
    const info = studentList.find(s => s.studentId === student.studentId) || student;
    setFormData({
      name: info.name || '',
      birthday: info.birthday || '',
      highSchool: info.highSchool || '',
      languageSchool: info.languageSchool || '',
      jlptScore: info.jlptScore || '',
      englishScore: info.englishScore || '',
      ejuScores: Array.isArray(info.ejuScores) ? info.ejuScores : [],
      followUpNotes: Array.isArray(info.followUpNotes) ? info.followUpNotes.map(n => ({
        ...n,
        role: n.role || 'admin',
        author: n.author || '系统',
      })) : (info.followUpNotes ? [{ id: Date.now(), content: info.followUpNotes, date: new Date().toISOString().split('T')[0], author: '系统', role: 'admin' }] : []),
      photo: info.photo || '',
      email: info.email || student.email || '',
      targetLevel: info.targetLevel || student.targetLevel || '修士',
      packageName: info.packageName || '',
      packageEndDate: info.packageEndDate || '',
      academicAdvisorId: info.academicAdvisorId || '',
      teacherId: info.teacherId || '',
      subject: info.subject || '',
    });
    setIsEditing(false);
    setActiveSection('basic');
  }, [student.studentId]);

  const [newEjuScore, setNewEjuScore] = useState({
    date: '', totalScore: '', japanese: '', math: '', science: '', generalSubjects: ''
  });

  // 新备注输入
  const [newNote, setNewNote] = useState('');

  const canEdit = user.role === 'teacher' || user.role === 'admin';

  const handleSave = async () => {
    // 先调用 API 持久化到数据库
    try {
      await studentsAPI.update(student.studentId, {
        name: formData.name,
        email: formData.email,
        birthday: formData.birthday,
        high_school: formData.highSchool,
        language_school: formData.languageSchool,
        jlpt_score: formData.jlptScore,
        english_score: formData.englishScore,
        eju_scores: formData.ejuScores,
        follow_up_notes: formData.followUpNotes,
        photo: formData.photo,
        package_name: formData.packageName,
        package_end_date: formData.packageEndDate,
        subject: formData.subject,
        teacher_id: formData.teacherId,
        academic_advisor_id: formData.academicAdvisorId,
      });
    } catch (err) {
      console.error('保存学生信息失败:', err);
      if (showNotification) showNotification('保存失败，请重试');
      return; // 不更新本地状态，避免假成功
    }
    // API 成功后更新本地状态
    setStudentList(prev => prev.map(s =>
      s.studentId === student.studentId ? { ...s, ...formData } : s
    ));
    setIsEditing(false);
    if (showNotification) showNotification('学生信息已保存');
    if (onUpdate) onUpdate({ ...studentInfo, ...formData });
  };

  const handleAddNote = async () => {
    if (newNote.trim()) {
      const note = {
        id: Date.now(),
        content: newNote.trim(),
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        author: user.name,
        role: user.role,
      };
      const updatedNotes = [note, ...(formData.followUpNotes || [])];
      // 先调用 API 持久化
      try {
        await studentsAPI.update(student.studentId, {
          follow_up_notes: updatedNotes,
        });
      } catch (err) {
        console.error('保存备注失败:', err);
        if (showNotification) showNotification('备注保存失败，请重试');
        return;
      }
      // API 成功后更新本地状态
      setFormData({ ...formData, followUpNotes: updatedNotes });
      setNewNote('');
      setStudentList(prev => prev.map(s =>
        s.studentId === student.studentId ? { ...s, followUpNotes: updatedNotes } : s
      ));
      if (showNotification) showNotification('备注已添加');
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (window.confirm('确定要删除这条备注吗？')) {
      const updatedNotes = formData.followUpNotes.filter(n => n.id !== noteId);
      // 先调用 API 持久化
      try {
        await studentsAPI.update(student.studentId, {
          follow_up_notes: updatedNotes,
        });
      } catch (err) {
        console.error('删除备注失败:', err);
        if (showNotification) showNotification('删除备注失败，请重试');
        return;
      }
      // API 成功后更新本地状态
      setFormData({ ...formData, followUpNotes: updatedNotes });
      setStudentList(prev => prev.map(s =>
        s.studentId === student.studentId ? { ...s, followUpNotes: updatedNotes } : s
      ));
    }
  };

  const handleAddEjuScore = () => {
    if (newEjuScore.date && newEjuScore.totalScore) {
      const updated = [...formData.ejuScores, { ...newEjuScore, id: Date.now() }];
      setFormData({ ...formData, ejuScores: updated });
      setNewEjuScore({ date: '', totalScore: '', japanese: '', math: '', science: '', generalSubjects: '' });
    }
  };

  const handleRemoveEjuScore = (id) => {
    setFormData({ ...formData, ejuScores: formData.ejuScores.filter(s => s.id !== id) });
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, photo: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const schools = studentData?.schools || [];
  const events = studentData?.events || [];
  const checklist = studentData?.checklist || { general: [], schoolSpecific: {} };

  const totalMaterials = (checklist.general?.length || 0) +
    Object.values(checklist.schoolSpecific || {}).reduce((sum, arr) => sum + arr.length, 0);
  const completedMaterials = (checklist.general?.filter(i => i.completed).length || 0) +
    Object.values(checklist.schoolSpecific || {}).reduce((sum, arr) => sum + arr.filter(i => i.completed).length, 0);

  const sections = [
    { id: 'basic', label: '基本信息', icon: User },
    { id: 'scores', label: '成绩记录', icon: BookOpen },
    { id: 'progress', label: '申请进度', icon: School },
    { id: 'notes', label: '跟进备注', icon: FileText },
  ];

  return (
    <div className="space-y-6">
      {/* 头部个人卡片 */}
      <div className="rounded-xl p-4 sm:p-6" style={glassCardStyle}>
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
          {/* 照片 */}
          <div className="relative flex-shrink-0">
            {formData.photo ? (
              <img src={formData.photo} alt={formData.name} className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-2" style={{ borderColor: tokens.colors.border.subtle }} />
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center text-3xl sm:text-4xl border-2" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6', borderColor: tokens.colors.border.subtle }}>
                {studentInfo.avatar || '👨‍🎓'}
              </div>
            )}
            {isEditing && (
              <label className="absolute bottom-0 right-0 p-1.5 border rounded-full cursor-pointer shadow-sm" style={{ background: tokens.colors.surface.solid, borderColor: tokens.colors.border.subtle }}>
                <Camera size={16} style={{ color: tokens.colors.text.secondary }} />
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </label>
            )}
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-xl sm:text-2xl font-bold" style={{ color: tokens.colors.text.primary }}>{formData.name || studentInfo.name}</h3>
            <p className="mt-1 text-sm" style={{ color: tokens.colors.text.muted }}>学号: {student.studentId}</p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-2 text-sm text-themed-secondary">
              {formData.email && <span className="flex items-center gap-1" style={{ color: tokens.colors.text.muted }}><Mail size={14} /> {formData.email}</span>}
              {formData.targetLevel && <span className="flex items-center gap-1" style={{ color: tokens.colors.text.muted }}><GraduationCap size={14} /> 目标: {formData.targetLevel}</span>}
            </div>
          </div>
          {/* 统计数据 */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4 w-full sm:w-auto">
            <div className="glass-card p-2 sm:p-3 text-center">
              <div className="text-xl sm:text-2xl font-bold" style={{ color: tokens.colors.text.primary }}>{schools.length}</div>
              <div className="text-xs" style={{ color: tokens.colors.text.muted }}>志愿学校</div>
            </div>
            <div className="glass-card p-2 sm:p-3 text-center">
              <div className="text-xl sm:text-2xl font-bold" style={{ color: tokens.colors.text.primary }}>{events.filter(e => !e.completed).length}</div>
              <div className="text-xs" style={{ color: tokens.colors.text.muted }}>待办事项</div>
            </div>
            <div className="glass-card p-2 sm:p-3 text-center">
              <div className="text-xl sm:text-2xl font-bold" style={{ color: tokens.colors.text.primary }}>{totalMaterials > 0 ? Math.round(completedMaterials / totalMaterials * 100) : 0}%</div>
              <div className="text-xs" style={{ color: tokens.colors.text.muted }}>材料进度</div>
            </div>
          </div>
        </div>
        {/* 编辑/保存/取消按钮 - 放在卡片底部，独立一行 */}
        {canEdit && (
          <div className="flex justify-end mt-4 pt-3" style={{ borderTop: `1px solid ${tokens.colors.border.subtle}` }}>
            {!isEditing ? (
              <button onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg transition text-sm"
                style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb', color: tokens.colors.text.secondary, border: `1px solid ${tokens.colors.border.subtle}` }}>
                <Edit size={14} /> 编辑信息
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setIsEditing(false)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg transition text-sm"
                  style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb', color: tokens.colors.text.secondary, border: `1px solid ${tokens.colors.border.subtle}` }}>
                  <X size={14} /> 取消
                </button>
                <button onClick={handleSave} className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition text-sm">
                  <Save size={14} /> 保存
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2 pb-2 overflow-x-auto" style={{ borderBottom: `1px solid ${tokens.colors.border.subtle}` }}>
        {sections.map(sec => {
          const Icon = sec.icon;
          const isActive = activeSection === sec.id;
          return (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id)}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg font-medium transition whitespace-nowrap"
              style={{
                background: isActive ? (isDark ? 'rgba(99,102,241,0.12)' : '#eff6ff') : 'transparent',
                color: isActive ? tokens.colors.accent.primary : tokens.colors.text.muted,
              }}
            >
              <Icon size={18} />
              {sec.label}
            </button>
          );
        })}
      </div>

      {/* Basic Info Section */}
      {activeSection === 'basic' && (
        <div className="glass-panel p-4 sm:p-6">
          <h4 className="font-bold text-lg mb-4 flex items-center gap-2" style={{ color: tokens.colors.text.primary }}><User size={20} /> 基本信息</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InfoField label="姓名" value={formData.name} editing={isEditing}
              onChange={v => setFormData({...formData, name: v})} />
            <InfoField label="生日" value={formData.birthday} editing={isEditing} type="date"
              onChange={v => setFormData({...formData, birthday: v})} />
            <InfoField label="邮箱" value={formData.email} editing={isEditing} type="email"
              onChange={v => setFormData({...formData, email: v})} />
            <InfoField label="目标学位" value={formData.targetLevel} editing={isEditing} type="select"
              options={['学部', '修士', '博士']}
              onChange={v => setFormData({...formData, targetLevel: v})} />
            <InfoField label="毕业高中" value={formData.highSchool} editing={isEditing}
              placeholder="请输入毕业高中名称"
              onChange={v => setFormData({...formData, highSchool: v})} />
            <InfoField label="在读语言学校" value={formData.languageSchool} editing={isEditing}
              placeholder="请输入语言学校名称"
              onChange={v => setFormData({...formData, languageSchool: v})} />
            <InfoField label="文理科" value={formData.subject} editing={isEditing} type="select"
              options={['', '文科', '理科']}
              onChange={v => setFormData({...formData, subject: v})} />
          </div>

          {/* 项目套餐信息 */}
          <div className="mt-6 pt-4" style={{ borderTop: `1px solid ${tokens.colors.border.subtle}` }}>
            <h5 className="font-semibold text-sm mb-4 flex items-center gap-2" style={{ color: tokens.colors.text.primary }}>
              <Package size={16} /> 项目套餐
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {isEditing ? (
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: tokens.colors.text.secondary }}>套餐名称</label>
                  <select value={formData.packageName} onChange={e => setFormData({...formData, packageName: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', color: tokens.colors.text.primary, borderColor: isDark ? 'rgba(255,255,255,0.1)' : undefined }}>
                    <option value="">请选择套餐</option>
                    {packageOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: tokens.colors.text.muted }}>套餐名称</label>
                  <div className="flex items-center gap-2">
                    <span className="font-medium" style={{ color: tokens.colors.text.primary }}>{formData.packageName || '-'}</span>
                    {formData.packageName && getPackageStatus() && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{
                        background: getPackageStatus() === 'expired'
                          ? (isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)')
                          : (isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)'),
                        color: getPackageStatus() === 'expired' ? '#ef4444' : '#22c55e',
                      }}>
                        {getPackageStatus() === 'expired' ? '已过期' : '进行中'}
                      </span>
                    )}
                  </div>
                </div>
              )}
              <InfoField label="套餐结束时间" value={formData.packageEndDate} editing={isEditing} type="date"
                onChange={v => setFormData({...formData, packageEndDate: v})} />
            </div>
          </div>

          {/* 学管老师信息 */}
          <div className="mt-6 pt-4" style={{ borderTop: `1px solid ${tokens.colors.border.subtle}` }}>
            <h5 className="font-semibold text-sm mb-4 flex items-center gap-2" style={{ color: tokens.colors.text.primary }}>
              <UserCheck size={16} /> 老师信息
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {isEditing ? (
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: tokens.colors.text.secondary }}>升学老师</label>
                  <select value={formData.teacherId} onChange={e => setFormData({...formData, teacherId: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', color: tokens.colors.text.primary, borderColor: isDark ? 'rgba(255,255,255,0.1)' : undefined }}>
                    <option value="">待分配</option>
                    {upgradeTeachers.map(t => <option key={t.id || t.teacherId} value={t.id || t.teacherId}>{t.name}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: tokens.colors.text.muted }}>升学老师</label>
                  <div className="font-medium" style={{ color: tokens.colors.text.primary }}>
                    {teachers.find(t => (t.id || t.teacherId) === studentInfo.teacherId)?.name || '待分配'}
                  </div>
                </div>
              )}
              {isEditing ? (
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: tokens.colors.text.secondary }}>学管老师</label>
                  <select value={formData.academicAdvisorId} onChange={e => setFormData({...formData, academicAdvisorId: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', color: tokens.colors.text.primary, borderColor: isDark ? 'rgba(255,255,255,0.1)' : undefined }}>
                    <option value="">请选择学管老师</option>
                    {academicAdvisors.map(t => <option key={t.id || t.teacherId} value={t.id || t.teacherId}>{t.name}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: tokens.colors.text.muted }}>学管老师</label>
                  <div className="font-medium" style={{ color: tokens.colors.text.primary }}>
                    {teachers.find(t => (t.id || t.teacherId) === formData.academicAdvisorId)?.name || '待分配'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Scores Section */}
      {activeSection === 'scores' && (
        <div className="space-y-6">
          <div className="glass-panel p-4 sm:p-6">
            <h4 className="font-bold text-lg mb-4 flex items-center gap-2" style={{ color: tokens.colors.text.primary }}><BookOpen size={20} /> 语言成绩</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InfoField label="日语成绩 (JLPT)" value={formData.jlptScore} editing={isEditing}
                placeholder="例: N1 145分"
                onChange={v => setFormData({...formData, jlptScore: v})} />
              <InfoField label="英语成绩" value={formData.englishScore} editing={isEditing}
                placeholder="例: TOEFL 90 / IELTS 6.5"
                onChange={v => setFormData({...formData, englishScore: v})} />
            </div>
          </div>

          <div className="glass-panel p-4 sm:p-6">
            <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Calendar size={20} /> EJU 成绩记录
            </h4>

            {formData.ejuScores.length > 0 && (
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb' }}>
                      <th className="px-3 py-2 text-left font-medium text-themed-secondary">考试日期</th>
                      <th className="px-3 py-2 text-left font-medium text-themed-secondary">总分</th>
                      <th className="px-3 py-2 text-left font-medium text-themed-secondary">日语</th>
                      <th className="px-3 py-2 text-left font-medium text-themed-secondary">数学</th>
                      <th className="px-3 py-2 text-left font-medium text-themed-secondary">理科/综合</th>
                      <th className="px-3 py-2 text-left font-medium text-themed-secondary">文综</th>
                      {isEditing && <th className="px-3 py-2"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {formData.ejuScores.map(score => (
                      <tr key={score.id} className="border-t">
                        <td className="px-3 py-2">{score.date}</td>
                        <td className="px-3 py-2 font-semibold text-blue-600">{score.totalScore}</td>
                        <td className="px-3 py-2">{score.japanese || '-'}</td>
                        <td className="px-3 py-2">{score.math || '-'}</td>
                        <td className="px-3 py-2">{score.science || '-'}</td>
                        <td className="px-3 py-2">{score.generalSubjects || '-'}</td>
                        {isEditing && (
                          <td className="px-3 py-2">
                            <button onClick={() => handleRemoveEjuScore(score.id)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {formData.ejuScores.length === 0 && !isEditing && (
              <p className="text-themed-muted text-center py-6">暂无 EJU 成绩记录</p>
            )}

            {isEditing && (
              <div className="bg-themed-elevated rounded-lg p-4">
                <p className="text-sm font-medium text-themed-secondary mb-3">添加 EJU 成绩</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <input type="date" value={newEjuScore.date}
                    onChange={e => setNewEjuScore({...newEjuScore, date: e.target.value})}
                    className="px-3 py-2 border rounded-lg text-sm" placeholder="考试日期" />
                  <input type="number" value={newEjuScore.totalScore}
                    onChange={e => setNewEjuScore({...newEjuScore, totalScore: e.target.value})}
                    className="px-3 py-2 border rounded-lg text-sm" placeholder="总分" />
                  <input type="number" value={newEjuScore.japanese}
                    onChange={e => setNewEjuScore({...newEjuScore, japanese: e.target.value})}
                    className="px-3 py-2 border rounded-lg text-sm" placeholder="日语" />
                  <input type="number" value={newEjuScore.math}
                    onChange={e => setNewEjuScore({...newEjuScore, math: e.target.value})}
                    className="px-3 py-2 border rounded-lg text-sm" placeholder="数学" />
                  <input type="number" value={newEjuScore.science}
                    onChange={e => setNewEjuScore({...newEjuScore, science: e.target.value})}
                    className="px-3 py-2 border rounded-lg text-sm" placeholder="理科" />
                  <input type="number" value={newEjuScore.generalSubjects}
                    onChange={e => setNewEjuScore({...newEjuScore, generalSubjects: e.target.value})}
                    className="px-3 py-2 border rounded-lg text-sm" placeholder="综合科目" />
                </div>
                <button onClick={handleAddEjuScore}
                  className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition"
                  style={{ background: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)', color: '#3b82f6' }}
                  onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.2)'}
                  onMouseLeave={e => e.currentTarget.style.background = isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)'}>
                  <Plus size={16} /> 添加成绩
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Progress Section */}
      {activeSection === 'progress' && (
        <div className="space-y-6">
          <div className="glass-panel p-4 sm:p-6">
            <h4 className="font-bold text-lg mb-4 flex items-center gap-2"><School size={20} /> 申请学校概览</h4>
            {schools.length > 0 ? (
              <div className="space-y-3">
                {schools.map(school => (
                  <div key={school.id} className="flex items-center justify-between p-4 rounded-lg" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}` }}>
                    <div>
                      <div className="font-semibold">{school.name}</div>
                      <div className="text-sm text-themed-secondary">{school.program} - {school.type}</div>
                    </div>
                    <StatusBadge status={school.status} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-themed-muted text-center py-6">暂无申请学校</p>
            )}
          </div>

          <div className="glass-panel p-4 sm:p-6">
            <h4 className="font-bold text-lg mb-4 flex items-center gap-2"><FileText size={20} /> 材料准备进度</h4>
            <div className="space-y-3">
              <CollapsibleMaterialProgress
                label="通用材料"
                materials={checklist.general || []}
                color="blue"
              />
              {Object.entries(checklist.schoolSpecific || {}).map(([name, materials]) => (
                <CollapsibleMaterialProgress
                  key={name}
                  label={name}
                  materials={materials}
                  color="green"
                />
              ))}
              {(checklist.general?.length || 0) === 0 && Object.keys(checklist.schoolSpecific || {}).length === 0 && (
                <p className="text-themed-muted text-center py-4">暂无材料清单</p>
              )}
            </div>
          </div>

          <div className="glass-panel p-4 sm:p-6">
            <h4 className="font-bold text-lg mb-4 flex items-center gap-2"><Clock size={20} /> 近期事项</h4>
            {events.filter(e => !e.completed).slice(0, 5).length > 0 ? (
              <div className="space-y-2">
                {events.filter(e => !e.completed).sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 5).map(event => (
                  <div key={event.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'transparent'}` }}>
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{event.type === 'exam' ? '📝' : event.type === 'deadline' ? '⏰' : '✉️'}</span>
                      <div>
                        <div className="font-medium text-sm">{event.title}</div>
                        <div className="text-xs text-themed-secondary">{event.date}</div>
                      </div>
                    </div>
                    <span className={`text-sm font-bold ${
                      event.daysLeft <= 7 ? 'text-red-500' : event.daysLeft <= 30 ? 'text-orange-500' : ''
                    }`} style={event.daysLeft > 30 ? { color: tokens.colors.text.secondary } : {}}>
                      {event.daysLeft <= 0 ? '已过期' : `${event.daysLeft}天`}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-themed-muted text-center py-6">暂无待办事项</p>
            )}
          </div>
        </div>
      )}

      {/* Notes Section - 改为按条追加的形式 */}
      {activeSection === 'notes' && (
        <div className="space-y-4">
          {/* 添加新备注 */}
          {canEdit && (
            <div className="glass-panel p-4 sm:p-6">
              <h4 className="font-bold text-lg mb-4 flex items-center gap-2"><Plus size={20} /> 添加备注</h4>
              <div className="flex gap-3">
                <textarea
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  className="flex-1 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 min-h-[80px] resize-none"
                  placeholder="输入跟进备注内容..."
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      handleAddNote();
                    }
                  }}
                />
              </div>
              <div className="flex justify-between items-center mt-3">
                <span className="text-xs text-themed-muted">Ctrl/Cmd + Enter 快速提交</span>
                <button
                  onClick={handleAddNote}
                  disabled={!newNote.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
              style={{ background: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)', color: '#3b82f6' }}
              onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = isDark ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.2)' }}
              onMouseLeave={e => e.currentTarget.style.background = isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)'}
                >
                  <Plus size={16} /> 添加备注
                </button>
              </div>
            </div>
          )}

          {/* 备注列表 */}
          <div className="glass-panel p-4 sm:p-6">
            <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
              <FileText size={20} /> 跟进备注
              <span className="text-sm font-normal text-themed-muted">
                ({Array.isArray(formData.followUpNotes) ? formData.followUpNotes.length : 0} 条)
              </span>
            </h4>
            {Array.isArray(formData.followUpNotes) && formData.followUpNotes.length > 0 ? (
              <div className="space-y-3">
                {formData.followUpNotes.map(note => (
                  <div key={note.id} className="p-4 bg-themed-elevated rounded-lg border border-themed-subtle group">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="whitespace-pre-wrap text-themed-primary leading-relaxed text-sm">
                          {note.content}
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-themed-muted">
                          <span>{note.date} {note.time || ''}</span>
                          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-medium text-xs`}
                            style={{
                              background: note.role === 'admin' ? (isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)')
                                : note.role === 'teacher' ? (isDark ? 'rgba(168,85,247,0.12)' : 'rgba(168,85,247,0.08)')
                                : note.role === 'student' ? (isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)')
                                : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'),
                              color: note.role === 'admin' ? '#ef4444'
                                : note.role === 'teacher' ? '#a855f7'
                                : note.role === 'student' ? '#3b82f6'
                                : tokens.colors.text.secondary,
                            }}>
                            <User size={12} />
                            {note.author || '未知'}
                            <span className="opacity-60">
                              {note.role === 'admin' ? '(管理员)' :
                               note.role === 'teacher' ? '(老师)' :
                               note.role === 'student' ? '(学生)' : '(未知角色)'}
                            </span>
                          </span>
                        </div>
                      </div>
                      {canEdit && (
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="p-1 text-themed-muted hover:text-red-500 rounded opacity-0 group-hover:opacity-100 transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-themed-muted text-center py-12">暂无跟进备注</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const InfoField = ({ label, value, editing, onChange, type = 'text', placeholder, options }) => {
  if (editing) {
    if (type === 'select') {
      return (
        <div>
          <label className="block text-sm font-medium text-themed-secondary mb-1">{label}</label>
          <select value={value || ''} onChange={e => onChange(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      );
    }
    return (
      <div>
        <label className="block text-sm font-medium text-themed-secondary mb-1">{label}</label>
        <input type={type} value={value || ''} onChange={e => onChange(e.target.value)}
          placeholder={placeholder || `请输入${label}`}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
      </div>
    );
  }
  return (
    <div>
      <label className="block text-sm font-medium text-themed-muted mb-1">{label}</label>
      <div className="text-themed-primary font-medium">{value || '-'}</div>
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const { isDark } = useTheme();
  const config = {
    not_started: { label: '未开始', bg: isDark ? 'rgba(156,163,175,0.15)' : 'rgba(156,163,175,0.1)', color: '#9ca3af' },
    preparing: { label: '准备中', bg: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)', color: '#3b82f6' },
    applied: { label: '出愿完成', bg: isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)', color: '#22c55e' },
    submitted: { label: '邮寄完成', bg: isDark ? 'rgba(249,115,22,0.15)' : 'rgba(249,115,22,0.1)', color: '#f97316' },
    admitted: { label: '合格', bg: isDark ? 'rgba(234,179,8,0.15)' : 'rgba(234,179,8,0.1)', color: '#eab308' },
    rejected: { label: '未合格', bg: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)', color: '#ef4444' },
  };
  const { label, bg, color } = config[status] || { label: '未知', bg: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', color: isDark ? '#9ca3af' : '#6b7280' };
  return <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ background: bg, color }}>{label}</span>;
};

const ProgressBar = ({ label, completed, total, color = 'blue' }) => {
  const pct = total > 0 ? Math.round(completed / total * 100) : 0;
  const gradients = {
    blue: 'from-blue-500 to-purple-500',
    green: 'from-green-500 to-blue-500',
  };
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium text-themed-secondary">{label}</span>
        <span className="text-sm font-bold">{completed}/{total} ({pct}%)</span>
      </div>
      <div className="w-full bg-themed-elevated rounded-full h-2.5">
        <div className={`bg-gradient-to-r ${gradients[color]} h-2.5 rounded-full transition-all`}
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

// 可收缩的材料进度组件：点击展开显示具体材料清单和准备状态
const CollapsibleMaterialProgress = ({ label, materials, color = 'blue' }) => {
  const { isDark, tokens } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const completed = materials.filter(i => i.completed).length;
  const total = materials.length;
  const pct = total > 0 ? Math.round(completed / total * 100) : 0;
  const gradients = {
    blue: 'from-blue-500 to-purple-500',
    green: 'from-green-500 to-blue-500',
  };

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : tokens.colors.border.subtle}` }}>
      {/* 进度条头部（可点击） */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 hover:bg-themed-elevated transition text-left"
      >
        <div className="flex-1">
          <div className="flex justify-between mb-1">
            <span className="text-sm font-medium text-themed-primary">{label}</span>
            <span className="text-xs font-bold text-themed-secondary">{completed}/{total} ({pct}%)</span>
          </div>
          <div className="w-full bg-themed-elevated rounded-full h-2">
            <div className={`bg-gradient-to-r ${gradients[color]} h-2 rounded-full transition-all`}
              style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="flex-shrink-0 text-themed-muted">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* 展开的材料清单 */}
      {expanded && materials.length > 0 && (
        <div className="px-3 py-2 space-y-1" style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb'}`, background: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb' }}>
          {materials.map((item, idx) => (
            <div key={item.id || idx} className="flex items-center gap-2 py-1.5 px-2 rounded transition" style={{ background: "transparent" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              {item.completed ? (
                <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
              ) : (
                <Circle size={16} className="text-themed-muted flex-shrink-0" />
              )}
              <span className={`text-sm flex-1 ${item.completed ? 'text-themed-secondary line-through' : 'text-themed-primary'}`}>
                {item.name || item.item || '未命名材料'}
              </span>
              {item.category && (
                <span className="text-[10px] px-1.5 py-0.5 bg-themed-elevated text-themed-secondary rounded">
                  {item.category}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {expanded && materials.length === 0 && (
        <div className="px-3 py-4 text-center text-sm text-themed-muted" style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb'}`, background: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb' }}>
          暂无材料
        </div>
      )}
    </div>
  );
};

export default StudentProfile;

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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
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
    langSchoolShift: studentInfo.langSchoolShift || '',
    phone: studentInfo.phone || '',
    jlptScore: studentInfo.jlptScore || '',
    jlptScores: Array.isArray(studentInfo.jlptScores) ? studentInfo.jlptScores : [],
    englishScore: studentInfo.englishScore || '',
    englishScores: Array.isArray(studentInfo.englishScores) ? studentInfo.englishScores : [],
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
    hasChinaHighSchoolRecord: studentInfo.hasChinaHighSchoolRecord || '',
    overseasCertifications: Array.isArray(studentInfo.overseasCertifications) ? studentInfo.overseasCertifications : [],
  });

  // 套餐列表（与实际数据保持一致）
  const packageOptions = ['私塾', '校内考专家 1+2', '校内考专家 1+2+3', '丁老师规划 1+2', '丁老师规划 1+2+3', 'VIP'];

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
      langSchoolShift: info.langSchoolShift || '',
      phone: info.phone || '',
      jlptScore: info.jlptScore || '',
      jlptScores: Array.isArray(info.jlptScores) ? info.jlptScores : [],
      englishScore: info.englishScore || '',
      englishScores: Array.isArray(info.englishScores) ? info.englishScores : [],
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
      hasChinaHighSchoolRecord: info.hasChinaHighSchoolRecord || '',
      overseasCertifications: Array.isArray(info.overseasCertifications) ? info.overseasCertifications : [],
    });
    setIsEditing(false);
    setActiveSection('basic');
  }, [student.studentId]);

  // 【新需求45 Bug 1 修复】打开学生资料 / 切换学生 / 切换到"跟进备注"tab 时，
  // 主动从 API 拉取该学生的最新完整数据（尤其是 follow_up_notes），
  // 避免"管理员追加的备注要等另一个老师再加备注才能看到"的问题。
  // 根因：studentList 仅在登录时加载一次，不同账号之间不会实时同步。
  useEffect(() => {
    let aborted = false;
    const refreshLatest = async () => {
      if (!student?.studentId) return;
      try {
        const fresh = await studentsAPI.getById(student.studentId);
        if (aborted || !fresh) return;
        // 同步到全局 studentList，触发上面 useEffect 重新初始化 formData
        setStudentList(prev => {
          const exists = prev.some(s => s.studentId === fresh.studentId);
          if (!exists) return [...prev, fresh];
          return prev.map(s => s.studentId === fresh.studentId ? { ...s, ...fresh } : s);
        });
        // 即时把最新备注写进当前 formData（不依赖 studentList 传播时机）
        if (Array.isArray(fresh.followUpNotes)) {
          setFormData(prev => ({
            ...prev,
            followUpNotes: fresh.followUpNotes.map(n => ({
              ...n,
              role: n.role || 'admin',
              author: n.author || '系统',
            })),
          }));
        }
      } catch (err) {
        // 静默失败：若 API 不可用则沿用缓存，避免影响页面
        console.warn('刷新学生最新资料失败:', err);
      }
    };
    refreshLatest();
    return () => { aborted = true; };
    // 切换学生或切换到备注 tab 时都重新拉取
  }, [student.studentId, activeSection]);

  const [newEjuScore, setNewEjuScore] = useState({
    date: '', totalScore: '', japanese: '', descriptive: '', math: '', science: '', generalSubjects: ''
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
        lang_school_shift: formData.langSchoolShift,
        phone: formData.phone,
        jlpt_score: formData.jlptScore,
        jlpt_scores: formData.jlptScores,
        english_score: formData.englishScore,
        english_scores: formData.englishScores,
        eju_scores: formData.ejuScores,
        follow_up_notes: formData.followUpNotes,
        photo: formData.photo,
        package_name: formData.packageName,
        package_end_date: formData.packageEndDate,
        subject: formData.subject,
        teacher_id: formData.teacherId,
        academic_advisor_id: formData.academicAdvisorId,
        has_china_high_school_record: formData.hasChinaHighSchoolRecord,
        overseas_certifications: formData.overseasCertifications,
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
      // 使用原子化追加接口，避免不同账号并发操作时互相覆盖
      try {
        const result = await studentsAPI.addNote(student.studentId, newNote.trim());
        // apiRequest 已自动提取 result.data，所以 result 直接就是 formatStudent 对象
        const updatedNotes = result?.followUpNotes || [];
        setFormData({ ...formData, followUpNotes: updatedNotes });
        setNewNote('');
        setStudentList(prev => prev.map(s =>
          s.studentId === student.studentId ? { ...s, followUpNotes: updatedNotes } : s
        ));
        if (showNotification) showNotification('备注已添加');
      } catch (err) {
        console.error('保存备注失败:', err);
        if (showNotification) showNotification('备注保存失败，请重试');
      }
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (window.confirm('确定要删除这条备注吗？')) {
      // 使用原子化删除接口
      try {
        const result = await studentsAPI.deleteNote(student.studentId, noteId);
        // apiRequest 已自动提取 result.data，所以 result 直接就是 formatStudent 对象
        const updatedNotes = result?.followUpNotes || [];
        setFormData({ ...formData, followUpNotes: updatedNotes });
        setStudentList(prev => prev.map(s =>
          s.studentId === student.studentId ? { ...s, followUpNotes: updatedNotes } : s
        ));
        if (showNotification) showNotification('备注已删除');
      } catch (err) {
        console.error('删除备注失败:', err);
        if (showNotification) showNotification('删除备注失败，请重试');
      }
    }
  };

  const handleAddEjuScore = () => {
    if (newEjuScore.date && newEjuScore.totalScore) {
      const updated = [...formData.ejuScores, { ...newEjuScore, id: Date.now() }];
      setFormData({ ...formData, ejuScores: updated });
      setNewEjuScore({ date: '', totalScore: '', japanese: '', descriptive: '', math: '', science: '', generalSubjects: '' });
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

  // 【新需求63 任务3】合并 events + schools 所有日期端 → 近期事项
  //   背景：用户反馈"近期事项数据同步不全"。
  //   原因：旧学校在需求 45/46 之前创建，后端 events 表只生成了出愿/考试/合格发表 4 条，
  //         一审/二审/自定义日期未被同步进 events 表；即使后端已升级，旧学校
  //         也需要"再次保存"才会触发 PUT 重建 events，否则永久缺失。
  //   兜底策略：在前端从 schools 字段(及 extra_dates)按 7 个日期端拼出虚拟事件，
  //             与后端 events 合并后按 (title+date) 去重。已 completed 的 event 优先生效。
  const calcDaysLeft = (dateStr) => {
    if (!dateStr) return Number.POSITIVE_INFINITY;
    const diff = new Date(dateStr) - new Date();
    return Math.ceil(diff / 86400000);
  };
  const mergedUpcomingEvents = (() => {
    // 1) 后端 events（携带 completed 状态）
    const map = new Map();
    const keyOf = (title, date) => `${title}__${date}`;
    (events || []).forEach(e => {
      if (!e || !e.title || !e.date) return;
      map.set(keyOf(e.title, e.date), {
        id: e.id,
        type: e.type || 'deadline',
        title: e.title,
        date: e.date,
        daysLeft: typeof e.daysLeft === 'number' ? e.daysLeft : calcDaysLeft(e.date),
        completed: !!e.completed,
        urgent: !!e.urgent,
      });
    });
    // 2) schools 派生事件（virtual，未 completed）
    (schools || []).forEach(s => {
      if (!s || !s.name) return;
      const extra = (typeof s.extra_dates === 'string')
        ? (() => { try { return JSON.parse(s.extra_dates || '{}'); } catch { return {}; } })()
        : (s.extra_dates || s.extraDates || {});
      const pushIfMissing = (title, date, type = 'deadline') => {
        if (!date) return;
        const k = keyOf(title, date);
        if (!map.has(k)) {
          map.set(k, {
            id: `virtual-${k}`,
            type,
            title,
            date,
            daysLeft: calcDaysLeft(date),
            completed: false,
            urgent: false,
          });
        }
      };
      pushIfMissing(`${s.name} 出愿开始`, s.applicationStartDate || s.application_start_date);
      pushIfMissing(`${s.name} 出愿截止`, s.applicationEndDate || s.application_end_date);
      pushIfMissing(`${s.name} 入学考试`, s.examDate || s.exam_date, 'exam');
      pushIfMissing(`${s.name} 合格发表`, s.resultDate || s.result_date);
      pushIfMissing(`${s.name} 一审考试`, s.firstExamDate || extra.firstExamDate, 'exam');
      pushIfMissing(`${s.name} 一审发表`, s.firstResultDate || extra.firstResultDate);
      pushIfMissing(`${s.name} 二审考试`, s.secondExamDate || extra.secondExamDate, 'exam');
      pushIfMissing(`${s.name} 二审发表`, s.secondResultDate || extra.secondResultDate);
      const customs = Array.isArray(s.customDates) && s.customDates.length > 0
        ? s.customDates
        : (Array.isArray(extra.customDates) ? extra.customDates : []);
      customs.forEach(cd => {
        if (cd && cd.label && cd.date) {
          pushIfMissing(`${s.name} ${cd.label}`, cd.date);
        }
      });
    });
    return Array.from(map.values());
  })();

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
          <div className="grid grid-cols-3 gap-2 sm:gap-4 w-full sm:w-auto">
            <div className="glass-card p-2 sm:p-3 text-center">
              <div className="text-xl sm:text-2xl font-bold" style={{ color: tokens.colors.text.primary }}>{schools.length}</div>
              <div className="text-xs" style={{ color: tokens.colors.text.muted }}>志愿学校</div>
            </div>
            <div className="glass-card p-2 sm:p-3 text-center">
              <div className="text-xl sm:text-2xl font-bold" style={{ color: tokens.colors.text.primary }}>{mergedUpcomingEvents.filter(e => !e.completed).length}</div>
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
      <div className={`flex pb-2 overflow-x-auto ${isMobile ? 'gap-1' : 'gap-2'}`} style={{ borderBottom: `1px solid ${tokens.colors.border.subtle}`, WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
        {sections.map(sec => {
          const Icon = sec.icon;
          const isActive = activeSection === sec.id;
          return (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id)}
              className={`flex items-center gap-1.5 ${isMobile ? 'px-2.5 py-1.5 text-sm' : 'px-3 sm:px-4 py-2'} rounded-lg font-medium transition whitespace-nowrap flex-shrink-0`}
              style={{
                background: isActive ? (isDark ? 'rgba(99,102,241,0.12)' : '#eff6ff') : 'transparent',
                color: isActive ? tokens.colors.accent.primary : tokens.colors.text.muted,
              }}
            >
              <Icon size={isMobile ? 16 : 18} />
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
            <InfoField label="中国高中学籍" value={formData.hasChinaHighSchoolRecord} editing={isEditing} type="select"
              options={['', '有', '无', '不确定']}
              onChange={v => setFormData({...formData, hasChinaHighSchoolRecord: v})} />
            {/* 海外认证（多选） — 占整行 */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1" style={{ color: isEditing ? tokens.colors.text.secondary : tokens.colors.text.muted }}>
                可开具的海外认证
              </label>
              {isEditing ? (
                <div className="flex flex-wrap gap-2">
                  {['Cognia', 'WASC', 'CIS', 'NEASC/MSA', 'COBIS/BSO', 'IB'].map(cert => {
                    const checked = formData.overseasCertifications.includes(cert);
                    return (
                      <label key={cert}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm cursor-pointer transition select-none"
                        style={{
                          background: checked
                            ? (isDark ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.1)')
                            : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                          color: checked ? '#3b82f6' : tokens.colors.text.secondary,
                          border: checked ? '1px solid #3b82f6' : `1px solid ${tokens.colors.border.subtle}`,
                        }}>
                        <input type="checkbox" checked={checked}
                          onChange={e => {
                            const next = e.target.checked
                              ? [...formData.overseasCertifications, cert]
                              : formData.overseasCertifications.filter(c => c !== cert);
                            setFormData({...formData, overseasCertifications: next});
                          }}
                          className="w-3.5 h-3.5" />
                        {cert}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="text-themed-primary font-medium flex flex-wrap gap-1.5">
                  {formData.overseasCertifications.length > 0
                    ? formData.overseasCertifications.map(cert => (
                        <span key={cert} className="px-2 py-0.5 rounded text-xs" style={{
                          background: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)',
                          color: '#3b82f6',
                        }}>{cert}</span>
                      ))
                    : <span className="text-themed-muted">-</span>}
                </div>
              )}
            </div>
            <InfoField label="在读语言学校" value={formData.languageSchool} editing={isEditing}
              placeholder="请输入语言学校名称"
              onChange={v => setFormData({...formData, languageSchool: v})} />
            <InfoField label="语言学校班次" value={formData.langSchoolShift} editing={isEditing} type="select"
              options={['', '上午班', '下午班']}
              onChange={v => setFormData({...formData, langSchoolShift: v})} />
            <InfoField label="电话号码" value={formData.phone} editing={isEditing}
              placeholder="请输入电话号码"
              onChange={v => setFormData({...formData, phone: v})} />
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
                    {upgradeTeachers.map(t => <option key={t.teacher_id || t.teacherId} value={t.teacher_id || t.teacherId}>{t.name}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: tokens.colors.text.muted }}>升学老师</label>
                  <div className="font-medium" style={{ color: tokens.colors.text.primary }}>
                    {teachers.find(t => (t.teacher_id || t.teacherId) === studentInfo.teacherId)?.name || '待分配'}
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
                    {academicAdvisors.map(t => <option key={t.teacher_id || t.teacherId} value={t.teacher_id || t.teacherId}>{t.name}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: tokens.colors.text.muted }}>学管老师</label>
                  <div className="font-medium" style={{ color: tokens.colors.text.primary }}>
                    {teachers.find(t => (t.teacher_id || t.teacherId) === formData.academicAdvisorId)?.name || '待分配'}
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
          {/* 日语成绩 (JLPT) - 可追加 */}
          <div className="glass-panel p-4 sm:p-6">
            <h4 className="font-bold text-lg mb-4 flex items-center gap-2" style={{ color: tokens.colors.text.primary }}><BookOpen size={20} /> 日语成绩 (JLPT)</h4>
            {formData.jlptScores.length > 0 && (
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb' }}>
                      <th className="px-3 py-2 text-left font-medium text-themed-secondary">考试日期</th>
                      <th className="px-3 py-2 text-left font-medium text-themed-secondary">级别</th>
                      <th className="px-3 py-2 text-left font-medium text-themed-secondary">分数</th>
                      {isEditing && <th className="px-3 py-2"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {formData.jlptScores.map((s, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-2">{s.date || '-'}</td>
                        <td className="px-3 py-2 font-semibold" style={{ color: '#3b82f6' }}>{s.level || '-'}</td>
                        <td className="px-3 py-2">{s.score || '-'}</td>
                        {isEditing && (
                          <td className="px-3 py-2">
                            <button onClick={() => setFormData({...formData, jlptScores: formData.jlptScores.filter((_, idx) => idx !== i)})} className="text-red-500 hover:bg-red-50 p-1 rounded">
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
            {formData.jlptScores.length === 0 && !isEditing && (
              <p className="text-themed-muted text-center py-4">暂无 JLPT 成绩记录</p>
            )}
            {isEditing && (
              <div className="bg-themed-elevated rounded-lg p-4">
                <p className="text-sm font-medium text-themed-secondary mb-3">添加 JLPT 成绩</p>
                <div className={`${isMobile ? 'grid grid-cols-2 gap-2' : 'flex gap-3 flex-wrap'}`}>
                  <input type="date" className="px-3 py-2 border rounded-lg text-sm w-full" placeholder="考试日期"
                    id="newJlptDate" />
                  <select className="px-3 py-2 border rounded-lg text-sm w-full" id="newJlptLevel" defaultValue="N1">
                    <option value="N1">N1</option>
                    <option value="N2">N2</option>
                    <option value="N3">N3</option>
                    <option value="N4">N4</option>
                    <option value="N5">N5</option>
                  </select>
                  <input type="number" className={`px-3 py-2 border rounded-lg text-sm ${isMobile ? 'w-full' : 'w-24'}`} placeholder="分数" id="newJlptScore" />
                  <button onClick={() => {
                    const date = document.getElementById('newJlptDate').value;
                    const level = document.getElementById('newJlptLevel').value;
                    const score = document.getElementById('newJlptScore').value;
                    if (level && score) {
                      setFormData({...formData, jlptScores: [...formData.jlptScores, { date, level, score }], jlptScore: `${level}-${score}`});
                      document.getElementById('newJlptDate').value = '';
                      document.getElementById('newJlptScore').value = '';
                    }
                  }} className={`px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition flex items-center justify-center gap-1 ${isMobile ? 'w-full' : ''}`}>
                    <Plus size={14} /> 添加
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 英语成绩 - 可追加 */}
          <div className="glass-panel p-4 sm:p-6">
            <h4 className="font-bold text-lg mb-4 flex items-center gap-2" style={{ color: tokens.colors.text.primary }}><BookOpen size={20} /> 英语成绩</h4>
            {formData.englishScores.length > 0 && (
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb' }}>
                      <th className="px-3 py-2 text-left font-medium text-themed-secondary">考试日期</th>
                      <th className="px-3 py-2 text-left font-medium text-themed-secondary">类型</th>
                      <th className="px-3 py-2 text-left font-medium text-themed-secondary">分数</th>
                      {isEditing && <th className="px-3 py-2"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {formData.englishScores.map((s, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-2">{s.date || '-'}</td>
                        <td className="px-3 py-2 font-semibold" style={{ color: '#22c55e' }}>{s.type || '-'}</td>
                        <td className="px-3 py-2">{s.score || '-'}</td>
                        {isEditing && (
                          <td className="px-3 py-2">
                            <button onClick={() => setFormData({...formData, englishScores: formData.englishScores.filter((_, idx) => idx !== i)})} className="text-red-500 hover:bg-red-50 p-1 rounded">
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
            {formData.englishScores.length === 0 && !isEditing && (
              <p className="text-themed-muted text-center py-4">暂无英语成绩记录</p>
            )}
            {isEditing && (
              <div className="bg-themed-elevated rounded-lg p-4">
                <p className="text-sm font-medium text-themed-secondary mb-3">添加英语成绩</p>
                <div className={`${isMobile ? 'grid grid-cols-2 gap-2' : 'flex gap-3 flex-wrap'}`}>
                  <input type="date" className="px-3 py-2 border rounded-lg text-sm w-full" placeholder="考试日期" id="newEngDate" />
                  <select className="px-3 py-2 border rounded-lg text-sm w-full" id="newEngType" defaultValue="TOEFL">
                    <option value="TOEFL">TOEFL</option>
                    <option value="IELTS">IELTS</option>
                    <option value="TOEIC">TOEIC</option>
                    <option value="其他">其他</option>
                  </select>
                  <input type="number" className={`px-3 py-2 border rounded-lg text-sm ${isMobile ? 'w-full' : 'w-24'}`} placeholder="分数" id="newEngScore" />
                  <button onClick={() => {
                    const date = document.getElementById('newEngDate').value;
                    const type = document.getElementById('newEngType').value;
                    const score = document.getElementById('newEngScore').value;
                    if (type && score) {
                      setFormData({...formData, englishScores: [...formData.englishScores, { date, type, score }], englishScore: `${type} ${score}`});
                      document.getElementById('newEngDate').value = '';
                      document.getElementById('newEngScore').value = '';
                    }
                  }} className={`px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 transition flex items-center justify-center gap-1 ${isMobile ? 'w-full' : ''}`}>
                    <Plus size={14} /> 添加
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="glass-panel p-4 sm:p-6">
            <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Calendar size={20} /> EJU 成绩记录
            </h4>

            {formData.ejuScores.length > 0 && (
              isMobile ? (
                /* 移动端：卡片式展示 EJU 成绩 */
                <div className="space-y-3 mb-4">
                  {formData.ejuScores.map(score => (
                    <div key={score.id} className="rounded-lg p-3" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}` }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs" style={{ color: tokens.colors.text.muted }}>{score.date}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold" style={{ color: '#3b82f6' }}>{score.totalScore}分</span>
                          {isEditing && (
                            <button onClick={() => handleRemoveEjuScore(score.id)} className="text-red-500 p-1 rounded">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        <div className="flex justify-between"><span style={{ color: tokens.colors.text.muted }}>日语</span><span style={{ color: tokens.colors.text.primary }}>{score.japanese || '-'}</span></div>
                        <div className="flex justify-between"><span style={{ color: tokens.colors.text.muted }}>日语记述</span><span style={{ color: tokens.colors.text.primary }}>{score.descriptive || '-'}</span></div>
                        <div className="flex justify-between"><span style={{ color: tokens.colors.text.muted }}>数学</span><span style={{ color: tokens.colors.text.primary }}>{score.math || '-'}</span></div>
                        <div className="flex justify-between"><span style={{ color: tokens.colors.text.muted }}>理科</span><span style={{ color: tokens.colors.text.primary }}>{score.science || '-'}</span></div>
                        <div className="flex justify-between"><span style={{ color: tokens.colors.text.muted }}>文综</span><span style={{ color: tokens.colors.text.primary }}>{score.generalSubjects || '-'}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* 桌面端：表格式展示 EJU 成绩 */
                <div className="overflow-x-auto mb-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb' }}>
                        <th className="px-3 py-2 text-left font-medium text-themed-secondary">考试日期</th>
                        <th className="px-3 py-2 text-left font-medium text-themed-secondary">总分</th>
                        <th className="px-3 py-2 text-left font-medium text-themed-secondary">日语</th>
                        <th className="px-3 py-2 text-left font-medium text-themed-secondary">日语记述</th>
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
                          <td className="px-3 py-2">{score.descriptive || '-'}</td>
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
              )
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
                    className="px-3 py-2 border rounded-lg text-sm" placeholder="日语(读解/听力)" />
                  <input type="number" value={newEjuScore.descriptive}
                    onChange={e => setNewEjuScore({...newEjuScore, descriptive: e.target.value})}
                    className="px-3 py-2 border rounded-lg text-sm" placeholder="日语记述" />
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
                  <div key={school.id} className={`${isMobile ? 'flex flex-col gap-2' : 'flex items-center justify-between'} p-3 sm:p-4 rounded-lg`} style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}` }}>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm sm:text-base truncate">{school.name}</div>
                      <div className="text-xs sm:text-sm text-themed-secondary truncate">{school.program} - {school.type}</div>
                    </div>
                    <div className={isMobile ? 'self-start' : ''}>
                      <StatusBadge status={school.status} />
                    </div>
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
            {mergedUpcomingEvents.filter(e => !e.completed).length > 0 ? (
              <div className="space-y-2">
                {mergedUpcomingEvents.filter(e => !e.completed).sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 5).map(event => (
                    <div key={event.id} className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg gap-2" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'transparent'}` }}>
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <span className="text-base sm:text-lg flex-shrink-0">{event.type === 'exam' ? '📝' : event.type === 'deadline' ? '⏰' : '✉️'}</span>
                      <div className="min-w-0">
                        <div className="font-medium text-xs sm:text-sm truncate">{event.title}</div>
                        <div className="text-[11px] sm:text-xs text-themed-secondary">{event.date}</div>
                      </div>
                    </div>
                    <span className={`text-xs sm:text-sm font-bold flex-shrink-0 ${                      event.daysLeft <= 7 ? 'text-red-500' : event.daysLeft <= 30 ? 'text-orange-500' : ''
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
                  className="flex-1 px-3 sm:px-4 py-2 sm:py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 min-h-[80px] resize-none text-sm sm:text-base"
                  placeholder="输入跟进备注内容..."
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      handleAddNote();
                    }
                  }}
                />
              </div>
              <div className="flex justify-between items-center mt-3">
                {!isMobile && <span className="text-xs text-themed-muted">Ctrl/Cmd + Enter 快速提交</span>}
                {isMobile && <span />}
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
                          className={`p-1 text-themed-muted hover:text-red-500 rounded transition ${isMobile ? 'opacity-60' : 'opacity-0 group-hover:opacity-100'}`}
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

import React, { useState, useMemo } from 'react';
import {
  Users, Search, Filter, ArrowRight, UserCircle,
  LayoutGrid, LayoutList, ChevronDown, ChevronUp,
  GraduationCap, School, AlertCircle, Plus
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const StudentListPage = ({
  user,
  getVisibleStudents,
  getTeacherList,
  onSelectStudent,
  onAddStudent,
}) => {
  const { isDark, tokens, glassEnabled } = useTheme();
  const visibleStudents = getVisibleStudents ? getVisibleStudents() : [];
  const teachers = getTeacherList ? getTeacherList() : [];

  // 获取学管老师名称
  const getAdvisorName = (student) => {
    if (!student.academicAdvisorId) return null;
    return teachers.find(t => (t.id || t.teacherId) === student.academicAdvisorId)?.name || null;
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [filterTeacher, setFilterTeacher] = useState('all');
  const [filterTeacherType, setFilterTeacherType] = useState('shengxue'); // shengxue | xueguan
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all'); // all | assigned | unassigned
  const [viewMode, setViewMode] = useState('card'); // card | table
  const [sortBy, setSortBy] = useState('name'); // name | progress | urgentTasks | studentId
  const [sortOrder, setSortOrder] = useState('asc');

  // 从 localStorage 获取每个学生的学校申请数据
  const studentSchoolData = useMemo(() => {
    const map = {};
    visibleStudents.forEach(student => {
      try {
        const key = student.studentId || 'default';
        const savedData = localStorage.getItem(`studentData_${key}`);
        if (savedData) {
          const data = JSON.parse(savedData);
          map[student.studentId] = {
            schools: data.schools || [],
            events: data.events || [],
            checklist: data.checklist || {},
          };
        }
      } catch {}
    });
    return map;
  }, [visibleStudents]);

  // 过滤
  const filteredStudents = useMemo(() => {
    return visibleStudents.filter(s => {
      // 搜索
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const nameMatch = s.name?.toLowerCase().includes(q);
        const idMatch = s.studentId?.toLowerCase().includes(q);
        const tagMatch = (s.tags || []).some(t => t.toLowerCase().includes(q));
        if (!nameMatch && !idMatch && !tagMatch) return false;
      }
      // 按老师筛选
      if (filterTeacher !== 'all') {
        if (filterTeacher === 'unassigned') {
          if (filterTeacherType === 'shengxue') {
            if (s.teacherId && s.teacherId !== 'unassigned') return false;
          } else {
            if (s.academicAdvisorId) return false;
          }
        } else {
          if (filterTeacherType === 'shengxue') {
            if (s.teacherId !== filterTeacher) return false;
          } else {
            if (s.academicAdvisorId !== filterTeacher) return false;
          }
        }
      }
      // 按文理科筛选
      if (filterSubject !== 'all' && s.subject !== filterSubject) return false;
      // 按分配状态筛选
      if (filterStatus === 'assigned' && (!s.teacherId || s.teacherId === 'unassigned')) return false;
      if (filterStatus === 'unassigned' && s.teacherId && s.teacherId !== 'unassigned') return false;
      return true;
    });
  }, [visibleStudents, searchQuery, filterTeacher, filterSubject, filterStatus]);

  // 排序
  const sortedStudents = useMemo(() => {
    return [...filteredStudents].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'name': cmp = (a.name || '').localeCompare(b.name || ''); break;
        case 'progress': cmp = (a.progress || 0) - (b.progress || 0); break;
        case 'urgentTasks': cmp = (a.urgentTasks || 0) - (b.urgentTasks || 0); break;
        case 'studentId': cmp = (a.studentId || '').localeCompare(b.studentId || ''); break;
        default: cmp = 0;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [filteredStudents, sortBy, sortOrder]);

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ field }) => {
    if (sortBy !== field) return <ChevronDown size={12} className="text-themed-muted" />;
    return sortOrder === 'asc' ? <ChevronUp size={12} className="text-blue-500" /> : <ChevronDown size={12} className="text-blue-500" />;
  };

  const getStudentSchoolCount = (studentId) => {
    return studentSchoolData[studentId]?.schools?.length || 0;
  };

  const getStudentStatusSummary = (studentId) => {
    const schools = studentSchoolData[studentId]?.schools || [];
    const counts = { preparing: 0, contacted: 0, submitted: 0, admitted: 0 };
    schools.forEach(s => {
      const status = s.status || 'preparing';
      if (counts[status] !== undefined) counts[status]++;
    });
    return counts;
  };

  // 统计数据
  const stats = useMemo(() => {
    const total = filteredStudents.length;
    const unassigned = filteredStudents.filter(s => !s.teacherId || s.teacherId === 'unassigned').length;
    const withUrgent = filteredStudents.filter(s => (s.urgentTasks || 0) > 0).length;
    const avgProgress = total > 0
      ? Math.round(filteredStudents.reduce((sum, s) => sum + (s.progress || 0), 0) / total)
      : 0;
    return { total, unassigned, withUrgent, avgProgress };
  }, [filteredStudents]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 标题栏 */}
      <div className="glass-panel p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold mb-1" style={{ color: tokens.colors.text.primary }}>学生管理</h2>
          <p className="text-sm" style={{ color: tokens.colors.text.muted }}>
            共 {stats.total} 名学生
            {stats.unassigned > 0 && <span style={{ color: '#f97316' }} className="ml-2">· {stats.unassigned} 人待分配</span>}
            {stats.withUrgent > 0 && <span style={{ color: '#ef4444' }} className="ml-2">· {stats.withUrgent} 人有紧急事项</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* 视图切换 */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${tokens.colors.border.subtle}` }}>
            <button onClick={() => setViewMode('card')}
              className="p-2 transition"
              style={{ background: viewMode === 'card' ? (isDark ? 'rgba(99,102,241,0.15)' : 'rgba(59,130,246,0.1)') : 'transparent', color: viewMode === 'card' ? tokens.colors.accent.primary : tokens.colors.text.muted }}>
              <LayoutGrid size={18} />
            </button>
            <button onClick={() => setViewMode('table')}
              className="p-2 transition"
              style={{ background: viewMode === 'table' ? (isDark ? 'rgba(99,102,241,0.15)' : 'rgba(59,130,246,0.1)') : 'transparent', color: viewMode === 'table' ? tokens.colors.accent.primary : tokens.colors.text.muted }}>
              <LayoutList size={18} />
            </button>
          </div>
          {onAddStudent && (
            <button onClick={onAddStudent}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg transition text-sm font-medium"
              style={{ background: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)', color: '#3b82f6' }}
              onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)'}>
              <Plus size={16} /> 添加学生
            </button>
          )}
        </div>
      </div>

      {/* 搜索和筛选 */}
      <div className="glass-panel p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* 搜索框 */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-themed-muted" />
            <input
              type="text"
              placeholder="搜索学生姓名、学号或标签..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          {/* 老师类型切换 + 老师筛选 */}
          {user.role === 'admin' && (
            <div className="flex items-center gap-1">
              <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${tokens.colors.border.subtle}` }}>
                <button onClick={() => { setFilterTeacherType('shengxue'); setFilterTeacher('all'); }}
                  className="px-2.5 py-2 text-xs transition font-medium"
                  style={{ background: filterTeacherType === 'shengxue' ? (isDark ? 'rgba(99,102,241,0.15)' : 'rgba(59,130,246,0.1)') : 'transparent', color: filterTeacherType === 'shengxue' ? tokens.colors.accent.primary : tokens.colors.text.muted }}>
                  升学
                </button>
                <button onClick={() => { setFilterTeacherType('xueguan'); setFilterTeacher('all'); }}
                  className="px-2.5 py-2 text-xs transition font-medium"
                  style={{ background: filterTeacherType === 'xueguan' ? (isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)') : 'transparent', color: filterTeacherType === 'xueguan' ? '#22c55e' : tokens.colors.text.muted }}>
                  学管
                </button>
              </div>
              <select value={filterTeacher} onChange={(e) => setFilterTeacher(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', color: tokens.colors.text.primary, borderColor: isDark ? 'rgba(255,255,255,0.1)' : undefined }}>
                <option value="all">{filterTeacherType === 'shengxue' ? '所有升学老师' : '所有学管老师'}</option>
                {teachers.map(t => (
                  <option key={t.id || t.teacherId} value={t.id || t.teacherId}>{t.name}</option>
                ))}
                <option value="unassigned">待分配</option>
              </select>
            </div>
          )}
          {/* 文理科筛选 */}
          <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', color: tokens.colors.text.primary, borderColor: isDark ? 'rgba(255,255,255,0.1)' : undefined }}>
            <option value="all">全部科目</option>
            <option value="文科">文科</option>
            <option value="理科">理科</option>
          </select>
        </div>
      </div>

      {/* 概况统计条 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)' }}>
              <Users size={18} style={{ color: '#3b82f6' }} />
            </div>
            <span className="text-xs" style={{ color: tokens.colors.text.muted }}>学生总数</span>
          </div>
          <div className="text-2xl font-bold" style={{ color: tokens.colors.text.primary }}>{stats.total}</div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)' }}>
              <GraduationCap size={18} style={{ color: '#22c55e' }} />
            </div>
            <span className="text-xs" style={{ color: tokens.colors.text.muted }}>平均进度</span>
          </div>
          <div className="text-2xl font-bold" style={{ color: tokens.colors.text.primary }}>{stats.avgProgress}%</div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: isDark ? 'rgba(249,115,22,0.15)' : 'rgba(249,115,22,0.1)' }}>
              <AlertCircle size={18} style={{ color: '#f97316' }} />
            </div>
            <span className="text-xs" style={{ color: tokens.colors.text.muted }}>待分配</span>
          </div>
          <div className="text-2xl font-bold" style={{ color: stats.unassigned > 0 ? '#f97316' : tokens.colors.text.muted }}>{stats.unassigned}</div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)' }}>
              <AlertCircle size={18} style={{ color: '#ef4444' }} />
            </div>
            <span className="text-xs" style={{ color: tokens.colors.text.muted }}>有紧急事项</span>
          </div>
          <div className="text-2xl font-bold" style={{ color: stats.withUrgent > 0 ? '#ef4444' : tokens.colors.text.muted }}>{stats.withUrgent}</div>
        </div>
      </div>

      {/* 学生列表 */}
      {viewMode === 'card' ? (
        // 卡片视图
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedStudents.length > 0 ? sortedStudents.map(student => {
            const schoolCount = getStudentSchoolCount(student.studentId);
            const statusSummary = getStudentStatusSummary(student.studentId);

            return (
              <div key={student.id}
                className="glass-card cursor-pointer overflow-hidden"
                onClick={() => onSelectStudent(student)}>
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="text-3xl">{student.avatar || '👨‍🎓'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-themed-primary truncate">{student.name}</span>
                        {student.subject && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{
                              background: student.subject === '理科'
                                ? (isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)')
                                : (isDark ? 'rgba(249,115,22,0.15)' : 'rgba(249,115,22,0.1)'),
                              color: student.subject === '理科' ? '#3b82f6' : '#f97316',
                            }}>{student.subject}</span>
                        )}
                      </div>
                      <div className="text-xs text-themed-muted">{student.studentId}</div>
                    </div>
                    <ArrowRight size={16} className="text-themed-muted flex-shrink-0" />
                  </div>

                  {/* 进度条 */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-themed-secondary">整体进度</span>
                      <span className="font-bold text-themed-primary">{student.progress || 0}%</span>
                    </div>
                    <div className="w-full bg-themed-elevated rounded-full h-2">
                      <div className="bg-blue-500 rounded-full h-2 transition-all"
                        style={{ width: `${Math.min(100, student.progress || 0)}%` }} />
                    </div>
                  </div>

                  {/* 学校申请统计 */}
                  <div className="flex items-center gap-2 text-xs mb-2">
                    <School size={12} className="text-themed-muted" />
                    <span className="text-themed-secondary">报考 {schoolCount} 所</span>
                    {statusSummary.admitted > 0 && (
                      <span className="text-green-600 font-medium">{statusSummary.admitted} 合格</span>
                    )}
                    {statusSummary.submitted > 0 && (
                      <span className="text-purple-600 font-medium">{statusSummary.submitted} 已提交</span>
                    )}
                  </div>

                  {/* 标签 */}
                  {(student.tags || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {student.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 bg-themed-elevated text-themed-secondary rounded-full">
                          {tag}
                        </span>
                      ))}
                      {student.tags.length > 3 && (
                        <span className="text-[10px] text-themed-muted">+{student.tags.length - 3}</span>
                      )}
                    </div>
                  )}

                  {/* 底部信息 */}
                  <div className="flex items-center justify-between pt-2" style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb'}` }}>
                    <div className="flex items-center gap-2">
                      {user.role === 'admin' && (
                        <span className="text-xs text-themed-muted">
                          升学: {teachers.find(t => (t.id || t.teacherId) === student.teacherId)?.name || '待分配'}
                        </span>
                      )}
                      {getAdvisorName(student) && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: isDark ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.08)', color: isDark ? '#86efac' : '#16a34a' }}>
                          学管: {getAdvisorName(student)}
                        </span>
                      )}
                    </div>
                    {(student.urgentTasks || 0) > 0 && (
                      <span className="text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle size={12} /> {student.urgentTasks} 紧急
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="col-span-full text-center py-12 text-themed-muted">
              <Users size={48} className="mx-auto mb-3 text-themed-muted" />
              <p className="text-lg font-medium">暂无匹配的学生</p>
              <p className="text-sm">试试调整筛选条件</p>
            </div>
          )}
        </div>
      ) : (
        // 表格视图
        <div className="glass-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-themed-subtle" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb' }}>
                  <th className="text-left py-3 px-4 font-medium text-themed-secondary cursor-pointer hover:text-themed-primary"
                    onClick={() => toggleSort('name')}>
                    <div className="flex items-center gap-1">学生 <SortIcon field="name" /></div>
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-themed-secondary cursor-pointer hover:text-themed-primary"
                    onClick={() => toggleSort('studentId')}>
                    <div className="flex items-center gap-1">学号 <SortIcon field="studentId" /></div>
                  </th>
                  <th className="text-center py-3 px-4 font-medium text-themed-secondary">科目</th>
                  <th className="text-center py-3 px-4 font-medium text-themed-secondary cursor-pointer hover:text-themed-primary"
                    onClick={() => toggleSort('progress')}>
                    <div className="flex items-center justify-center gap-1">进度 <SortIcon field="progress" /></div>
                  </th>
                  <th className="text-center py-3 px-4 font-medium text-themed-secondary">报考</th>
                  <th className="text-center py-3 px-4 font-medium text-themed-secondary">状态</th>
                  {user.role === 'admin' && (
                    <th className="text-center py-3 px-4 font-medium text-themed-secondary">升学老师</th>
                  )}
                  <th className="text-center py-3 px-4 font-medium text-themed-secondary">学管老师</th>
                  <th className="text-center py-3 px-4 font-medium text-themed-secondary cursor-pointer hover:text-themed-primary"
                    onClick={() => toggleSort('urgentTasks')}>
                    <div className="flex items-center justify-center gap-1">紧急 <SortIcon field="urgentTasks" /></div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedStudents.map(student => {
                  const schoolCount = getStudentSchoolCount(student.studentId);
                  const statusSummary = getStudentStatusSummary(student.studentId);
                  return (
                    <tr key={student.id}
                      className="cursor-pointer transition"
                      style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb'}` }}
                      onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(59,130,246,0.08)' : '#eff6ff'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      onClick={() => onSelectStudent(student)}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{student.avatar || '👨‍🎓'}</span>
                          <span className="font-medium text-themed-primary">{student.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-themed-secondary">{student.studentId}</td>
                      <td className="py-3 px-4 text-center">
                        {student.subject ? (
                          <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{
                              background: student.subject === '理科'
                                ? (isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)')
                                : (isDark ? 'rgba(249,115,22,0.15)' : 'rgba(249,115,22,0.1)'),
                              color: student.subject === '理科' ? '#3b82f6' : '#f97316',
                            }}>{student.subject}</span>
                        ) : <span className="text-themed-muted">-</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 bg-themed-elevated rounded-full h-1.5">
                            <div className="bg-blue-500 rounded-full h-1.5" style={{ width: `${student.progress || 0}%` }} />
                          </div>
                          <span className="text-xs font-medium text-themed-secondary">{student.progress || 0}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-medium text-themed-primary">{schoolCount}</td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {statusSummary.admitted > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: isDark ? 'rgba(234,179,8,0.15)' : 'rgba(234,179,8,0.1)', color: '#eab308' }}>
                              合{statusSummary.admitted}
                            </span>
                          )}
                          {statusSummary.submitted > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: isDark ? 'rgba(168,85,247,0.15)' : 'rgba(168,85,247,0.1)', color: '#a855f7' }}>
                              提{statusSummary.submitted}
                            </span>
                          )}
                          {statusSummary.contacted > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                              联{statusSummary.contacted}
                            </span>
                          )}
                          {statusSummary.preparing > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
                              备{statusSummary.preparing}
                            </span>
                          )}
                          {schoolCount === 0 && <span className="text-themed-muted text-xs">-</span>}
                        </div>
                      </td>
                      {user.role === 'admin' && (
                        <td className="py-3 px-4 text-center text-xs text-themed-secondary">
                          {teachers.find(t => (t.id || t.teacherId) === student.teacherId)?.name || (
                            <span className="text-orange-500">待分配</span>
                          )}
                        </td>
                      )}
                      <td className="py-3 px-4 text-center text-xs">
                        {getAdvisorName(student) ? (
                          <span style={{ color: isDark ? '#86efac' : '#16a34a' }}>{getAdvisorName(student)}</span>
                        ) : (
                          <span className="text-themed-muted">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {(student.urgentTasks || 0) > 0 ? (
                          <span className="text-xs text-red-500 font-bold">{student.urgentTasks}</span>
                        ) : (
                          <span className="text-themed-muted">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {sortedStudents.length === 0 && (
            <div className="text-center py-12 text-themed-muted">
              <Users size={48} className="mx-auto mb-3 text-themed-muted" />
              <p>暂无匹配的学生</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentListPage;

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

  const [searchQuery, setSearchQuery] = useState('');
  const [filterTeacher, setFilterTeacher] = useState('all');
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
          if (s.teacherId && s.teacherId !== 'unassigned') return false;
        } else {
          if (s.teacherId !== filterTeacher) return false;
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm text-themed-secondary">
            共 {stats.total} 名学生
            {stats.unassigned > 0 && <span className="text-orange-500 ml-2">· {stats.unassigned} 人待分配</span>}
            {stats.withUrgent > 0 && <span className="text-red-500 ml-2">· {stats.withUrgent} 人有紧急事项</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* 视图切换 */}
          <div className="flex border rounded-lg overflow-hidden">
            <button onClick={() => setViewMode('card')}
              className={`p-2 ${viewMode === 'card' ? 'bg-blue-50 text-blue-600' : 'text-themed-muted hover:bg-themed-elevated'}`}>
              <LayoutGrid size={18} />
            </button>
            <button onClick={() => setViewMode('table')}
              className={`p-2 ${viewMode === 'table' ? 'bg-blue-50 text-blue-600' : 'text-themed-muted hover:bg-themed-elevated'}`}>
              <LayoutList size={18} />
            </button>
          </div>
          {onAddStudent && (
            <button onClick={onAddStudent}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm font-medium">
              <Plus size={16} /> 添加学生
            </button>
          )}
        </div>
      </div>

      {/* 搜索和筛选 */}
      <div className="bg-themed-surface rounded-xl border-2 border-themed-subtle p-4">
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
          {/* 老师筛选 */}
          {user.role === 'admin' && (
            <select value={filterTeacher} onChange={(e) => setFilterTeacher(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', color: tokens.colors.text.primary, borderColor: isDark ? 'rgba(255,255,255,0.1)' : undefined }}>
              <option value="all">所有老师</option>
              {teachers.map(t => (
                <option key={t.id || t.teacherId} value={t.id || t.teacherId}>{t.name}</option>
              ))}
              <option value="unassigned">待分配</option>
            </select>
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-themed-surface rounded-lg border p-3 text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
          <div className="text-xs text-themed-secondary">学生总数</div>
        </div>
        <div className="bg-themed-surface rounded-lg border p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{stats.avgProgress}%</div>
          <div className="text-xs text-themed-secondary">平均进度</div>
        </div>
        <div className="bg-themed-surface rounded-lg border p-3 text-center">
          <div className={`text-2xl font-bold ${stats.unassigned > 0 ? 'text-orange-500' : 'text-themed-muted'}`}>{stats.unassigned}</div>
          <div className="text-xs text-themed-secondary">待分配</div>
        </div>
        <div className="bg-themed-surface rounded-lg border p-3 text-center">
          <div className={`text-2xl font-bold ${stats.withUrgent > 0 ? 'text-red-500' : 'text-themed-muted'}`}>{stats.withUrgent}</div>
          <div className="text-xs text-themed-secondary">有紧急事项</div>
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
                className="bg-themed-surface rounded-xl border-2 border-themed-subtle hover:border-blue-300 hover:shadow-lg transition cursor-pointer overflow-hidden"
                onClick={() => onSelectStudent(student)}>
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="text-3xl">{student.avatar || '👨‍🎓'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-themed-primary truncate">{student.name}</span>
                        {student.subject && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            student.subject === '理科' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                          }`}>{student.subject}</span>
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
                    {user.role === 'admin' && (
                      <span className="text-xs text-themed-muted">
                        {teachers.find(t => (t.id || t.teacherId) === student.teacherId)?.name || '待分配'}
                      </span>
                    )}
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
        <div className="bg-themed-surface rounded-xl border-2 border-themed-subtle overflow-hidden">
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
                    <th className="text-center py-3 px-4 font-medium text-themed-secondary">负责老师</th>
                  )}
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
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            student.subject === '理科' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                          }`}>{student.subject}</span>
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
                            <span className="text-[10px] px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded">
                              合{statusSummary.admitted}
                            </span>
                          )}
                          {statusSummary.submitted > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                              提{statusSummary.submitted}
                            </span>
                          )}
                          {statusSummary.contacted > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                              联{statusSummary.contacted}
                            </span>
                          )}
                          {statusSummary.preparing > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
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

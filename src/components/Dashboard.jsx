import React, { useMemo, useState } from 'react';
import {
  Users, Clock, School, AlertCircle, CheckSquare,
  TrendingUp, Calendar, UserCheck, BookOpen, ArrowRight,
  Filter, BarChart3, PieChart, GraduationCap, ChevronDown, ChevronUp
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

// === SVG 饼图组件 ===
const PieChartSVG = ({ data, size = 160 }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>暂无数据</span>
      </div>
    );
  }
  const r = size / 2 - 8;
  const cx = size / 2;
  const cy = size / 2;
  let currentAngle = -Math.PI / 2;

  const slices = data.filter(d => d.value > 0).map((d) => {
    const angle = (d.value / total) * 2 * Math.PI;
    const startX = cx + r * Math.cos(currentAngle);
    const startY = cy + r * Math.sin(currentAngle);
    const endX = cx + r * Math.cos(currentAngle + angle);
    const endY = cy + r * Math.sin(currentAngle + angle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const path = `M ${cx} ${cy} L ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY} Z`;
    currentAngle += angle;
    return { ...d, path, percentage: Math.round(d.value / total * 100) };
  });

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size}>
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="var(--theme-border-subtle)" strokeWidth="2" className="transition-all hover:opacity-80">
            <title>{s.label}: {s.value} ({s.percentage}%)</title>
          </path>
        ))}
      </svg>
      <div className="space-y-1.5">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span style={{ color: 'var(--theme-text-secondary)' }}>{s.label}</span>
            <span className="font-bold" style={{ color: 'var(--theme-text-primary)' }}>{s.value}</span>
            <span style={{ color: 'var(--theme-text-muted)' }}>({s.percentage}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// === SVG 柱状图组件 ===
const BarChartSVG = ({ data, height = 200 }) => {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const barWidth = Math.min(40, Math.max(20, 300 / data.length));
  const chartWidth = Math.max(300, data.length * (barWidth + 12) + 40);

  return (
    <div className="overflow-x-auto">
      <svg width={chartWidth} height={height + 40} className="min-w-full">
        {/* Y轴参考线 */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
          <g key={i}>
            <line x1="30" y1={height - ratio * (height - 20)} x2={chartWidth} y2={height - ratio * (height - 20)}
              stroke="var(--theme-border-subtle)" strokeWidth="1" strokeDasharray={i > 0 ? "4,4" : "0"} />
            <text x="25" y={height - ratio * (height - 20) + 4} textAnchor="end" className="text-[10px]" fill="var(--theme-text-muted)">
              {Math.round(maxVal * ratio)}
            </text>
          </g>
        ))}
        {/* 柱子 */}
        {data.map((d, i) => {
          const barHeight = (d.value / maxVal) * (height - 20);
          const x = 40 + i * (barWidth + 12);
          return (
            <g key={i}>
              <rect x={x} y={height - barHeight} width={barWidth} height={barHeight}
                fill={d.color || '#3b82f6'} rx="4" className="transition-all hover:opacity-80">
                <title>{d.label}: {d.value}</title>
              </rect>
              <text x={x + barWidth / 2} y={height - barHeight - 5} textAnchor="middle" className="text-[10px] font-medium" fill="var(--theme-text-secondary)">
                {d.value}
              </text>
              <text x={x + barWidth / 2} y={height + 15} textAnchor="middle" className="text-[10px]" fill="var(--theme-text-muted)">
                {d.label.length > 4 ? d.label.slice(0, 4) + '..' : d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const Dashboard = ({
  user,
  studentList,
  events,
  schools,
  checklist,
  getVisibleStudents,
  getTeacherList,
  onNavigate,
  onSelectStudent,
  onViewAllStudents,
}) => {
  const { isDark, tokens, glassEnabled } = useTheme();

  const visibleStudents = getVisibleStudents ? getVisibleStudents() : [];
  const teachers = getTeacherList ? getTeacherList() : [];

  // 过滤状态
  const [filterGroup, setFilterGroup] = useState('all'); // all | teacher_xxx | type_国立 | status_xxx | school_xxx
  const [showFilters, setShowFilters] = useState(false);

  // === 聚合全部学生数据（从 localStorage 读取每个学生的完整数据）===
  const aggregatedData = useMemo(() => {
    const allSchoolApps = [];
    const allEvents = [];
    let totalMaterials = 0;
    let completedMaterials = 0;
    const schoolStats = {}; // schoolName -> { total, preparing, contacted, submitted, admitted, type }
    const teacherStudentMap = {}; // teacherId -> [students]
    const schoolTypeMap = {}; // 国立/公立/私立 -> count
    const statusCounts = { preparing: 0, contacted: 0, submitted: 0, admitted: 0 };

    visibleStudents.forEach(student => {
      // 按老师分组
      const tid = student.teacherId || 'unassigned';
      if (!teacherStudentMap[tid]) teacherStudentMap[tid] = [];
      teacherStudentMap[tid].push(student);

      // 从 localStorage 读取学生数据
      try {
        const key = student.studentId || 'default';
        const savedData = localStorage.getItem(`studentData_${key}`);
        if (!savedData) return;
        const data = JSON.parse(savedData);

        // 聚合事件
        const studentEvents = data.events || [];
        studentEvents.forEach(e => {
          allEvents.push({ ...e, studentName: student.name, studentId: student.studentId });
        });

        // 聚合学校申请
        const studentSchools = data.schools || [];
        studentSchools.forEach(school => {
          allSchoolApps.push({ ...school, studentName: student.name, studentId: student.studentId, teacherId: student.teacherId });
          const status = school.status || 'preparing';
          if (statusCounts[status] !== undefined) statusCounts[status]++;

          // 按学校统计
          if (!schoolStats[school.name]) {
            schoolStats[school.name] = { total: 0, preparing: 0, contacted: 0, submitted: 0, admitted: 0, type: school.type || '' };
          }
          schoolStats[school.name].total++;
          if (schoolStats[school.name][status] !== undefined) schoolStats[school.name][status]++;

          // 按学校类型
          const sType = school.type || '未分类';
          schoolTypeMap[sType] = (schoolTypeMap[sType] || 0) + 1;
        });

        // 聚合材料
        const cl = data.checklist || {};
        const generalItems = cl.general || [];
        totalMaterials += generalItems.length;
        completedMaterials += generalItems.filter(i => i.completed).length;
      } catch {}
    });

    // 排序学校
    const sortedSchools = Object.entries(schoolStats)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.total - a.total);

    const urgentEvents = allEvents.filter(e => e.urgent && !e.completed);
    const upcomingEvents = allEvents.filter(e => {
      if (e.completed) return false;
      const days = e.daysLeft || 0;
      return days >= 0 && days <= 7;
    });

    const unassignedStudents = visibleStudents.filter(s => !s.teacherId || s.teacherId === 'unassigned');

    return {
      totalStudents: visibleStudents.length,
      unassignedStudents: unassignedStudents.length,
      totalTeachers: teachers.length,
      totalApplications: allSchoolApps.length,
      statusCounts,
      totalAdmitted: statusCounts.admitted,
      admissionRate: allSchoolApps.length > 0 ? Math.round(statusCounts.admitted / allSchoolApps.length * 100) : 0,
      totalEvents: allEvents.length,
      urgentEvents: urgentEvents.length,
      upcomingEvents: upcomingEvents.length,
      totalMaterials,
      completedMaterials,
      materialProgress: totalMaterials > 0 ? Math.round(completedMaterials / totalMaterials * 100) : 0,
      sortedSchools,
      schoolTypeMap,
      teacherStudentMap,
      allSchoolApps,
    };
  }, [visibleStudents, teachers]);

  // 学生-学校映射缓存（必须在 filteredStudents 之前定义）
  const studentSchoolMap = useMemo(() => {
    const map = {};
    visibleStudents.forEach(student => {
      try {
        const key = student.studentId || 'default';
        const savedData = localStorage.getItem(`studentData_${key}`);
        if (savedData) {
          const data = JSON.parse(savedData);
          map[student.studentId] = data.schools || [];
        }
      } catch {}
    });
    return map;
  }, [visibleStudents]);

  // === 应用过滤器 ===
  const filteredStudents = useMemo(() => {
    if (filterGroup === 'all') return visibleStudents;
    if (filterGroup.startsWith('teacher_')) {
      const tid = filterGroup.replace('teacher_', '');
      if (tid === 'unassigned') return visibleStudents.filter(s => !s.teacherId || s.teacherId === 'unassigned');
      return visibleStudents.filter(s => s.teacherId === tid);
    }
    if (filterGroup.startsWith('subject_')) {
      const sub = filterGroup.replace('subject_', '');
      return visibleStudents.filter(s => s.subject === sub);
    }
    if (filterGroup.startsWith('school_')) {
      const schoolName = filterGroup.replace('school_', '');
      return visibleStudents.filter(s => {
        const sd = studentSchoolMap[s.studentId];
        return sd && sd.some(sch => sch.name === schoolName);
      });
    }
    if (filterGroup.startsWith('status_')) {
      const status = filterGroup.replace('status_', '');
      return visibleStudents.filter(s => {
        const sd = studentSchoolMap[s.studentId];
        return sd && sd.some(sch => (sch.status || 'preparing') === status);
      });
    }
    return visibleStudents;
  }, [filterGroup, visibleStudents, studentSchoolMap]);

  // === 过滤后的学校申请统计 ===
  const filteredSchoolApps = useMemo(() => {
    if (filterGroup === 'all') return aggregatedData.allSchoolApps;
    const studentIds = new Set(filteredStudents.map(s => s.studentId));
    return aggregatedData.allSchoolApps.filter(a => studentIds.has(a.studentId));
  }, [filterGroup, filteredStudents, aggregatedData.allSchoolApps]);

  const filteredStatusCounts = useMemo(() => {
    const counts = { preparing: 0, contacted: 0, submitted: 0, admitted: 0 };
    filteredSchoolApps.forEach(a => {
      const status = a.status || 'preparing';
      if (counts[status] !== undefined) counts[status]++;
    });
    return counts;
  }, [filteredSchoolApps]);

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? '早上好' : currentHour < 18 ? '下午好' : '晚上好';

  // 饼图数据
  const statusPieData = [
    { label: '准备中', value: filteredStatusCounts.preparing, color: '#3b82f6' },
    { label: '已联系', value: filteredStatusCounts.contacted, color: '#22c55e' },
    { label: '已提交', value: filteredStatusCounts.submitted, color: '#a855f7' },
    { label: '已合格', value: filteredStatusCounts.admitted, color: '#eab308' },
  ];

  const schoolTypePieData = Object.entries(aggregatedData.schoolTypeMap).map(([type, count]) => ({
    label: type,
    value: count,
    color: type === '国立' ? '#3b82f6' : type === '公立' ? '#22c55e' : type === '私立' ? '#f97316' : '#9ca3af',
  }));

  // 柱状图数据 - top 8 学校
  const schoolBarData = aggregatedData.sortedSchools.slice(0, 8).map((s, i) => ({
    label: s.name,
    value: s.total,
    color: ['#3b82f6', '#22c55e', '#a855f7', '#eab308', '#f97316', '#ec4899', '#14b8a6', '#8b5cf6'][i % 8],
  }));

  // 老师学生分布柱状图
  const teacherBarData = teachers.map((t, i) => ({
    label: t.name,
    value: (aggregatedData.teacherStudentMap[t.teacherId] || []).length,
    color: ['#a855f7', '#3b82f6', '#22c55e', '#f97316', '#ec4899', '#eab308'][i % 6],
  }));

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

  // 指标卡片通用样式
  const metricCardStyle = (hoverColor) => ({
    ...glassCardStyle,
    transition: `all ${tokens.shadow ? '250' : '200'}ms cubic-bezier(0.16,1,0.3,1)`,
    cursor: 'pointer',
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 欢迎区域 */}
      <div className="rounded-2xl p-5 lg:p-6" style={glassCardStyle}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold mb-1" style={{ color: tokens.colors.text.primary }}>
              {greeting}，{user.name}
            </h1>
            <p className="text-sm" style={{ color: tokens.colors.text.muted }}>
              {user.role === 'admin'
                ? `管理员仪表盘 — ${aggregatedData.totalStudents} 名学生 · ${aggregatedData.totalTeachers} 名老师 · ${aggregatedData.totalApplications} 条报考`
                : '教师管理端 — 查看您的学生和工作概况'}
            </p>
          </div>
          {/* 过滤切换按钮 */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition"
            style={{
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              color: tokens.colors.text.secondary,
            }}
          >
            <Filter size={16} />
            {filterGroup === 'all' ? '筛选' : '已筛选'}
            {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* 过滤器面板 */}
        {showFilters && (
          <div className="mt-4 p-4 rounded-xl space-y-3 animate-fade-in" style={{
            background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            border: `1px solid ${tokens.colors.border.subtle}`,
          }}>
            {/* 管理员可以按老师筛选，老师默认自己不可修改 */}
            {user.role === 'admin' && (
              <>
                <div className="text-xs font-medium mb-1" style={{ color: tokens.colors.text.muted }}>按老师筛选</div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setFilterGroup('all')}
                    className="px-3 py-1.5 rounded-full text-xs font-medium transition"
                    style={{
                      background: filterGroup === 'all' ? tokens.colors.accent.primary : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                      color: filterGroup === 'all' ? tokens.colors.text.inverse : tokens.colors.text.secondary,
                      border: filterGroup === 'all' ? 'none' : `1px solid ${tokens.colors.border.subtle}`,
                    }}>
                    全部
                  </button>
                  {teachers.map(t => (
                    <button key={t.teacherId} onClick={() => setFilterGroup(`teacher_${t.teacherId}`)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium transition"
                      style={{
                        background: filterGroup === `teacher_${t.teacherId}` ? tokens.colors.accent.primary : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                        color: filterGroup === `teacher_${t.teacherId}` ? tokens.colors.text.inverse : tokens.colors.text.secondary,
                        border: filterGroup === `teacher_${t.teacherId}` ? 'none' : `1px solid ${tokens.colors.border.subtle}`,
                      }}>
                      {t.name}
                    </button>
                  ))}
                  {aggregatedData.unassignedStudents > 0 && (
                    <button onClick={() => setFilterGroup('teacher_unassigned')}
                      className="px-3 py-1.5 rounded-full text-xs font-medium transition"
                      style={{
                        background: filterGroup === 'teacher_unassigned' ? tokens.colors.accent.warning : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                        color: filterGroup === 'teacher_unassigned' ? tokens.colors.text.inverse : tokens.colors.text.secondary,
                        border: filterGroup === 'teacher_unassigned' ? 'none' : `1px solid ${tokens.colors.border.subtle}`,
                      }}>
                      待分配 ({aggregatedData.unassignedStudents})
                    </button>
                  )}
                </div>
              </>
            )}
            {user.role === 'teacher' && (
              <div className="text-xs" style={{ color: tokens.colors.text.muted }}>
                👤 当前筛选: {user.name}（仅显示您名下的学生）
              </div>
            )}
            <div className="text-xs font-medium mb-1" style={{ color: tokens.colors.text.muted }}>按文理科筛选</div>
            <div className="flex flex-wrap gap-2">
              {['文科', '理科'].map(sub => (
                <button key={sub} onClick={() => setFilterGroup(filterGroup === `subject_${sub}` ? 'all' : `subject_${sub}`)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition"
                  style={{
                    background: filterGroup === `subject_${sub}` ? tokens.colors.accent.primary : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                    color: filterGroup === `subject_${sub}` ? tokens.colors.text.inverse : tokens.colors.text.secondary,
                    border: filterGroup === `subject_${sub}` ? 'none' : `1px solid ${tokens.colors.border.subtle}`,
                  }}>
                  {sub}
                </button>
              ))}
            </div>
            <div className="text-xs font-medium mb-1" style={{ color: tokens.colors.text.muted }}>按申请状态筛选</div>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'preparing', label: '准备中', color: 'blue' },
                { key: 'contacted', label: '已联系', color: 'green' },
                { key: 'submitted', label: '已提交', color: 'purple' },
                { key: 'admitted', label: '已合格', color: 'yellow' },
              ].map(s => (
                <button key={s.key} onClick={() => setFilterGroup(filterGroup === `status_${s.key}` ? 'all' : `status_${s.key}`)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition"
                  style={{
                    background: filterGroup === `status_${s.key}` ? tokens.colors.accent.primary : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                    color: filterGroup === `status_${s.key}` ? tokens.colors.text.inverse : tokens.colors.text.secondary,
                    border: filterGroup === `status_${s.key}` ? 'none' : `1px solid ${tokens.colors.border.subtle}`,
                  }}>
                  {s.label} ({aggregatedData.statusCounts[s.key] || 0})
                </button>
              ))}
            </div>
            {aggregatedData.sortedSchools.length > 0 && (
              <>
                <div className="text-xs font-medium mb-1" style={{ color: tokens.colors.text.muted }}>按报考学校筛选</div>
                <div className="flex flex-wrap gap-2">
                  {aggregatedData.sortedSchools.slice(0, 10).map(s => (
                    <button key={s.name} onClick={() => setFilterGroup(filterGroup === `school_${s.name}` ? 'all' : `school_${s.name}`)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium transition"
                      style={{
                        background: filterGroup === `school_${s.name}` ? tokens.colors.accent.primary : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                        color: filterGroup === `school_${s.name}` ? tokens.colors.text.inverse : tokens.colors.text.secondary,
                        border: filterGroup === `school_${s.name}` ? 'none' : `1px solid ${tokens.colors.border.subtle}`,
                      }}>
                      {s.name} ({s.total})
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* 关键指标卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 cursor-pointer" onClick={() => onNavigate('profile')}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)' }}>
              <Users size={20} style={{ color: '#3b82f6' }} />
            </div>
            <span className="text-sm" style={{ color: tokens.colors.text.muted }}>学生总数</span>
          </div>
          <div className="text-3xl font-bold animate-number" style={{ color: tokens.colors.text.primary }}>{filteredStudents.length}</div>
          {aggregatedData.unassignedStudents > 0 && filterGroup === 'all' && (
            <p className="text-xs mt-1 flex items-center gap-1" style={{ color: tokens.colors.accent.warning }}>
              <AlertCircle size={12} /> {aggregatedData.unassignedStudents} 人待分配
            </p>
          )}
        </div>

        <div className="glass-card p-5 cursor-pointer" onClick={() => onNavigate('timeline')}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: isDark ? 'rgba(249,115,22,0.15)' : 'rgba(249,115,22,0.1)' }}>
              <Clock size={20} style={{ color: '#f97316' }} />
            </div>
            <span className="text-sm" style={{ color: tokens.colors.text.muted }}>待处理事件</span>
          </div>
          <div className="text-3xl font-bold animate-number" style={{ color: tokens.colors.text.primary }}>{aggregatedData.upcomingEvents}</div>
          {aggregatedData.urgentEvents > 0 && (
            <p className="text-xs mt-1 flex items-center gap-1" style={{ color: tokens.colors.accent.danger }}>
              <AlertCircle size={12} /> {aggregatedData.urgentEvents} 个紧急
            </p>
          )}
        </div>

        <div className="glass-card p-5 cursor-pointer" onClick={() => onNavigate('schools')}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)' }}>
              <School size={20} style={{ color: '#22c55e' }} />
            </div>
            <span className="text-sm" style={{ color: tokens.colors.text.muted }}>报考总数</span>
          </div>
          <div className="text-3xl font-bold animate-number" style={{ color: tokens.colors.text.primary }}>{filteredSchoolApps.length}</div>
          {aggregatedData.totalAdmitted > 0 && (
            <p className="text-xs mt-1" style={{ color: tokens.colors.accent.success }}>{aggregatedData.admissionRate}% 合格率</p>
          )}
        </div>

        <div className="glass-card p-5 cursor-pointer" onClick={() => onNavigate('checklist')}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: isDark ? 'rgba(168,85,247,0.15)' : 'rgba(168,85,247,0.1)' }}>
              <CheckSquare size={20} style={{ color: '#a855f7' }} />
            </div>
            <span className="text-sm" style={{ color: tokens.colors.text.muted }}>材料进度</span>
          </div>
          <div className="text-3xl font-bold animate-number" style={{ color: tokens.colors.text.primary }}>{aggregatedData.materialProgress}%</div>
          <p className="text-xs mt-1" style={{ color: tokens.colors.text.muted }}>{aggregatedData.completedMaterials}/{aggregatedData.totalMaterials} 完成</p>
        </div>
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 申请状态分布饼图 */}
        <div className="glass-panel p-5">
          <h3 className="font-bold text-base mb-4 flex items-center gap-2" style={{ color: tokens.colors.text.primary }}>
            <PieChart size={18} style={{ color: '#3b82f6' }} /> 申请状态分布
            {filterGroup !== 'all' && <span className="text-xs font-normal px-2 py-0.5 rounded-full" style={{
              background: isDark ? 'rgba(168,85,247,0.12)' : 'rgba(168,85,247,0.08)',
              color: tokens.colors.accent.secondary,
            }}>已筛选</span>}
          </h3>
          <PieChartSVG data={statusPieData} />
        </div>

        {/* 学校类型分布饼图 */}
        <div className="glass-panel p-5">
          <h3 className="font-bold text-base mb-4 flex items-center gap-2" style={{ color: tokens.colors.text.primary }}>
            <GraduationCap size={18} style={{ color: '#22c55e' }} /> 学校类型分布
          </h3>
          <PieChartSVG data={schoolTypePieData} />
        </div>
      </div>

      {/* 柱状图区域 */}
      {schoolBarData.length > 0 && (
        <div className="glass-panel p-5">
          <h3 className="font-bold text-base mb-4 flex items-center gap-2" style={{ color: tokens.colors.text.primary }}>
            <BarChart3 size={18} style={{ color: tokens.colors.accent.secondary }} /> 热门报考学校 TOP {Math.min(8, schoolBarData.length)}
          </h3>
          <BarChartSVG data={schoolBarData} />
        </div>
      )}

      {/* 老师学生分布柱状图 - 仅管理员 */}
      {user.role === 'admin' && teacherBarData.length > 0 && (
        <div className="glass-panel p-5">
          <h3 className="font-bold text-base mb-4 flex items-center gap-2" style={{ color: tokens.colors.text.primary }}>
            <Users size={18} style={{ color: tokens.colors.accent.secondary }} /> 老师名下学生分布
          </h3>
          <BarChartSVG data={teacherBarData} />
        </div>
      )}

      {/* 各学校报考详情表格 */}
      {aggregatedData.sortedSchools.length > 0 && (
        <div className="glass-panel p-5 overflow-hidden">
          <h3 className="font-bold text-base mb-4 flex items-center gap-2" style={{ color: tokens.colors.text.primary }}>
            <School size={18} style={{ color: '#22c55e' }} /> 各学校报考详情
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `2px solid ${tokens.colors.border.subtle}` }}>
                  <th className="text-left py-2 px-3 font-medium" style={{ color: tokens.colors.text.muted }}>#</th>
                  <th className="text-left py-2 px-3 font-medium" style={{ color: tokens.colors.text.muted }}>学校名称</th>
                  <th className="text-left py-2 px-3 font-medium" style={{ color: tokens.colors.text.muted }}>类型</th>
                  <th className="text-center py-2 px-3 font-medium" style={{ color: tokens.colors.text.muted }}>报考</th>
                  <th className="text-center py-2 px-3 font-medium" style={{ color: tokens.colors.text.muted }}>准备中</th>
                  <th className="text-center py-2 px-3 font-medium" style={{ color: tokens.colors.text.muted }}>已联系</th>
                  <th className="text-center py-2 px-3 font-medium" style={{ color: tokens.colors.text.muted }}>已提交</th>
                  <th className="text-center py-2 px-3 font-medium" style={{ color: tokens.colors.text.muted }}>已合格</th>
                  <th className="text-center py-2 px-3 font-medium" style={{ color: tokens.colors.text.muted }}>合格率</th>
                </tr>
              </thead>
              <tbody>
                {aggregatedData.sortedSchools.map((school, idx) => (
                  <tr key={school.name} className="transition" style={{ borderBottom: `1px solid ${tokens.colors.border.subtle}` }}
                    onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td className="py-2.5 px-3">
                      <span className="w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-bold"
                        style={{ background: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-medium" style={{ color: tokens.colors.text.primary }}>{school.name}</td>
                    <td className="py-2.5 px-3">
                      {school.type && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{
                          background: school.type === '国立' ? (isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)') :
                                     school.type === '公立' ? (isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)') :
                                     (isDark ? 'rgba(249,115,22,0.15)' : 'rgba(249,115,22,0.1)'),
                          color: school.type === '国立' ? '#3b82f6' : school.type === '公立' ? '#22c55e' : '#f97316',
                        }}>{school.type}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold" style={{ color: tokens.colors.text.primary }}>{school.total}</td>
                    <td className="py-2.5 px-3 text-center" style={{ color: '#3b82f6' }}>{school.preparing || 0}</td>
                    <td className="py-2.5 px-3 text-center" style={{ color: '#22c55e' }}>{school.contacted || 0}</td>
                    <td className="py-2.5 px-3 text-center" style={{ color: '#a855f7' }}>{school.submitted || 0}</td>
                    <td className="py-2.5 px-3 text-center font-bold" style={{ color: '#eab308' }}>{school.admitted || 0}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="text-xs font-bold" style={{ color: school.admitted > 0 ? '#22c55e' : tokens.colors.text.muted }}>
                        {school.total > 0 ? Math.round(school.admitted / school.total * 100) : 0}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

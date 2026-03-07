import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  Users, Clock, School, AlertCircle, CheckSquare,
  TrendingUp, Calendar, UserCheck, BookOpen, ArrowRight,
  Filter, BarChart3, PieChart, GraduationCap, ChevronDown, ChevronUp,
  RefreshCw
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { schoolsAPI } from '../services/api';

// === SVG 饼图组件（响应式：手机端上下排列，桌面端左右排列） ===
const PieChartSVG = ({ data, size = 160, compact = false }) => {
  const actualSize = compact ? 120 : size;
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) {
    return (
      <div className="flex items-center justify-center" style={{ width: actualSize, height: actualSize }}>
        <span className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>暂无数据</span>
      </div>
    );
  }
  const r = actualSize / 2 - 8;
  const cx = actualSize / 2;
  const cy = actualSize / 2;
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
    <div className={compact ? 'flex flex-col items-center gap-3' : 'flex items-center gap-4'}>
      <svg width={actualSize} height={actualSize} className="flex-shrink-0">
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="var(--theme-border-subtle)" strokeWidth="2" className="transition-all hover:opacity-80">
            <title>{s.label}: {s.value} ({s.percentage}%)</title>
          </path>
        ))}
      </svg>
      <div className={compact ? 'flex flex-wrap justify-center gap-x-3 gap-y-1' : 'space-y-1.5'}>
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
  currentStudent,
  getVisibleStudents,
  getTeacherList,
  onNavigate,
  onSelectStudent,
  onViewAllStudents,
}) => {
  const { isDark, tokens, glassEnabled } = useTheme();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const visibleStudents = getVisibleStudents ? getVisibleStudents() : [];
  const teachers = getTeacherList ? getTeacherList() : [];

  // 过滤状态
  const [filterGroup, setFilterGroup] = useState('all'); // all | teacher_xxx | type_国立 | status_xxx | school_xxx
  const [showFilters, setShowFilters] = useState(false);

  // ─── 后端统计数据 ──────────────────────────────────────────────────────────
  const [backendStats, setBackendStats] = useState(null); // { sortedSchools, statusCounts, schoolTypeMap, totalApplications }
  const [backendEventStats, setBackendEventStats] = useState(null); // { totalEvents, urgentEvents, upcomingEvents }
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(null);

  const fetchBackendStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const teacherId = user.role === 'teacher' ? (user.teacherId || null) : null;
      const opts = teacherId ? { teacherId } : {};
      const [schoolStats, eventStats] = await Promise.all([
        schoolsAPI.getStats(opts),
        schoolsAPI.getEventStats(opts),
      ]);
      setBackendStats(schoolStats);
      setBackendEventStats(eventStats);
    } catch (err) {
      // 后端不可用时降级到 localStorage 数据，不报错
      setStatsError('后端统计暂不可用，显示本地缓存数据');
    } finally {
      setStatsLoading(false);
    }
  }, [user.role, user.teacherId]);

  useEffect(() => {
    fetchBackendStats();
  }, [fetchBackendStats]);

  // === 聚合全部学生数据（从 localStorage 读取每个学生的完整数据）===
  const aggregatedData = useMemo(() => {
    const allSchoolApps = [];
    const allEvents = [];
    let totalMaterials = 0;
    let completedMaterials = 0;
    const schoolStats = {}; // schoolName -> { total, not_started, preparing, applied, submitted, admitted, rejected, type }
    const teacherStudentMap = {}; // teacherId -> [students]
    const schoolTypeMap = {}; // 国立/公立/私立 -> count
    const statusCounts = { not_started: 0, preparing: 0, applied: 0, submitted: 0, admitted: 0, rejected: 0 };

    // 一次性读取 studentData 大对象（App.jsx 将所有学生数据存储在此）
    let allStudentDataParsed = null;
    try {
      const raw = localStorage.getItem('studentData');
      if (raw) allStudentDataParsed = JSON.parse(raw);
    } catch {}

    visibleStudents.forEach(student => {
      // 按老师分组
      const tid = student.teacherId || 'unassigned';
      if (!teacherStudentMap[tid]) teacherStudentMap[tid] = [];
      teacherStudentMap[tid].push(student);

      // 从 localStorage 读取学生数据
    try {
        const key = student.studentId || 'default';
        // App.jsx 将所有学生数据存储在 localStorage.studentData（大对象，key 为 studentId）
        // 同时兼容旧的 studentData_${key} 格式
        let data = allStudentDataParsed?.[key] || {};
        if (!data || Object.keys(data).length === 0) {
          const legacyData = localStorage.getItem(`studentData_${key}`);
          if (legacyData) data = JSON.parse(legacyData);
        }

        // 聚合事件
        const studentEvents = data.events || (student.studentId === (currentStudent?.studentId) ? (events || []) : []);
        studentEvents.forEach(e => {
          allEvents.push({ ...e, studentName: student.name, studentId: student.studentId });
        });

        // 聚合学校申请
        const studentSchools = data.schools || [];
        // 若 localStorage 无数据，使用传入的 schools prop 作为兜底（当前选中学生）
        const schoolsToProcess = studentSchools.length > 0 ? studentSchools : (student.studentId === (currentStudent?.studentId) ? (schools || []) : []);
        schoolsToProcess.forEach(school => {
          allSchoolApps.push({ ...school, studentName: student.name, studentId: student.studentId, teacherId: student.teacherId });
          const status = school.status || 'preparing';
          if (statusCounts[status] !== undefined) statusCounts[status]++;

          // 按学校统计
          if (!schoolStats[school.name]) {
          schoolStats[school.name] = { total: 0, not_started: 0, preparing: 0, applied: 0, submitted: 0, admitted: 0, rejected: 0, type: school.type || '' };
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
      } catch {
        // 解析失败时静默忽略
      }
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
      // localStorage 兜底数据（后端不可用时使用）
      sortedSchools,
      schoolTypeMap,
      teacherStudentMap,
      allSchoolApps,
    };
  }, [visibleStudents, teachers]);

  // ─── 优先使用后端统计数据，降级到 localStorage ─────────────────────────────
  // 各学校报考详情：优先后端，降级 localStorage
  const finalSortedSchools = backendStats?.sortedSchools?.length > 0
    ? backendStats.sortedSchools
    : aggregatedData.sortedSchools;

  // 申请状态分布：优先后端，降级 localStorage
  const finalStatusCounts = backendStats?.statusCounts || aggregatedData.statusCounts;

  // 学校类型分布：优先后端，降级 localStorage
  const finalSchoolTypeMap = backendStats?.schoolTypeMap || aggregatedData.schoolTypeMap;

  // 报考总数：优先后端，降级 localStorage
  const finalTotalApplications = backendStats?.totalApplications ?? aggregatedData.totalApplications;

  // 事件统计：优先后端，降级 localStorage
  const finalUrgentEvents = backendEventStats?.urgentEvents ?? aggregatedData.urgentEvents;
  const finalUpcomingEvents = backendEventStats?.upcomingEvents ?? aggregatedData.upcomingEvents;

  // 学生-学校映射缓存（必须在 filteredStudents 之前定义）
  const studentSchoolMap = useMemo(() => {
    const map = {};
    // 一次性读取 studentData 大对象，避免多次 localStorage 读取
    let allStudentDataParsed = null;
    try {
      const raw = localStorage.getItem('studentData');
      if (raw) allStudentDataParsed = JSON.parse(raw);
    } catch {}
    visibleStudents.forEach(student => {
      try {
        const key = student.studentId || 'default';
        let data = allStudentDataParsed?.[key] || null;
        if (!data) {
          // 兼容旧格式
          const legacyData = localStorage.getItem(`studentData_${key}`);
          if (legacyData) data = JSON.parse(legacyData);
        }
        if (data) {
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
    const counts = { preparing: 0, applied: 0, submitted: 0, admitted: 0 };
    filteredSchoolApps.forEach(a => {
      const status = a.status || 'preparing';
      if (counts[status] !== undefined) counts[status]++;
    });
    return counts;
  }, [filteredSchoolApps]);

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? '早上好' : currentHour < 18 ? '下午好' : '晚上好';

  // 饼图数据（筛选时使用 filteredStatusCounts，否则使用后端/localStorage 数据）
  const statusPieData = filterGroup === 'all'
    ? [
        { label: '准备中', value: finalStatusCounts.preparing || 0, color: '#3b82f6' },
        { label: '出愿完成', value: finalStatusCounts.applied || 0, color: '#22c55e' },
        { label: '邮寄完成', value: finalStatusCounts.submitted || 0, color: '#a855f7' },
        { label: '合格', value: finalStatusCounts.admitted || 0, color: '#eab308' },
        { label: '未合格', value: finalStatusCounts.rejected || 0, color: '#ef4444' },
      ]
    : [
        { label: '准备中', value: filteredStatusCounts.preparing || 0, color: '#3b82f6' },
        { label: '出愿完成', value: filteredStatusCounts.applied || 0, color: '#22c55e' },
        { label: '邮寄完成', value: filteredStatusCounts.submitted || 0, color: '#a855f7' },
        { label: '合格', value: filteredStatusCounts.admitted || 0, color: '#eab308' },
      ];

  const schoolTypePieData = Object.entries(finalSchoolTypeMap).map(([type, count]) => ({
    label: type,
    value: count,
    color: type === '国立' ? '#3b82f6' : type === '公立' ? '#22c55e' : type === '私立' ? '#f97316' : '#9ca3af',
  }));

  // 柱状图数据 - top 8 学校（使用后端/localStorage 数据）
  const schoolBarData = finalSortedSchools.slice(0, 8).map((s, i) => ({
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
      <div className="rounded-2xl p-4 sm:p-5 lg:p-6" style={glassCardStyle}>
        <div className={`flex ${isMobile ? 'flex-col gap-3' : 'items-center justify-between'}`}>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold mb-1" style={{ color: tokens.colors.text.primary }}>
              {greeting}，{user.name}
            </h1>
      <p className="text-xs sm:text-sm" style={{ color: tokens.colors.text.muted }}>
              {user.role === 'admin'
                ? (isMobile
                    ? `${aggregatedData.totalStudents} 学生 · ${aggregatedData.totalTeachers} 老师 · ${finalTotalApplications} 报考`
                    : `管理员仪表盘 — ${aggregatedData.totalStudents} 名学生 · ${aggregatedData.totalTeachers} 名老师 · ${finalTotalApplications} 条报考`)
                : '教师管理端 — 查看您的学生和工作概况'}
            </p>
            {/* 后端统计状态提示 */}
            {/* 后端不可用时静默降级，不显示错误提示 */}
            {statsLoading && (
              <p className="text-xs mt-1 flex items-center gap-1" style={{ color: tokens.colors.text.muted }}>
                <RefreshCw size={12} className="animate-spin" /> 正在从数据库加载统计数据...
              </p>
            )}
          </div>
          {/* 过滤切换按钮 */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition ${isMobile ? 'self-start' : ''}`}
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
                { key: 'applied', label: '已出愿', color: 'green' },
      { key: 'submitted', label: '出愿结束', color: 'purple' },
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className={`glass-card ${isMobile ? 'p-3' : 'p-5'} cursor-pointer`} onClick={() => onNavigate('profile')}>
          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
            <div className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} rounded-xl flex items-center justify-center`}
              style={{ background: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)' }}>
              <Users size={isMobile ? 16 : 20} style={{ color: '#3b82f6' }} />
            </div>
            <span className="text-xs sm:text-sm" style={{ color: tokens.colors.text.muted }}>学生总数</span>
          </div>
          <div className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold animate-number`} style={{ color: tokens.colors.text.primary }}>{filteredStudents.length}</div>
          {aggregatedData.unassignedStudents > 0 && filterGroup === 'all' && (
            <p className="text-[11px] sm:text-xs mt-1 flex items-center gap-1" style={{ color: tokens.colors.accent.warning }}>
              <AlertCircle size={11} /> {aggregatedData.unassignedStudents} 待分配
            </p>
          )}
        </div>

        <div className={`glass-card ${isMobile ? 'p-3' : 'p-5'} cursor-pointer`} onClick={() => onNavigate('timeline')}>
          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
            <div className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} rounded-xl flex items-center justify-center`}
              style={{ background: isDark ? 'rgba(249,115,22,0.15)' : 'rgba(249,115,22,0.1)' }}>
              <Clock size={isMobile ? 16 : 20} style={{ color: '#f97316' }} />
            </div>
            <span className="text-xs sm:text-sm" style={{ color: tokens.colors.text.muted }}>待处理事件</span>
          </div>
          <div className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold animate-number`} style={{ color: tokens.colors.text.primary }}>{finalUpcomingEvents}</div>
          {finalUrgentEvents > 0 && (
            <p className="text-[11px] sm:text-xs mt-1 flex items-center gap-1" style={{ color: tokens.colors.accent.danger }}>
              <AlertCircle size={11} /> {finalUrgentEvents} 紧急
            </p>
          )}
        </div>

        <div className={`glass-card ${isMobile ? 'p-3' : 'p-5'} cursor-pointer`} onClick={() => onNavigate('schools')}>
          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
            <div className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} rounded-xl flex items-center justify-center`}
              style={{ background: isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)' }}>
              <School size={isMobile ? 16 : 20} style={{ color: '#22c55e' }} />
            </div>
            <span className="text-xs sm:text-sm" style={{ color: tokens.colors.text.muted }}>报考总数</span>
          </div>
          <div className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold animate-number`} style={{ color: tokens.colors.text.primary }}>
            {filterGroup === 'all' ? finalTotalApplications : filteredSchoolApps.length}
          </div>
          {finalStatusCounts.admitted > 0 && filterGroup === 'all' && (
            <p className="text-[11px] sm:text-xs mt-1" style={{ color: tokens.colors.accent.success }}>
              {finalTotalApplications > 0 ? Math.round(finalStatusCounts.admitted / finalTotalApplications * 100) : 0}% 合格率
            </p>
          )}
        </div>

        <div className={`glass-card ${isMobile ? 'p-3' : 'p-5'} cursor-pointer`} onClick={() => onNavigate('checklist')}>
          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
            <div className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} rounded-xl flex items-center justify-center`}
              style={{ background: isDark ? 'rgba(168,85,247,0.15)' : 'rgba(168,85,247,0.1)' }}>
              <CheckSquare size={isMobile ? 16 : 20} style={{ color: '#a855f7' }} />
            </div>
            <span className="text-xs sm:text-sm" style={{ color: tokens.colors.text.muted }}>材料进度</span>
          </div>
          <div className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold animate-number`} style={{ color: tokens.colors.text.primary }}>{aggregatedData.materialProgress}%</div>
          <p className="text-[11px] sm:text-xs mt-1" style={{ color: tokens.colors.text.muted }}>{aggregatedData.completedMaterials}/{aggregatedData.totalMaterials} 完成</p>
        </div>
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* 申请状态分布饼图 */}
        <div className={`glass-panel ${isMobile ? 'p-4' : 'p-5'}`}>
          <h3 className="font-bold text-sm sm:text-base mb-3 sm:mb-4 flex items-center gap-2" style={{ color: tokens.colors.text.primary }}>
            <PieChart size={isMobile ? 16 : 18} style={{ color: '#3b82f6' }} /> 申请状态分布
            {filterGroup !== 'all' && <span className="text-xs font-normal px-2 py-0.5 rounded-full" style={{
              background: isDark ? 'rgba(168,85,247,0.12)' : 'rgba(168,85,247,0.08)',
              color: tokens.colors.accent.secondary,
            }}>已筛选</span>}
          </h3>
          <PieChartSVG data={statusPieData} compact={isMobile} />
        </div>

        {/* 学校类型分布饼图 */}
        <div className={`glass-panel ${isMobile ? 'p-4' : 'p-5'}`}>
          <h3 className="font-bold text-sm sm:text-base mb-3 sm:mb-4 flex items-center gap-2" style={{ color: tokens.colors.text.primary }}>
            <GraduationCap size={isMobile ? 16 : 18} style={{ color: '#22c55e' }} /> 学校类型分布
          </h3>
          <PieChartSVG data={schoolTypePieData} compact={isMobile} />
        </div>
      </div>

      {/* 柱状图区域 */}
      {schoolBarData.length > 0 && (
        <div className={`glass-panel ${isMobile ? 'p-4' : 'p-5'}`}>
          <h3 className="font-bold text-sm sm:text-base mb-3 sm:mb-4 flex items-center gap-2" style={{ color: tokens.colors.text.primary }}>
            <BarChart3 size={isMobile ? 16 : 18} style={{ color: tokens.colors.accent.secondary }} /> 热门报考学校 TOP {Math.min(8, schoolBarData.length)}
          </h3>
          <BarChartSVG data={schoolBarData} height={isMobile ? 150 : 200} />
        </div>
      )}

      {/* 老师学生分布柱状图 - 仅管理员 */}
      {user.role === 'admin' && teacherBarData.length > 0 && (
        <div className={`glass-panel ${isMobile ? 'p-4' : 'p-5'}`}>
          <h3 className="font-bold text-sm sm:text-base mb-3 sm:mb-4 flex items-center gap-2" style={{ color: tokens.colors.text.primary }}>
            <Users size={isMobile ? 16 : 18} style={{ color: tokens.colors.accent.secondary }} /> 老师名下学生分布
          </h3>
          <BarChartSVG data={teacherBarData} height={isMobile ? 150 : 200} />
        </div>
      )}

      {/* 各学校报考详情 */}
      {finalSortedSchools.length > 0 && (
        <div className={`glass-panel ${isMobile ? 'p-4' : 'p-5'} overflow-hidden`}>
          <h3 className="font-bold text-sm sm:text-base mb-3 sm:mb-4 flex items-center gap-2" style={{ color: tokens.colors.text.primary }}>
            <School size={isMobile ? 16 : 18} style={{ color: '#22c55e' }} /> 各学校报考详情
          </h3>
          {/* 数据来源标识 */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] sm:text-xs px-2 py-0.5 rounded-full" style={{
              background: backendStats ? (isDark ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.08)') : (isDark ? 'rgba(249,115,22,0.12)' : 'rgba(249,115,22,0.08)'),
              color: backendStats ? '#22c55e' : '#f97316',
            }}>
              {backendStats ? '✓ 实时数据' : '⚠ 缓存数据'}
            </span>
            <button onClick={fetchBackendStats} disabled={statsLoading}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition"
              style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', color: tokens.colors.text.muted }}>
              <RefreshCw size={12} className={statsLoading ? 'animate-spin' : ''} /> 刷新
            </button>
          </div>

          {isMobile ? (
            /* 移动端：卡片式展示学校报考详情 */
            <div className="space-y-3">
              {finalSortedSchools.map((school, idx) => (
                <div key={school.name} className="rounded-lg p-3" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}` }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                        style={{ background: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
                        {idx + 1}
                      </span>
                      <span className="font-medium text-sm truncate" style={{ color: tokens.colors.text.primary }}>{school.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {school.type && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{
                          background: school.type === '国立' ? (isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)') :
                                     school.type === '公立' ? (isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)') :
                                     (isDark ? 'rgba(249,115,22,0.15)' : 'rgba(249,115,22,0.1)'),
                          color: school.type === '国立' ? '#3b82f6' : school.type === '公立' ? '#22c55e' : '#f97316',
                        }}>{school.type}</span>
                      )}
                      <span className="text-sm font-bold" style={{ color: tokens.colors.text.primary }}>{school.total}人</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-1 text-center">
                    <div className="rounded py-1" style={{ background: isDark ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.06)' }}>
                      <div className="text-[10px]" style={{ color: tokens.colors.text.muted }}>准备中</div>
                      <div className="text-xs font-bold" style={{ color: '#3b82f6' }}>{school.preparing || 0}</div>
                    </div>
                    <div className="rounded py-1" style={{ background: isDark ? 'rgba(34,197,94,0.08)' : 'rgba(34,197,94,0.06)' }}>
                      <div className="text-[10px]" style={{ color: tokens.colors.text.muted }}>出愿</div>
                      <div className="text-xs font-bold" style={{ color: '#22c55e' }}>{school.applied || 0}</div>
                    </div>
                    <div className="rounded py-1" style={{ background: isDark ? 'rgba(249,115,22,0.08)' : 'rgba(249,115,22,0.06)' }}>
                      <div className="text-[10px]" style={{ color: tokens.colors.text.muted }}>邮寄</div>
                      <div className="text-xs font-bold" style={{ color: '#f97316' }}>{school.submitted || 0}</div>
                    </div>
                    <div className="rounded py-1" style={{ background: isDark ? 'rgba(234,179,8,0.08)' : 'rgba(234,179,8,0.06)' }}>
                      <div className="text-[10px]" style={{ color: tokens.colors.text.muted }}>合格</div>
                      <div className="text-xs font-bold" style={{ color: '#eab308' }}>{school.admitted || 0}</div>
                    </div>
                    <div className="rounded py-1" style={{ background: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.06)' }}>
                      <div className="text-[10px]" style={{ color: tokens.colors.text.muted }}>未合格</div>
                      <div className="text-xs font-bold" style={{ color: '#ef4444' }}>{school.rejected || 0}</div>
                    </div>
                  </div>
                  {school.total > 0 && school.admitted > 0 && (
                    <div className="text-right mt-1">
                      <span className="text-[11px] font-bold" style={{ color: '#22c55e' }}>
                        合格率 {Math.round(school.admitted / school.total * 100)}%
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* 桌面端：表格式展示 */
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: `2px solid ${tokens.colors.border.subtle}` }}>
                    <th className="text-left py-2 px-3 font-medium" style={{ color: tokens.colors.text.muted }}>#</th>
                    <th className="text-left py-2 px-3 font-medium" style={{ color: tokens.colors.text.muted }}>学校名称</th>
                    <th className="text-left py-2 px-3 font-medium" style={{ color: tokens.colors.text.muted }}>类型</th>
                    <th className="text-center py-2 px-3 font-medium" style={{ color: tokens.colors.text.muted }}>报考</th>
                    <th className="text-center py-2 px-3 font-medium" style={{ color: tokens.colors.text.muted }}>准备中</th>
                    <th className="text-center py-2 px-3 font-medium" style={{ color: tokens.colors.text.muted }}>出愿完成</th>
                    <th className="text-center py-2 px-3 font-medium" style={{ color: tokens.colors.text.muted }}>邮寄完成</th>
                    <th className="text-center py-2 px-3 font-medium" style={{ color: tokens.colors.text.muted }}>合格</th>
                    <th className="text-center py-2 px-3 font-medium" style={{ color: tokens.colors.text.muted }}>未合格</th>
                    <th className="text-center py-2 px-3 font-medium" style={{ color: tokens.colors.text.muted }}>合格率</th>
                  </tr>
                </thead>
                <tbody>
                  {finalSortedSchools.map((school, idx) => (
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
                      <td className="py-2.5 px-3 text-center" style={{ color: '#22c55e' }}>{school.applied || 0}</td>
                      <td className="py-2.5 px-3 text-center" style={{ color: '#f97316' }}>{school.submitted || 0}</td>
                      <td className="py-2.5 px-3 text-center font-bold" style={{ color: '#eab308' }}>{school.admitted || 0}</td>
                      <td className="py-2.5 px-3 text-center" style={{ color: '#ef4444' }}>{school.rejected || 0}</td>
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
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
